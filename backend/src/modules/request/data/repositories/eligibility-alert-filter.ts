export type EligibilityAlertFilter =
  | "any"
  | "error"
  | "no-license"
  | "duplicate"
  | "upcoming-change"
  | null;

export const buildEligibilityAlertWhere = (
  alertFilter: EligibilityAlertFilter,
  expiringDays: number,
): { clause: string; params: Array<number> } => {
  switch (alertFilter) {
    case "any":
      return {
        clause: `(
          lic.citizen_id IS NULL
          OR (lic.latest_license_status IS NOT NULL AND UPPER(lic.latest_license_status) <> 'ACTIVE')
          OR lic.latest_license_valid_until < DATE(NOW())
          OR (
            lic.latest_license_valid_until >= DATE(NOW())
            AND lic.latest_license_valid_until <= DATE_ADD(DATE(NOW()), INTERVAL ? DAY)
          )
          OR COALESCE(elig_dup.active_eligibility_count, 0) > 1
          OR upcoming_change.upcoming_change_type IS NOT NULL
          OR (ep.original_status IS NOT NULL AND ep.original_status REGEXP 'ลา|ลาออก|เกษีย|ศึกษาต่อ|พ้นสภาพ|ไม่ปฏิบัติ|พักงาน')
        )`,
        params: [expiringDays],
      };
    case "error":
      return {
        clause: `(
          lic.citizen_id IS NULL
          OR (lic.latest_license_status IS NOT NULL AND UPPER(lic.latest_license_status) <> 'ACTIVE')
          OR lic.latest_license_valid_until < DATE(NOW())
          OR COALESCE(elig_dup.active_eligibility_count, 0) > 1
        )`,
        params: [],
      };
    case "no-license":
      return {
        clause: "(lic.citizen_id IS NULL)",
        params: [],
      };
    case "duplicate":
      return {
        clause: "(COALESCE(elig_dup.active_eligibility_count, 0) > 1)",
        params: [],
      };
    case "upcoming-change":
      return {
        clause: "(upcoming_change.upcoming_change_type IS NOT NULL)",
        params: [],
      };
    default:
      return { clause: "", params: [] };
  }
};
