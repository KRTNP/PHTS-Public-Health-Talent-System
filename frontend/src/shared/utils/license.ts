export function isPermanentLicenseDate(value?: string | Date | null): boolean {
  if (!value) return false;

  if (value instanceof Date) {
    return value.getUTCFullYear() >= 9999;
  }

  const raw = String(value).trim();
  if (!raw) return false;

  // Sentinel from HR source for "lifetime/permanent" licenses.
  if (raw.startsWith("9999-12-31")) return true;

  const match = raw.match(/^(\d{4})-\d{2}-\d{2}/);
  if (!match) return false;
  return Number(match[1]) >= 9999;
}

