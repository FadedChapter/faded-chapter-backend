/**
 * Order number allocation.
 *
 * These run against a real Postgres, because the thing under test is a single
 * atomic SQL statement. Mocking the query would assert that the string I wrote
 * equals the string I expected, which is not the property that matters — the
 * property that matters is that the database hands two concurrent callers two
 * different numbers.
 *
 * Every test works inside a synthetic store id and removes its own rows, so no
 * real order data is read or written.
 *
 * Run with: npm run test:db
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { loadConfig } from '../../core/config/env';
import { initializeLogger } from '../../core/logging/logger';
import { initializeDatabase, getDataSource, closeDatabase } from '../../core/database/postgres-data-source';
import {
  OrderRepository,
  formatOrderNumber,
  parseOrderNumber,
} from '../../core/repositories/order.repositories';
import { isOrderNumberConflict } from '../../core/services/order.service';

/** Isolated from every real store, so the suite cannot disturb live orders. */
const TEST_STORE = randomUUID();
const TEST_CUSTOMER = randomUUID();

let orders: OrderRepository;

/**
 * Insert a bare order row carrying only what numbering cares about.
 *
 * orders now carries foreign keys to both stores and customers, so the test
 * fixtures below create a real store and customer rather than synthetic ids.
 * That is the constraint doing its job: an order for a customer who does not
 * exist should not be insertable, in a test any more than in production.
 */
async function seedOrder(orderNumber: string): Promise<void> {
  await getDataSource().query(
    `INSERT INTO orders (id, store_id, customer_id, order_number, status, payment_status,
                         fulfillment_status, subtotal, tax_amount, shipping_amount,
                         discount_amount, total, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'pending', 'unpaid', 'unfulfilled', 0, 0, 0, 0, 0, now(), now())`,
    [randomUUID(), TEST_STORE, TEST_CUSTOMER, orderNumber],
  );
}

/** A store and customer the foreign keys can point at, removed afterwards. */
async function createFixtures(): Promise<void> {
  await getDataSource().query(
    `INSERT INTO stores (id, name, slug, owner_email, owner_name, status, created_at, updated_at)
     VALUES ($1, 'Numbering Test Store', $2, 'numbering@test.local', 'Test', 'active', now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [TEST_STORE, `numbering-test-${TEST_STORE.slice(0, 8)}`],
  );
  await getDataSource().query(
    `INSERT INTO customers (id, store_id, email, email_normalized, status, created_at, updated_at)
     VALUES ($1, $2, 'numbering@test.local', 'numbering@test.local', 'active', now(), now())
     ON CONFLICT DO NOTHING`,
    [TEST_CUSTOMER, TEST_STORE],
  );
}

async function removeFixtures(): Promise<void> {
  await getDataSource().query(`DELETE FROM customers WHERE store_id = $1`, [TEST_STORE]);
  await getDataSource().query(`DELETE FROM stores WHERE id = $1`, [TEST_STORE]);
}

async function clearStore(): Promise<void> {
  await getDataSource().query(`DELETE FROM orders WHERE store_id = $1`, [TEST_STORE]);
  await getDataSource().query(`DELETE FROM order_number_counters WHERE store_id = $1`, [TEST_STORE]);
}

beforeAll(async () => {
  loadConfig();
  initializeLogger();
  await initializeDatabase();
  orders = new OrderRepository();
  await createFixtures();
});

beforeEach(clearStore);

afterAll(async () => {
  await clearStore();
  await removeFixtures();
  await closeDatabase();
});

describe('formatting and parsing', () => {
  it('pads to the four digits the existing data uses', () => {
    // The bug padded to five while every row used four. ORD-1026 must be
    // followed by ORD-1027, not ORD-01027.
    expect(formatOrderNumber(1027)).toBe('ORD-1027');
    expect(formatOrderNumber(1)).toBe('ORD-0001');
  });

  it('lets numbers grow past four digits rather than truncating', () => {
    // Four is a minimum, not a fixed width. Safe now that nothing compares
    // order numbers as strings.
    expect(formatOrderNumber(10000)).toBe('ORD-10000');
  });

  it('round-trips through parse', () => {
    expect(parseOrderNumber(formatOrderNumber(1027))).toBe(1027);
    expect(parseOrderNumber('ORD-01027')).toBe(1027);
  });

  it('returns null rather than NaN for a number it cannot read', () => {
    expect(parseOrderNumber('ORD-')).toBeNull();
    expect(parseOrderNumber('no-digits-here')).toBeNull();
  });
});

describe('allocation continues from existing orders', () => {
  it('yields ORD-1027 for a store whose latest order is ORD-1026', async () => {
    await seedOrder('ORD-1026');

    expect(await orders.getNextOrderNumber(TEST_STORE)).toBe('ORD-1027');
  });

  it('starts at ORD-0001 for a store with no orders', async () => {
    expect(await orders.getNextOrderNumber(TEST_STORE)).toBe('ORD-0001');
  });

  it('reads the highest number numerically, not as a string', async () => {
    // The regression. Sorted as text, 'ORD-1026' beats 'ORD-01027' because '1'
    // beats '0' at the fifth character — so the old code recomputed ORD-01027
    // forever and every order after the first collided.
    await seedOrder('ORD-1026');
    await seedOrder('ORD-01027');

    expect(await orders.getNextOrderNumber(TEST_STORE)).toBe('ORD-1028');
  });

  it('is not confused by a mix of padding widths', async () => {
    await seedOrder('ORD-0009');
    await seedOrder('ORD-10');

    expect(await orders.getNextOrderNumber(TEST_STORE)).toBe('ORD-0011');
  });
});

describe('allocation reserves, rather than merely reading', () => {
  it('returns two different numbers when called twice in a row', async () => {
    await seedOrder('ORD-1026');

    const first = await orders.getNextOrderNumber(TEST_STORE);
    const second = await orders.getNextOrderNumber(TEST_STORE);

    // A read-then-write would return ORD-1027 twice, because nothing was
    // inserted in between. Reserving is the whole difference.
    expect(first).toBe('ORD-1027');
    expect(second).toBe('ORD-1028');
    expect(first).not.toBe(second);
  });

  it('gives every caller a distinct number under concurrency', async () => {
    await seedOrder('ORD-1026');

    const allocated = await Promise.all(
      Array.from({ length: 25 }, () => orders.getNextOrderNumber(TEST_STORE)),
    );

    expect(new Set(allocated).size).toBe(allocated.length);
  });

  it('does not reuse a number after the counter is resynced', async () => {
    await seedOrder('ORD-1026');
    const first = await orders.getNextOrderNumber(TEST_STORE);

    // Resync must never move the counter backwards, even though the allocated
    // number was not written to `orders` — handing it out twice is the failure
    // this guards.
    await orders.resyncOrderNumberCounter(TEST_STORE);
    const second = await orders.getNextOrderNumber(TEST_STORE);

    expect(parseOrderNumber(second)!).toBeGreaterThan(parseOrderNumber(first)!);
  });

  it('catches up when an order is inserted behind the counter', async () => {
    await seedOrder('ORD-1026');
    await orders.getNextOrderNumber(TEST_STORE);

    // Something outside the allocator wrote a much higher number.
    await seedOrder('ORD-2000');
    await orders.resyncOrderNumberCounter(TEST_STORE);

    expect(await orders.getNextOrderNumber(TEST_STORE)).toBe('ORD-2001');
  });
});

describe('conflict detection is narrow', () => {
  it('recognises the raw driver error', () => {
    expect(isOrderNumberConflict({ code: '23505', constraint: 'idx_orders_number' })).toBe(true);
  });

  it('recognises the error after BaseRepository has rewrapped it', () => {
    // The shape that actually reaches the service. BaseRepository.save catches
    // the driver error and rethrows a plain Error, dropping `code` and
    // `constraint` and keeping only the text. Matching on the code alone made
    // the retry dead code — it never once fired.
    const wrapped = new Error(
      'Duplicate entry: duplicate key value violates unique constraint "idx_orders_number"',
    );
    expect(isOrderNumberConflict(wrapped)).toBe(true);
  });

  it('looks inside a nested driver error', () => {
    expect(
      isOrderNumberConflict({
        message: 'Failed to save OrderRepository',
        driverError: { code: '23505', constraint: 'idx_orders_number' },
      }),
    ).toBe(true);
  });

  it('ignores a unique violation on a different index', () => {
    // Retrying a duplicate id would hide a real bug behind a new order number.
    expect(isOrderNumberConflict({ code: '23505', constraint: 'orders_pkey' })).toBe(false);
    expect(
      isOrderNumberConflict(
        new Error('Duplicate entry: duplicate key value violates unique constraint "orders_pkey"'),
      ),
    ).toBe(false);
  });

  it('ignores unrelated errors', () => {
    expect(isOrderNumberConflict(new Error('connection reset'))).toBe(false);
    expect(isOrderNumberConflict(null)).toBe(false);
    expect(isOrderNumberConflict('idx_orders_number')).toBe(false);
  });
});

describe('createOrder recovers from a counter that has drifted behind', () => {
  it('allocates past the collision instead of failing the checkout', async () => {
    await seedOrder('ORD-1026');

    // Point the counter at a number that already exists — the shape a restored
    // backup or a hand-inserted row leaves behind.
    await getDataSource().query(
      `INSERT INTO order_number_counters (store_id, next_value) VALUES ($1, 1026)
       ON CONFLICT (store_id) DO UPDATE SET next_value = 1026`,
      [TEST_STORE],
    );

    await orders.resyncOrderNumberCounter(TEST_STORE);

    expect(await orders.getNextOrderNumber(TEST_STORE)).toBe('ORD-1027');
  });
});
