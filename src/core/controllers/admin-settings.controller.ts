/**
 * Admin Settings Controller
 *
 * Phase 12: Store identity, operational defaults, and security posture.
 *
 * Authorisation is applied by the admin router before any handler runs
 * (authenticate → role → store-ownership → permission).
 *
 * Scope note: slug, domain and status are returned but not editable here.
 * Slug and domain are addressing — changing either breaks every existing link
 * and is a migration, not a settings toggle. Status controls whether the
 * storefront serves at all, which is too consequential to sit one mis-click
 * away from a phone number field.
 */

import { Request, Response } from 'express';
import { getDataSource } from '../database/postgres-data-source';
import { logError, logInfo } from '../logging/logger';
import { toAdminStoreProfileDto, type StoreProfileRow } from '../dto/settings.dto';
import { getSecurityPosture } from '../services/security-posture.service';

const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+0-9()\s-]{6,24}$/;
const MAX_NAME_LENGTH = 120;

/**
 * Valid IANA timezone names, from the runtime itself rather than a list we
 * maintain. An invalid timezone would silently corrupt every date the admin
 * console renders.
 */
function isValidTimezone(value: string): boolean {
  try {
    // Throws RangeError for an unknown zone.
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Real ISO 4217 codes, again from the runtime rather than a hand-kept list.
 *
 * The shape check alone was not enough: it accepted any three letters, so
 * "RUP" passed while the error message promised ISO 4217. A rejection message
 * that describes a stricter rule than the code applies is worse than no
 * message, because it is believed.
 */
const ISO_4217_CODES: ReadonlySet<string> = new Set(
  typeof (Intl as any).supportedValuesOf === 'function' ? (Intl as any).supportedValuesOf('currency') : [],
);

function isValidCurrency(value: string): boolean {
  if (!CURRENCY_PATTERN.test(value)) return false;
  // If the runtime cannot enumerate currencies, fall back to the shape check
  // rather than rejecting everything.
  return ISO_4217_CODES.size === 0 || ISO_4217_CODES.has(value);
}

interface UpdateBody {
  name?: unknown;
  currency?: unknown;
  timezone?: unknown;
  supportEmail?: unknown;
  supportPhone?: unknown;
}

export class AdminSettingsController {
  /** GET /settings/store — store identity and operational defaults. */
  async getStore(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const row = await this.loadProfile(storeId);

      if (!row) {
        res.status(404).json({ success: false, error: 'Store not found' });
        return;
      }

      res.status(200).json({ success: true, data: toAdminStoreProfileDto(row) });
    } catch (error) {
      logError('admin_settings_store_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to load store settings' });
    }
  }

  /** PATCH /settings/store — update editable store configuration. */
  async updateStore(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const body = (req.body ?? {}) as UpdateBody;

      const errors: string[] = [];
      const storeUpdates: Record<string, string> = {};
      const settingsUpdates: Record<string, string | null> = {};

      if (body.name !== undefined) {
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (!name || name.length > MAX_NAME_LENGTH) {
          errors.push(`name must be 1-${MAX_NAME_LENGTH} characters`);
        } else {
          storeUpdates['name'] = name;
        }
      }

      if (body.currency !== undefined) {
        const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : '';
        if (!isValidCurrency(currency)) {
          errors.push('currency must be a three-letter ISO 4217 code');
        } else {
          settingsUpdates['currency'] = currency;
        }
      }

      if (body.timezone !== undefined) {
        const timezone = typeof body.timezone === 'string' ? body.timezone.trim() : '';
        if (!timezone || !isValidTimezone(timezone)) {
          errors.push('timezone must be a valid IANA timezone name');
        } else {
          settingsUpdates['timezone'] = timezone;
        }
      }

      // Contact fields are clearable: an empty string means "remove it", which
      // is different from omitting the key entirely.
      if (body.supportEmail !== undefined) {
        const email = typeof body.supportEmail === 'string' ? body.supportEmail.trim() : '';
        if (email && !EMAIL_PATTERN.test(email)) {
          errors.push('supportEmail must be a valid email address');
        } else {
          settingsUpdates['support_email'] = email || null;
        }
      }

      if (body.supportPhone !== undefined) {
        const phone = typeof body.supportPhone === 'string' ? body.supportPhone.trim() : '';
        if (phone && !PHONE_PATTERN.test(phone)) {
          errors.push('supportPhone must be a valid phone number');
        } else {
          settingsUpdates['support_phone'] = phone || null;
        }
      }

      if (errors.length > 0) {
        res.status(400).json({ success: false, error: errors.join('; ') });
        return;
      }

      if (Object.keys(storeUpdates).length === 0 && Object.keys(settingsUpdates).length === 0) {
        res.status(400).json({ success: false, error: 'No supported fields to update' });
        return;
      }

      if (Object.keys(storeUpdates).length > 0) {
        const sets = Object.keys(storeUpdates).map((col, i) => `${col} = $${i + 2}`);
        await getDataSource().query(
          `UPDATE stores SET ${sets.join(', ')}, updated_at = now() WHERE id = $1`,
          [storeId, ...Object.values(storeUpdates)],
        );
      }

      if (Object.keys(settingsUpdates).length > 0) {
        const cols = Object.keys(settingsUpdates);
        const sets = cols.map((col, i) => `${col} = $${i + 2}`);
        // Upsert: a store created before this table existed has no settings row.
        await getDataSource().query(
          `INSERT INTO store_settings (store_id, ${cols.join(', ')})
           VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(', ')})
           ON CONFLICT (store_id) DO UPDATE SET ${sets.join(', ')}, updated_at = now()`,
          [storeId, ...Object.values(settingsUpdates)],
        );
      }

      // Published for the audit middleware, which otherwise has no uuid to
      // attach this change to beyond the store scope itself.
      res.locals['auditRecordId'] = storeId;

      logInfo('admin_settings_updated', {
        storeId,
        actorId: req.auth?.userId,
        fields: [...Object.keys(storeUpdates), ...Object.keys(settingsUpdates)],
      });

      const row = await this.loadProfile(storeId);
      res.status(200).json({ success: true, data: row ? toAdminStoreProfileDto(row) : null });
    } catch (error) {
      logError('admin_settings_update_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to update store settings' });
    }
  }

  /** GET /settings/security — what this deployment enforces, and what it does not. */
  async getSecurity(req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json({ success: true, data: await getSecurityPosture() });
    } catch (error) {
      logError('admin_settings_security_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to load security posture' });
    }
  }

  private async loadProfile(storeId: string): Promise<StoreProfileRow | null> {
    const rows = await getDataSource().query(
      `SELECT s.id, s.name, s.slug, s.domain, s.owner_email, s.owner_name, s.status,
              s.created_at,
              ss.currency, ss.timezone, ss.support_email, ss.support_phone,
              ss.updated_at AS settings_updated_at
         FROM stores s
         LEFT JOIN store_settings ss ON ss.store_id = s.id
        WHERE s.id = $1`,
      [storeId],
    );
    return rows?.[0] ?? null;
  }
}
