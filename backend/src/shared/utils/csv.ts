const DANGEROUS_CSV_PREFIX_PATTERN = /^[=+\-@\t\r]/;

export const toSafeCsvCell = (
  value: string | number | null | undefined,
): string => {
  const normalized = value === null || value === undefined ? "" : String(value);
  if (!normalized) return normalized;
  if (DANGEROUS_CSV_PREFIX_PATTERN.test(normalized)) {
    return `'${normalized}`;
  }
  return normalized;
};

export const escapeCsvCell = (
  value: string | number | null | undefined,
): string => {
  const normalized = toSafeCsvCell(value);
  if (
    normalized.includes(",") ||
    normalized.includes('"') ||
    normalized.includes("\n")
  ) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
};
