/**
 * Workforce Compliance Module - License Entity Definitions
 *
 * TypeScript interfaces for license compliance data
 */

// ─── Alert bucket types ───────────────────────────────────────────────────────

export type AlertBucket = "expired" | "30" | "60" | "90";

// ─── License compliance row ───────────────────────────────────────────────────

export interface LicenseComplianceRow {
  citizen_id: string;
  full_name: string;
  position_name: string;
  profession_code?: string | null;
  license_expiry: string | null;
  days_left: number | null;
  bucket: AlertBucket;
  last_notified_at?: string | null;
}

// ─── License compliance summary ───────────────────────────────────────────────

export interface LicenseComplianceSummary {
  expired: number;
  expiring_30: number;
  expiring_60: number;
  expiring_90: number;
  total: number;
}

export interface LicenseExpiryRow {
  citizen_id: string;
  full_name: string;
  position_name: string;
  profession_code?: string | null;
  effective_expiry: string | null;
  days_left: number | null;
}
