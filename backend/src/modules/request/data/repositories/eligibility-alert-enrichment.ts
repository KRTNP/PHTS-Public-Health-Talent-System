import { ELIGIBILITY_EXPIRING_DAYS } from "@/modules/request/contracts/request.constants.js";

export function buildActiveEligibilityCountJoinSql(): string {
  return `
    LEFT JOIN (
      SELECT
        citizen_id,
        COUNT(*) AS active_eligibility_count
      FROM req_eligibility
      WHERE is_active = 1
      GROUP BY citizen_id
    ) elig_dup ON elig_dup.citizen_id = e.citizen_id
  `;
}

export function buildUpcomingPersonnelChangeJoinSql(
  upcomingDays = ELIGIBILITY_EXPIRING_DAYS,
): string {
  return `
    LEFT JOIN (
      SELECT
        ranked.citizen_id,
        ranked.change_type AS upcoming_change_type,
        ranked.effective_date AS upcoming_change_effective_date
      FROM (
        SELECT
          change_rows.*,
          ROW_NUMBER() OVER (
            PARTITION BY change_rows.citizen_id
            ORDER BY
              change_rows.effective_date ASC,
              CASE change_rows.change_type
                WHEN 'RETIREMENT' THEN 1
                WHEN 'RESIGN' THEN 2
                WHEN 'TRANSFER_OUT' THEN 3
                ELSE 9
              END ASC
          ) AS rn
        FROM (
          SELECT
            CAST(citizen_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS citizen_id,
            CAST('RETIREMENT' AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS change_type,
            retire_date AS effective_date
          FROM emp_retirements
          WHERE retire_date >= CURDATE()
            AND retire_date <= DATE_ADD(CURDATE(), INTERVAL ${Number(upcomingDays)} DAY)

          UNION ALL

          SELECT
            CAST(citizen_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS citizen_id,
            CAST(movement_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS change_type,
            effective_date
          FROM emp_movements
          WHERE movement_type IN ('RESIGN', 'TRANSFER_OUT')
            AND effective_date >= CURDATE()
            AND effective_date <= DATE_ADD(CURDATE(), INTERVAL ${Number(upcomingDays)} DAY)
        ) change_rows
      ) ranked
      WHERE ranked.rn = 1
    ) upcoming_change ON upcoming_change.citizen_id = e.citizen_id
  `;
}
