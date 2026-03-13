import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import {
  DB_HEAD_SCOPE_ROLE_DEPT,
  DB_HEAD_SCOPE_ROLE_SQL_LIST,
  DB_HEAD_SCOPE_ROLE_WARD,
} from '@/shared/utils/head-scope-category.js';

type SummaryRow = RowDataPacket & {
  total_users: number;
  protected_users: number;
  would_update: number;
  blocked_by_missing_scope: number;
  missing_source: number;
};

type CoverageRow = RowDataPacket & {
  has_profile: number;
  has_support: number;
  has_both: number;
};

type QualityRow = RowDataPacket & {
  profile_total: number;
  profile_empty_special_position: number;
  profile_has_dept_scope: number;
  profile_has_ward_scope: number;
  profile_has_assistant: number;
  profile_mixed_scope_assistant: number;
};

type DiffRow = RowDataPacket & {
  current_role: string;
  expected_role: string;
  cnt: number;
};

const EXPECTED_ROLE_CASE_SQL = `
  CASE
    WHEN COALESCE(p.special_position, '') LIKE '%หัวหน้ากลุ่ม%'
      AND COALESCE(p.special_position, '') NOT LIKE '%รองหัวหน้า%'
      AND COALESCE(p.special_position, '') NOT LIKE '%ผู้ช่วยหัวหน้า%'
    THEN '${DB_HEAD_SCOPE_ROLE_DEPT}'
    WHEN COALESCE(p.special_position, '') LIKE '%หัวหน้าตึก%'
      AND COALESCE(p.special_position, '') NOT LIKE '%รองหัวหน้าตึก%'
      AND COALESCE(p.special_position, '') NOT LIKE '%ผู้ช่วยหัวหน้าตึก%'
      AND COALESCE(p.special_position, '') NOT LIKE '%รองหัวหน้า%'
      AND COALESCE(p.special_position, '') NOT LIKE '%ผู้ช่วยหัวหน้า%'
    THEN '${DB_HEAD_SCOPE_ROLE_WARD}'
    ELSE 'USER'
  END
`;

const ROLE_DERIVED_CTE_SQL = `
  WITH role_derived AS (
    SELECT
      u.role AS current_role,
      p.citizen_id AS profile_citizen_id,
      s.citizen_id AS support_citizen_id,
      (${EXPECTED_ROLE_CASE_SQL}) COLLATE utf8mb4_unicode_ci AS expected_role,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM special_position_scope_map sp
          WHERE CAST(sp.citizen_id AS BINARY) = CAST(u.citizen_id AS BINARY)
            AND sp.role = (${EXPECTED_ROLE_CASE_SQL})
            AND sp.is_active = 1
        ) THEN 1
        ELSE 0
      END AS has_active_scope
    FROM users u
    LEFT JOIN emp_profiles p ON CAST(p.citizen_id AS BINARY) = CAST(u.citizen_id AS BINARY)
    LEFT JOIN emp_support_staff s
      ON p.citizen_id IS NULL
     AND CAST(s.citizen_id AS BINARY) = CAST(u.citizen_id AS BINARY)
  ),
  role_effective AS (
    SELECT
      current_role,
      profile_citizen_id,
      support_citizen_id,
      expected_role,
      has_active_scope,
      CASE
        WHEN expected_role IN (${DB_HEAD_SCOPE_ROLE_SQL_LIST}) AND has_active_scope = 0 THEN 'USER'
        ELSE expected_role
      END AS effective_expected_role
    FROM role_derived
  )
`;

export async function getRoleMappingDiagnostics(conn: PoolConnection) {
  const [summaryRows] = await conn.query<SummaryRow[]>(
    `
      ${ROLE_DERIVED_CTE_SQL}
      SELECT
        COUNT(*) AS total_users,
        SUM(CASE WHEN current_role IN ('ADMIN','PTS_OFFICER') THEN 1 ELSE 0 END) AS protected_users,
        SUM(
          CASE
            WHEN current_role IN ('ADMIN','PTS_OFFICER') THEN 0
            WHEN effective_expected_role = 'USER'
              AND current_role <> 'USER'
              AND current_role NOT IN (${DB_HEAD_SCOPE_ROLE_SQL_LIST}) THEN 0
            WHEN BINARY current_role <> BINARY effective_expected_role THEN 1
            ELSE 0
          END
        ) AS would_update,
        SUM(
          CASE
            WHEN expected_role IN (${DB_HEAD_SCOPE_ROLE_SQL_LIST}) AND has_active_scope = 0 THEN 1
            ELSE 0
          END
        ) AS blocked_by_missing_scope,
        SUM(CASE WHEN profile_citizen_id IS NULL AND support_citizen_id IS NULL THEN 1 ELSE 0 END) AS missing_source
      FROM role_effective
    `,
  );

  const [coverageRows] = await conn.query<CoverageRow[]>(
    `
      SELECT
        SUM(CASE WHEN p.citizen_id IS NOT NULL THEN 1 ELSE 0 END) AS has_profile,
        SUM(CASE WHEN s.citizen_id IS NOT NULL THEN 1 ELSE 0 END) AS has_support,
        SUM(CASE WHEN p.citizen_id IS NOT NULL AND s.citizen_id IS NOT NULL THEN 1 ELSE 0 END) AS has_both
      FROM users u
      LEFT JOIN emp_profiles p ON CAST(p.citizen_id AS BINARY) = CAST(u.citizen_id AS BINARY)
      LEFT JOIN emp_support_staff s ON CAST(s.citizen_id AS BINARY) = CAST(u.citizen_id AS BINARY)
    `,
  );

  const [qualityRows] = await conn.query<QualityRow[]>(
    `
      SELECT
        COUNT(*) AS profile_total,
        SUM(CASE WHEN special_position IS NULL OR TRIM(special_position) = '' THEN 1 ELSE 0 END) AS profile_empty_special_position,
        SUM(CASE WHEN special_position LIKE '%หัวหน้ากลุ่มงาน%' OR special_position LIKE '%หัวหน้ากลุ่มภารกิจ%' THEN 1 ELSE 0 END) AS profile_has_dept_scope,
        SUM(CASE WHEN special_position LIKE '%หัวหน้าตึก%' THEN 1 ELSE 0 END) AS profile_has_ward_scope,
        SUM(CASE WHEN special_position LIKE '%รองหัวหน้า%' OR special_position LIKE '%ผู้ช่วยหัวหน้า%' THEN 1 ELSE 0 END) AS profile_has_assistant,
        SUM(
          CASE WHEN (special_position LIKE '%หัวหน้ากลุ่ม%' OR special_position LIKE '%หัวหน้าตึก%')
              AND (special_position LIKE '%รองหัวหน้า%' OR special_position LIKE '%ผู้ช่วยหัวหน้า%')
          THEN 1 ELSE 0 END
        ) AS profile_mixed_scope_assistant
      FROM emp_profiles
    `,
  );

  const [diffRows] = await conn.query<DiffRow[]>(
    `
      ${ROLE_DERIVED_CTE_SQL}
      SELECT d.current_role, d.expected_role, COUNT(*) AS cnt
      FROM (
        SELECT
          current_role,
          effective_expected_role AS expected_role
        FROM role_effective
        WHERE current_role NOT IN ('ADMIN','PTS_OFFICER')
      ) d
      WHERE BINARY d.current_role <> BINARY d.expected_role
        AND NOT (
          d.expected_role = 'USER'
          AND d.current_role <> 'USER'
          AND d.current_role NOT IN (${DB_HEAD_SCOPE_ROLE_SQL_LIST})
        )
      GROUP BY d.current_role, d.expected_role
      ORDER BY cnt DESC
      LIMIT 20
    `,
  );

  return {
    summary: summaryRows[0] ?? {},
    coverage: coverageRows[0] ?? {},
    quality: qualityRows[0] ?? {},
    differences: diffRows,
  };
}
