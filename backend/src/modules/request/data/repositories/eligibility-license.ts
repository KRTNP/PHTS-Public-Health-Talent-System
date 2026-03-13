export type EligibilityLicenseStatusFilter = "active" | "expiring" | "expired" | null;

export function buildLatestLicenseJoinSql(): string {
  return `
    LEFT JOIN (
      SELECT
        ranked.citizen_id,
        ranked.status AS latest_license_status,
        ranked.valid_from AS latest_license_valid_from,
        ranked.valid_until AS latest_license_valid_until
      FROM (
        SELECT
          l.*,
          ROW_NUMBER() OVER (
            PARTITION BY l.citizen_id
            ORDER BY l.valid_until DESC, l.valid_from DESC, l.license_id DESC
          ) AS rn
        FROM emp_licenses l
      ) ranked
      WHERE ranked.rn = 1
    ) lic ON lic.citizen_id = e.citizen_id
  `;
}

export function buildEligibilityLicenseStatusWhere(
  licenseStatus: EligibilityLicenseStatusFilter,
  expiringDays: number,
  nowExpr = "NOW()",
): { clause: string | null; params: Array<number> } {
  if (licenseStatus === "expired") {
    return {
      clause:
        "(lic.citizen_id IS NULL OR (lic.latest_license_status IS NOT NULL AND UPPER(lic.latest_license_status) <> 'ACTIVE') OR lic.latest_license_valid_until < DATE(" +
        nowExpr +
        "))",
      params: [],
    };
  }

  if (licenseStatus === "expiring") {
    return {
      clause:
        "(lic.citizen_id IS NOT NULL AND (lic.latest_license_status IS NULL OR UPPER(lic.latest_license_status) = 'ACTIVE') AND lic.latest_license_valid_until >= DATE(" +
        nowExpr +
        ") AND lic.latest_license_valid_until <= DATE_ADD(DATE(" +
        nowExpr +
        "), INTERVAL ? DAY))",
      params: [expiringDays],
    };
  }

  if (licenseStatus === "active") {
    return {
      clause:
        "(lic.citizen_id IS NOT NULL AND (lic.latest_license_status IS NULL OR UPPER(lic.latest_license_status) = 'ACTIVE') AND (lic.latest_license_valid_until IS NULL OR lic.latest_license_valid_until > DATE_ADD(DATE(" +
        nowExpr +
        "), INTERVAL ? DAY)))",
      params: [expiringDays],
    };
  }

  return { clause: null, params: [] };
}
