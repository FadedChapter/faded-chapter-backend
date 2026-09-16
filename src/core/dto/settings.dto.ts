/**
 * Settings response shapes.
 *
 * Allowlists, like every other DTO here: the store row carries an owner email
 * and internal status that the storefront has no business seeing, and the
 * settings row will grow columns that should not become public by accident.
 */

export interface StoreProfileRow {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  owner_email: string | null;
  owner_name: string | null;
  status: string;
  created_at: Date | string;
  currency: string | null;
  timezone: string | null;
  support_email: string | null;
  support_phone: string | null;
  settings_updated_at: Date | string | null;
}

export interface AdminStoreProfileDto {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  status: string;
  createdAt: string | null;
  owner: { name: string | null; email: string | null };
  currency: string;
  timezone: string;
  supportEmail: string | null;
  supportPhone: string | null;
  updatedAt: string | null;
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * Admin view of the store. Includes owner contact and status because an
 * administrator configuring the store needs both; neither appears in any
 * storefront response.
 */
export function toAdminStoreProfileDto(row: StoreProfileRow): AdminStoreProfileDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    domain: row.domain,
    status: row.status,
    createdAt: iso(row.created_at),
    owner: { name: row.owner_name, email: row.owner_email },
    currency: row.currency ?? 'INR',
    timezone: row.timezone ?? 'Asia/Kolkata',
    supportEmail: row.support_email,
    supportPhone: row.support_phone,
    updatedAt: iso(row.settings_updated_at),
  };
}
