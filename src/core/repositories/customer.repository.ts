/**
 * Customer Repository
 * Handles customer-related database operations with store isolation
 *
 * Phase 2: Repository implementation
 */

// IsNull() is required to match SQL NULL: TypeORM rejects a literal `null` in a
// where clause. `deleted_at: null` silently threw at runtime wherever it was
// used — including in findByEmail and emailExists, which predate Phase 5.
import { Repository, IsNull } from 'typeorm';
import { BaseRepository } from '../repository/base-repository';
import { CustomerEntity } from '../entities/customer.entity';
import { ConflictError, ValidationError } from '../errors/app-error';

export class CustomerRepository extends BaseRepository<CustomerEntity> {
  constructor() {
    super(CustomerEntity);
  }

  // ==========================================================================
  // Operations console (Phase 5)
  // ==========================================================================

  /**
   * Customer list with purchase rollups.
   *
   * Order count and lifetime value are aggregated in SQL rather than fetched
   * per row. A console that loads customers and then queries orders for each
   * one issues N+1 queries and gets slower exactly as the business grows.
   *
   * Cancelled orders are excluded from lifetime value: money that was never
   * collected is not value, and counting it would overstate every segment
   * built on this figure.
   *
   * Soft-deleted customers are excluded unconditionally. `deleted_at` is set
   * when a record is erased — usually on request — and a console that keeps
   * showing those people has not honoured the erasure.
   */
  async searchCustomers(
    storeId: string,
    options: {
      status?: string;
      search?: string;
      sort?: 'created_at' | 'lifetime_value' | 'order_count';
      direction?: 'ASC' | 'DESC';
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ rows: CustomerListRow[]; total: number }> {
    const {
      status,
      search,
      sort = 'created_at',
      direction = 'DESC',
      limit = 25,
      offset = 0,
    } = options;

    const build = () => {
      const qb = this.repository
        .createQueryBuilder('c')
        .where('c.store_id = :storeId', { storeId })
        .andWhere('c.deleted_at IS NULL');

      if (status) qb.andWhere('c.status = :status', { status });

      if (search?.trim()) {
        const term = `%${search.trim()}%`;
        qb.andWhere(
          "(c.email ILIKE :term OR c.first_name ILIKE :term OR c.last_name ILIKE :term " +
            "OR (COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) ILIKE :term)",
          { term },
        );
      }
      return qb;
    };

    const total = await build().getCount();

    const sortExpression =
      sort === 'lifetime_value'
        ? 'lifetime_value'
        : sort === 'order_count'
          ? 'order_count'
          : 'c.created_at';

    const rows = await build()
      .leftJoin(
        'orders',
        'o',
        "o.customer_id = c.id AND o.store_id = c.store_id AND o.status <> 'cancelled'",
      )
      .select([
        'c.id AS id',
        'c.email AS email',
        'c.first_name AS "firstName"',
        'c.last_name AS "lastName"',
        'c.phone AS phone',
        'c.status AS status',
        'c.email_verified AS "emailVerified"',
        'c.created_at AS "createdAt"',
      ])
      .addSelect('COUNT(o.id)', 'order_count')
      .addSelect('COALESCE(SUM(o.total), 0)', 'lifetime_value')
      .addSelect('MAX(o.created_at)', 'last_order_at')
      .groupBy('c.id')
      .addGroupBy('c.email')
      .addGroupBy('c.first_name')
      .addGroupBy('c.last_name')
      .addGroupBy('c.phone')
      .addGroupBy('c.status')
      .addGroupBy('c.email_verified')
      .addGroupBy('c.created_at')
      .orderBy(sortExpression, direction === 'ASC' ? 'ASC' : 'DESC')
      .limit(Math.min(Math.max(limit, 1), 100))
      .offset(Math.max(offset, 0))
      .getRawMany<CustomerListRow>();

    return { rows, total };
  }

  /** Status counts for the console's tabs, in one round trip. */
  async statusCounts(storeId: string): Promise<Record<string, number>> {
    const rows = await this.repository
      .createQueryBuilder('c')
      .select('c.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('c.store_id = :storeId', { storeId })
      .andWhere('c.deleted_at IS NULL')
      .groupBy('c.status')
      .getRawMany<{ status: string; count: string }>();

    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = Number(row.count);
      return acc;
    }, {});
  }

  /**
   * One customer, scoped to store and excluding erased records.
   * A soft-deleted customer reads as "not found" rather than being served with
   * a deleted flag — there is no admin workflow that needs to read one back.
   */
  async findOneScoped(customerId: string, storeId: string): Promise<CustomerEntity | null> {
    return this.repository.findOne({
      where: { id: customerId, store_id: storeId, deleted_at: IsNull() } as any,
    });
  }

  /** Purchase rollups for a single customer. */
  async purchaseSummary(
    customerId: string,
    storeId: string,
  ): Promise<{ orderCount: number; lifetimeValue: number; lastOrderAt: Date | null }> {
    const row = await this.repository.manager
      .createQueryBuilder()
      .select('COUNT(o.id)', 'orderCount')
      .addSelect('COALESCE(SUM(o.total), 0)', 'lifetimeValue')
      .addSelect('MAX(o.created_at)', 'lastOrderAt')
      .from('orders', 'o')
      .where('o.customer_id = :customerId', { customerId })
      .andWhere('o.store_id = :storeId', { storeId })
      .andWhere("o.status <> 'cancelled'")
      .getRawOne<{ orderCount: string; lifetimeValue: string; lastOrderAt: Date | null }>();

    return {
      orderCount: Number(row?.orderCount ?? 0),
      lifetimeValue: Number(row?.lifetimeValue ?? 0),
      lastOrderAt: row?.lastOrderAt ?? null,
    };
  }

  /** Set customer status (active / inactive / banned). */
  async setStatus(
    customerId: string,
    storeId: string,
    status: string,
  ): Promise<CustomerEntity | null> {
    const result = await this.repository.update(
      { id: customerId, store_id: storeId, deleted_at: IsNull() } as any,
      { status, updated_at: new Date() } as any,
    );
    if (!result.affected) {
      return null;
    }
    return this.findOneScoped(customerId, storeId);
  }

  /**
   * Find customer by email (store-isolated)
   */
  async findByEmail(email: string, storeId: string): Promise<CustomerEntity | null> {
    try {
      const normalized = email.toLowerCase().trim();
      return await this.repository.findOne({
        where: {
          store_id: storeId,
          email_normalized: normalized,
          deleted_at: IsNull(),
        } as any,
      });
    } catch (error) {
      throw new Error(`Failed to find customer by email: ${(error as Error).message}`);
    }
  }

  /**
   * Find customer by email or fail
   */
  async findByEmailOrFail(email: string, storeId: string): Promise<CustomerEntity> {
    const customer = await this.findByEmail(email, storeId);
    if (!customer) {
      throw new Error('Customer not found');
    }
    return customer;
  }

  /**
   * Check if email exists (case-insensitive, store-isolated)
   */
  async emailExists(email: string, storeId: string, excludeCustomerId?: string): Promise<boolean> {
    try {
      const normalized = email.toLowerCase().trim();
      const query = this.repository
        .createQueryBuilder('c')
        .where('c.store_id = :storeId', { storeId })
        .andWhere('c.email_normalized = :normalized', { normalized })
        .andWhere('c.deleted_at IS NULL');

      if (excludeCustomerId) {
        query.andWhere('c.id != :customerId', { customerId: excludeCustomerId });
      }

      const count = await query.getCount();
      return count > 0;
    } catch (error) {
      throw new Error(`Failed to check email existence: ${(error as Error).message}`);
    }
  }

  /**
   * Create customer (with email normalization)
   */
  async createCustomer(data: Partial<CustomerEntity>, storeId: string): Promise<CustomerEntity> {
    // Check email doesn't already exist
    if (data.email) {
      const exists = await this.emailExists(data.email, storeId);
      if (exists) {
        throw new ConflictError('Email already in use');
      }
    }

    // Normalize email
    const normalized = data.email ? data.email.toLowerCase().trim() : '';

    // Generate UUID if not provided
    const { v4: uuidv4 } = await import('uuid');
    const customerId = data.id || uuidv4();

    const customer = this.repository.create({
      ...data,
      id: customerId,
      store_id: storeId,
      email_normalized: normalized,
      email_verified: false,
      status: 'active',
    });

    return this.save(customer);
  }

  /**
   * List all customers in store (active only)
   */
  async listByStore(
    storeId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ customers: CustomerEntity[]; total: number }> {
    try {
      const [customers, total] = await this.repository.findAndCount({
        where: {
          store_id: storeId,
          deleted_at: IsNull(),
        } as any,
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
        order: { created_at: 'DESC' } as any,
      });

      return { customers, total };
    } catch (error) {
      throw new Error(`Failed to list customers: ${(error as Error).message}`);
    }
  }

  /**
   * Mark email as verified
   */
  async verifyEmail(customerId: string, storeId: string): Promise<CustomerEntity> {
    return this.update(customerId, storeId, {
      email_verified: true,
      email_verified_at: new Date(),
    } as any);
  }

  /**
   * Update customer profile
   */
  async updateProfile(
    customerId: string,
    storeId: string,
    data: {
      first_name?: string;
      last_name?: string;
      phone?: string;
    }
  ): Promise<CustomerEntity> {
    return this.update(customerId, storeId, data as any);
  }
}

/** Flat row: customer plus purchase rollups, for the console list. */
export interface CustomerListRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  status: string;
  emailVerified: boolean;
  createdAt: Date;
  order_count: string;
  lifetime_value: string;
  last_order_at: Date | null;
}
