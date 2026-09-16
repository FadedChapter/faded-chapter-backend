/**
 * Storefront catalogue — disclosure boundary.
 *
 * This endpoint is unauthenticated: anyone on the internet can read it. The
 * public catalogue endpoint it replaces returned product rows verbatim, which
 * is how store_id, created_by, deleted_at and metadata ended up readable by
 * anonymous callers.
 *
 * The tests below are about what a shopper is *not* told. Exact stock is the
 * interesting case: the storefront genuinely needs a number — it caps the
 * quantity selector and says "Only N left" — so the answer is not to withhold
 * it entirely but to cap it, which these assert.
 */

import { describe, it, expect } from 'vitest';
import {
  toStorefrontCatalogue,
  type ImageRow,
  type ProductRow,
  type VariantRow,
} from '../../core/dto/storefront-catalog.dto';

const product: ProductRow = {
  id: 'p1',
  slug: 'heavyweight-crewneck',
  name: 'The Heavyweight Crewneck',
  description: 'A 400gsm loopback crewneck.',
  collection: 'Core',
  category: 'tops',
  department: 'unisex',
  pillar: 'every-day',
  size_system_id: null,
  material: '100% Cotton',
  fit: 'Relaxed',
  style_tags: ['essentials'],
  style_with: ['straight-trouser'],
  price_tier: 'core',
  badge: 'new',
  merchandising_priority: 85,
  released_at: new Date('2026-01-01T00:00:00.000Z'),
};

const variant = (quantity: number, id = 'v1'): VariantRow => ({
  id,
  product_id: 'p1',
  price: '5900.00',
  attributes: { colour: 'Bone', size: 'M', impactColourFamilyId: 'grey' },
  quantity_available: quantity,
});

const image: ImageRow = {
  product_id: 'p1',
  url: 'https://example.test/a.jpg',
  alt_text: 'The Heavyweight Crewneck',
  colour: null,
  role: 'primary',
  width: 800,
  height: 1000,
  display_order: 0,
};

describe('the catalogue never carries internal columns', () => {
  it('omits everything the products table knows but a shopper must not', () => {
    const [result] = toStorefrontCatalogue(
      [{ ...product, ...({ store_id: 'store-1', created_by: 'user-1', deleted_at: null, metadata: { internal: true } } as object) } as ProductRow],
      [variant(10)],
      [image],
    );

    const serialised = JSON.stringify(result);
    for (const forbidden of ['store_id', 'created_by', 'deleted_at', 'metadata', 'cost', 'quantity_available']) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  it('exposes no key beyond the declared shape', () => {
    const [result] = toStorefrontCatalogue([product], [variant(10)], [image]);

    expect(Object.keys(result).sort()).toEqual(
      [
        'badge', 'category', 'collection', 'department', 'description', 'fit', 'id',
        'images', 'material', 'merchandisingPriority', 'name', 'pillar', 'priceTier',
        'releasedAt', 'slug', 'styleTags', 'styleWith', 'variants',
      ].sort(),
    );
  });
});

describe('stock is reported, but capped', () => {
  it('is exact while genuinely low, so "Only N left" can be truthful', () => {
    const [result] = toStorefrontCatalogue([product], [variant(4)], [image]);
    expect(result.variants[0].stock).toBe(4);
  });

  it('caps a large holding rather than publishing it', () => {
    // 5000 units in the warehouse is commercially sensitive; the shopper is
    // told 99, which is already the most the quantity selector offers.
    const [result] = toStorefrontCatalogue([product], [variant(5000)], [image]);
    expect(result.variants[0].stock).toBe(99);
    expect(result.variants[0].availability).toBe('in_stock');
  });

  it('never reports a negative holding', () => {
    const [result] = toStorefrontCatalogue([product], [variant(-5)], [image]);
    expect(result.variants[0].stock).toBe(0);
    expect(result.variants[0].availability).toBe('out_of_stock');
  });
});

describe('availability bands', () => {
  it.each([
    [0, 'out_of_stock'],
    [1, 'low_stock'],
    [3, 'low_stock'],
    [4, 'in_stock'],
  ])('reports %i units as %s', (quantity, expected) => {
    const [result] = toStorefrontCatalogue([product], [variant(quantity)], [image]);
    expect(result.variants[0].availability).toBe(expected);
  });
});

describe('assembly', () => {
  it('groups images by colour and keeps the product-level pair', () => {
    const [result] = toStorefrontCatalogue(
      [product],
      [variant(5)],
      [
        image,
        { ...image, role: 'hover', url: 'https://example.test/b.jpg', display_order: 1 },
        { ...image, colour: 'Bone', role: 'primary', url: 'https://example.test/bone.jpg' },
        { ...image, colour: 'Bone', role: 'gallery', url: 'https://example.test/bone-2.jpg', display_order: 2 },
      ],
    );

    expect(result.images.primary.src).toBe('https://example.test/a.jpg');
    expect(result.images.hover.src).toBe('https://example.test/b.jpg');
    expect(result.images.byColour?.['Bone']?.primary.src).toBe('https://example.test/bone.jpg');
    expect(result.images.byColour?.['Bone']?.gallery?.[0]?.src).toBe('https://example.test/bone-2.jpg');
  });

  it('falls back to the primary image rather than emitting a broken hover', () => {
    const [result] = toStorefrontCatalogue([product], [variant(5)], [image]);
    expect(result.images.hover.src).toBe(result.images.primary.src);
  });

  it('parses jsonb arrays whether they arrive parsed or as text', () => {
    const [asText] = toStorefrontCatalogue(
      [{ ...product, style_tags: '["essentials","layering"]' }],
      [variant(5)],
      [image],
    );
    expect(asText.styleTags).toEqual(['essentials', 'layering']);
  });

  it('keeps a product with no variants rather than dropping it', () => {
    const [result] = toStorefrontCatalogue([product], [], [image]);
    expect(result.variants).toEqual([]);
    expect(result.slug).toBe('heavyweight-crewneck');
  });
});
