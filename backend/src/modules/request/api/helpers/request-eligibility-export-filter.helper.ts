import { Request } from "express";
import type { EligibilityAlertFilter } from "@/modules/request/data/repositories/eligibility-alert-filter.js";
import type { EligibilityLicenseStatusFilter } from "@/modules/request/data/repositories/eligibility-license.js";

export type EligibilityExportFilters = {
  activeOnly: boolean;
  professionCode: string;
  search: string | null;
  rateGroup: string | null;
  department: string | null;
  subDepartment: string | null;
  licenseStatus: EligibilityLicenseStatusFilter;
  alertFilter: EligibilityAlertFilter;
};

export const parseEligibilityExportFilters = (
  query: Request["query"],
): EligibilityExportFilters => {
  const activeOnly = String(query.active_only ?? "1") !== "0";
  const professionCodeRaw =
    typeof query.profession_code === "string" ? query.profession_code : "ALL";
  const professionCode =
    professionCodeRaw.toUpperCase() === "ALL"
      ? "ALL"
      : professionCodeRaw.toUpperCase();
  const rawSearch = query.search;
  const search = typeof rawSearch === "string" ? rawSearch.trim() : null;
  const rateGroup =
    typeof query.rate_group === "string" ? query.rate_group.trim() : null;
  const department =
    typeof query.department === "string" ? query.department.trim() : null;
  const subDepartment =
    typeof query.sub_department === "string"
      ? query.sub_department.trim()
      : null;
  const licenseStatus =
    typeof query.license_status === "string" && query.license_status !== "all"
      ? (query.license_status as EligibilityLicenseStatusFilter)
      : null;
  const alertFilter =
    typeof query.alert_filter === "string" && query.alert_filter !== "all"
      ? (query.alert_filter as EligibilityAlertFilter)
      : null;

  return {
    activeOnly,
    professionCode,
    search,
    rateGroup,
    department,
    subDepartment,
    licenseStatus,
    alertFilter,
  };
};
