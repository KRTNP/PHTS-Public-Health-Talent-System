import { Request } from "express";
import type { EligibilityAlertFilter } from "@/modules/request/data/repositories/eligibility-alert-filter.js";
import type { EligibilityLicenseStatusFilter } from "@/modules/request/data/repositories/eligibility-license.js";

const ELIGIBILITY_FILTER_KEYS = [
  "page",
  "limit",
  "profession_code",
  "search",
  "rate_group",
  "department",
  "sub_department",
  "license_status",
  "alert_filter",
] as const;

export type ParsedEligibilityFilters = {
  page: number;
  limit: number;
  professionCode: string;
  search: string | null;
  rateGroup: string | null;
  department: string | null;
  subDepartment: string | null;
  licenseStatus: EligibilityLicenseStatusFilter;
  alertFilter: EligibilityAlertFilter;
};

const LICENSE_STATUS_VALUES: ReadonlyArray<NonNullable<EligibilityLicenseStatusFilter>> =
  ["active", "expiring", "expired"];
const ALERT_FILTER_VALUES: ReadonlyArray<NonNullable<EligibilityAlertFilter>> =
  ["any", "error", "no-license", "duplicate", "upcoming-change"];

const isEligibilityLicenseStatusFilter = (
  value: string,
): value is NonNullable<EligibilityLicenseStatusFilter> =>
  LICENSE_STATUS_VALUES.includes(
    value as NonNullable<EligibilityLicenseStatusFilter>,
  );

const isEligibilityAlertFilter = (
  value: string,
): value is NonNullable<EligibilityAlertFilter> =>
  ALERT_FILTER_VALUES.includes(value as NonNullable<EligibilityAlertFilter>);

export const hasEligibilityFilters = (query: Request["query"]): boolean =>
  ELIGIBILITY_FILTER_KEYS.some((key) => typeof query[key] !== "undefined");

export const readOptionalQueryString = (
  query: Request["query"],
  key: keyof Request["query"],
): string | null => {
  const value = query[key];
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const parseEligibilityFilters = (
  query: Request["query"],
): ParsedEligibilityFilters => {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  const professionCodeRaw =
    readOptionalQueryString(query, "profession_code") ?? "ALL";
  const professionCode =
    professionCodeRaw.toUpperCase() === "ALL"
      ? "ALL"
      : professionCodeRaw.toUpperCase();

  const licenseStatusRaw =
    typeof query.license_status === "string" ? query.license_status : null;
  const alertFilterRaw =
    typeof query.alert_filter === "string" ? query.alert_filter : null;

  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20,
    professionCode,
    search: readOptionalQueryString(query, "search"),
    rateGroup: readOptionalQueryString(query, "rate_group"),
    department: readOptionalQueryString(query, "department"),
    subDepartment: readOptionalQueryString(query, "sub_department"),
    licenseStatus:
      licenseStatusRaw && isEligibilityLicenseStatusFilter(licenseStatusRaw)
        ? licenseStatusRaw
        : null,
    alertFilter:
      alertFilterRaw && isEligibilityAlertFilter(alertFilterRaw)
        ? alertFilterRaw
        : null,
  };
};

export const parsePositiveInt = (value: unknown): number | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
