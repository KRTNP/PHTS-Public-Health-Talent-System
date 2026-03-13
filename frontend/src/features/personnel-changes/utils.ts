import { toBuddhistYear } from '@/shared/utils/thai-locale';

function parseIsoDateParts(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
}

export function getFiscalYearFromDate(value: string): number | null {
  const parts = parseIsoDateParts(value);
  if (!parts) return null;

  return parts.month >= 10 ? toBuddhistYear(parts.year + 1) : toBuddhistYear(parts.year);
}

export function buildPersonnelChangeFiscalYearOptions(
  dates: string[],
  fallbackYear?: number,
): number[] {
  const years = new Set<number>();

  dates.forEach((date) => {
    const fiscalYear = getFiscalYearFromDate(date);
    if (fiscalYear) years.add(fiscalYear);
  });

  if (typeof fallbackYear === 'number' && Number.isFinite(fallbackYear)) {
    years.add(fallbackYear);
  }

  return Array.from(years).sort((a, b) => b - a);
}
