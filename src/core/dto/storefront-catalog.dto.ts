/**
 * Storefront catalogue response shapes.
 *
 * This is the public face of the catalogue, and it is an allowlist for the same
 * reason every other DTO here is: the products table carries store_id,
 * created_by, deleted_at, metadata and cost-bearing variant columns, and the
 * existing public endpoint returned the rows verbatim to anonymous callers.
 *
 * What a shopper is told about stock is deliberately coarser than what an
 * operator is told. The admin sees exact counts because it has to reorder
 * against them; the storefront sees a band, because the precise number is
 * commercially sensitive and a customer only needs to know whether they can buy
 * it and whether to hurry.
 */

/** Threshold below which the storefront says "low" rather than a number. */
const LOW_STOCK_THRESHOLD = 3;

/**
 * Ceiling on the stock figure sent to shoppers.
 *
 * The storefront genuinely needs a number, for two things: it caps the quantity
 * selector at min(stock, 99), and the product page says "Only N left" below 10.
 * Sending the raw count would publish exact inventory for every product.
 *
 * Capping at the cart's own ceiling gives both features everything they use — a
 * count at or under ten is exact, and anything above reports "at least 99",
 * which is already the most the selector would offer.
 */
const REPORTED_STOCK_CEILING = 99;

export interface StorefrontImage {
  src: string;
  width: number;
  height: number;
  alt: string;
}

export interface StorefrontVariant {
  id: string;
  size: string;
  colour: string;
  price: number;
  currency: string;
  /** Capped at REPORTED_STOCK_CEILING — exact only while genuinely low. */
  stock: number;
  availability: 'in_stock' | 'low_stock' | 'out_of_stock';
  impactColourFamilyId?: string;
}

export interface StorefrontProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  collection: string;
  category: string;
  department: string;
  pillar?: string;
  sizeSystemId?: string;
  material: string;
  fit: string;
  styleTags: string[];
  priceTier: string;
  badge?: string | null;
  merchandisingPriority: number;
  releasedAt: number;
  styleWith: string[];
  images: {
    primary: StorefrontImage;
    hover: StorefrontImage;
    byColour?: Record<
      string,
      { primary: StorefrontImage; hover: StorefrontImage; gallery?: StorefrontImage[] }
    >;
  };
  variants: StorefrontVariant[];
}

export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  collection: string | null;
  category: string | null;
  department: string | null;
  pillar: string | null;
  size_system_id: string | null;
  material: string | null;
  fit: string | null;
  style_tags: unknown;
  style_with: unknown;
  price_tier: string | null;
  badge: string | null;
  merchandising_priority: number | null;
  released_at: Date | string | null;
}

export interface VariantRow {
  id: string;
  product_id: string;
  price: string | number;
  attributes: Record<string, unknown> | null;
  quantity_available: string | number | null;
}

export interface ImageRow {
  product_id: string;
  url: string;
  alt_text: string | null;
  colour: string | null;
  role: string;
  width: number | null;
  height: number | null;
  display_order: number;
}

function num(value: unknown): number {
  const n = typeof value === 'string' ? Number.parseFloat(value) : (value as number);
  return Number.isFinite(n) ? n : 0;
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

function image(row: ImageRow): StorefrontImage {
  return {
    src: row.url,
    // Dimensions are sent so the markup can reserve space. Falling back to the
    // catalogue's 4:5 card ratio is better than omitting them and letting the
    // page reflow around a late image.
    width: row.width ?? 800,
    height: row.height ?? 1000,
    alt: row.alt_text ?? '',
  };
}

function availability(quantity: number): StorefrontVariant['availability'] {
  if (quantity <= 0) return 'out_of_stock';
  return quantity <= LOW_STOCK_THRESHOLD ? 'low_stock' : 'in_stock';
}

/**
 * Assemble the storefront view of a catalogue.
 *
 * Takes the three result sets whole rather than querying per product: a
 * catalogue page needs every product with its variants and images, and doing
 * that one product at a time is the N+1 that makes a shop feel slow.
 */
export function toStorefrontCatalogue(
  products: ProductRow[],
  variants: VariantRow[],
  images: ImageRow[],
): StorefrontProduct[] {
  const variantsByProduct = new Map<string, VariantRow[]>();
  for (const v of variants) {
    const bucket = variantsByProduct.get(v.product_id) ?? [];
    bucket.push(v);
    variantsByProduct.set(v.product_id, bucket);
  }

  const imagesByProduct = new Map<string, ImageRow[]>();
  for (const i of images) {
    const bucket = imagesByProduct.get(i.product_id) ?? [];
    bucket.push(i);
    imagesByProduct.set(i.product_id, bucket);
  }

  return products.map((p) => {
    const rows = imagesByProduct.get(p.id) ?? [];
    const productLevel = rows.filter((r) => r.colour === null);
    const primary = productLevel.find((r) => r.role === 'primary');
    const hover = productLevel.find((r) => r.role === 'hover');

    const byColour: NonNullable<StorefrontProduct['images']['byColour']> = {};
    for (const row of rows.filter((r) => r.colour !== null)) {
      const colour = row.colour as string;
      const entry = (byColour[colour] ??= {
        primary: image(row),
        hover: image(row),
      });
      if (row.role === 'primary') entry.primary = image(row);
      else if (row.role === 'hover') entry.hover = image(row);
      else (entry.gallery ??= []).push(image(row));
    }

    const fallback: StorefrontImage = primary
      ? image(primary)
      : { src: '', width: 800, height: 1000, alt: p.name };

    return {
      id: p.slug,
      slug: p.slug,
      name: p.name,
      description: p.description ?? '',
      collection: p.collection ?? '',
      category: p.category ?? '',
      department: p.department ?? '',
      ...(p.pillar ? { pillar: p.pillar } : {}),
      ...(p.size_system_id ? { sizeSystemId: p.size_system_id } : {}),
      material: p.material ?? '',
      fit: p.fit ?? '',
      styleTags: list(p.style_tags),
      priceTier: p.price_tier ?? '',
      badge: p.badge ?? null,
      merchandisingPriority: p.merchandising_priority ?? 0,
      releasedAt: p.released_at ? new Date(p.released_at).getTime() : 0,
      styleWith: list(p.style_with),
      images: {
        primary: fallback,
        hover: hover ? image(hover) : fallback,
        ...(Object.keys(byColour).length > 0 ? { byColour } : {}),
      },
      variants: (variantsByProduct.get(p.id) ?? []).map((v) => {
        const attrs = (v.attributes ?? {}) as Record<string, string>;
        const quantity = num(v.quantity_available);
        return {
          id: v.id,
          size: attrs['size'] ?? '',
          colour: attrs['colour'] ?? '',
          price: num(v.price),
          currency: 'INR',
          stock: Math.min(Math.max(quantity, 0), REPORTED_STOCK_CEILING),
          availability: availability(quantity),
          ...(attrs['impactColourFamilyId']
            ? { impactColourFamilyId: attrs['impactColourFamilyId'] }
            : {}),
        };
      }),
    };
  });
}
