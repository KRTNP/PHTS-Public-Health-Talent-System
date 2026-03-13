import { getConnection } from "@config/database.js";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";

type IndexSpec = {
  table: string;
  name: string;
  columns: string[];
  unique?: boolean;
};

type CitizenColumnSpec = {
  table: string;
  nullable: boolean;
  column?: string;
};

const STAGE_KEYS = [
  "sync-employee-profiles",
  "sync-support-staff",
  "sync-users",
  "sync-signatures",
  "sync-licenses-quotas",
  "sync-leaves",
  "sync-movements",
  "sync-special-position-scopes",
  "assign-roles",
  "refresh-access-review",
] as const;

const PHASE1_INDEXES: IndexSpec[] = [
  {
    table: "hrms_sync_stage_runs",
    name: "idx_hrms_sync_stage_runs_batch_run",
    columns: ["batch_id", "stage_run_id"],
  },
  {
    table: "hrms_transform_logs",
    name: "idx_hrms_transform_logs_applied_at",
    columns: ["applied_at"],
  },
  {
    table: "hrms_data_issues",
    name: "idx_hrms_data_issues_created_at",
    columns: ["created_at"],
  },
  {
    table: "hrms_data_issues",
    name: "idx_hrms_data_issues_code_batch_table",
    columns: ["issue_code", "batch_id", "target_table"],
  },
  {
    table: "user_sync_state_audits",
    name: "idx_user_sync_audits_batch_audit",
    columns: ["sync_batch_id", "audit_id"],
  },
  {
    table: "user_sync_state_audits",
    name: "idx_user_sync_audits_citizen_audit",
    columns: ["citizen_id", "audit_id"],
  },
  {
    table: "user_sync_state_audits",
    name: "idx_user_sync_audits_action_audit",
    columns: ["action", "audit_id"],
  },
  {
    table: "user_sync_state_audits",
    name: "idx_user_sync_audits_created_at",
    columns: ["created_at"],
  },
];

const PHASE2_CITIZEN_COLUMNS: CitizenColumnSpec[] = [
  { table: "users", nullable: false },
  { table: "emp_profiles", nullable: false },
  { table: "emp_support_staff", nullable: false },
  { table: "emp_licenses", nullable: false },
  { table: "leave_quotas", nullable: false },
  { table: "leave_records", nullable: false },
  { table: "emp_movements", nullable: false },
  { table: "sig_images", nullable: true },
  { table: "user_sync_state_audits", nullable: false },
  { table: "hrms_sync_batches", nullable: true, column: "target_citizen_id" },
];

const CHECK_TARGETS = [
  { table: "users", constraint: "chk_users_citizen_id_13" },
  { table: "emp_profiles", constraint: "chk_emp_profiles_citizen_id_13" },
  { table: "emp_support_staff", constraint: "chk_emp_support_staff_citizen_id_13" },
  { table: "emp_licenses", constraint: "chk_emp_licenses_citizen_id_13" },
  { table: "leave_quotas", constraint: "chk_leave_quotas_citizen_id_13" },
  { table: "emp_movements", constraint: "chk_emp_movements_citizen_id_13" },
  {
    table: "user_sync_state_audits",
    constraint: "chk_user_sync_state_audits_citizen_id_13",
  },
] as const;

const hasIndex = async (
  conn: PoolConnection,
  spec: IndexSpec,
): Promise<boolean> => {
  const [rows] = await conn.query<RowDataPacket[]>(
    `
      SELECT INDEX_NAME,
             NON_UNIQUE,
             GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      GROUP BY INDEX_NAME, NON_UNIQUE
    `,
    [spec.table],
  );
  const expectedCols = spec.columns.join(",");
  return rows.some((row) => {
    const name = String(row.INDEX_NAME);
    const nonUnique = Number(row.NON_UNIQUE);
    const cols = String(row.cols ?? "");
    const uniqueMatches = spec.unique ? nonUnique === 0 : true;
    return name === spec.name && uniqueMatches && cols === expectedCols;
  });
};

const hasConstraint = async (
  conn: PoolConnection,
  table: string,
  constraintName: string,
): Promise<boolean> => {
  const [rows] = await conn.query<RowDataPacket[]>(
    `
      SELECT CONSTRAINT_NAME
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND CONSTRAINT_NAME = ?
    `,
    [table, constraintName],
  );
  return rows.length > 0;
};

const getCitizenColumnMeta = async (
  conn: PoolConnection,
  input: CitizenColumnSpec,
): Promise<RowDataPacket | null> => {
  const columnName = input.column ?? "citizen_id";
  const [rows] = await conn.query<RowDataPacket[]>(
    `
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLLATION_NAME, COLUMN_DEFAULT, COLUMN_COMMENT
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [input.table, columnName],
  );
  return rows[0] ?? null;
};

const countInvalidCitizenIds = async (
  conn: PoolConnection,
  table: string,
  column = "citizen_id",
  nullable = false,
): Promise<number> => {
  const nullAllowance = nullable ? `${column} IS NULL OR ` : "";
  const [rows] = await conn.query<RowDataPacket[]>(
    `
      SELECT COUNT(*) AS total
      FROM \`${table}\`
      WHERE NOT (${nullAllowance}${column} REGEXP '^[0-9]{13}$')
    `,
  );
  return Number(rows[0]?.total ?? 0);
};

const ensurePhase1 = async (conn: PoolConnection): Promise<void> => {
  console.log("[sync-schema] Phase 1: index/constraint hardening");
  for (const indexSpec of PHASE1_INDEXES) {
    const exists = await hasIndex(conn, indexSpec);
    if (exists) {
      console.log(`  - skip index ${indexSpec.name} (exists)`);
      continue;
    }
    const uniqueSql = indexSpec.unique ? "UNIQUE " : "";
    const cols = indexSpec.columns.map((v) => `\`${v}\``).join(", ");
    await conn.query(
      `ALTER TABLE \`${indexSpec.table}\` ADD ${uniqueSql}INDEX \`${indexSpec.name}\` (${cols})`,
    );
    console.log(`  - add index ${indexSpec.name}`);
  }

  const uniqueIssueKeyExists = await hasConstraint(
    conn,
    "hrms_data_issues",
    "ux_hrms_data_issues_active_key",
  );
  if (!uniqueIssueKeyExists) {
    await conn.query(`
      ALTER TABLE hrms_data_issues
      ADD CONSTRAINT ux_hrms_data_issues_active_key
      UNIQUE (target_table, source_key, issue_code)
    `);
    console.log("  - add unique ux_hrms_data_issues_active_key");
  } else {
    console.log("  - skip unique ux_hrms_data_issues_active_key (exists)");
  }
};

const ensurePhase2 = async (conn: PoolConnection): Promise<void> => {
  console.log("[sync-schema] Phase 2: citizen_id normalization + checks");
  for (const spec of PHASE2_CITIZEN_COLUMNS) {
    const columnName = spec.column ?? "citizen_id";
    const meta = await getCitizenColumnMeta(conn, spec);
    if (!meta) {
      console.log(`  - skip ${spec.table}.${columnName} (missing column)`);
      continue;
    }

    const invalidCount = await countInvalidCitizenIds(
      conn,
      spec.table,
      columnName,
      spec.nullable,
    );
    if (invalidCount > 0) {
      console.warn(
        `  - skip alter ${spec.table}.${columnName} (invalid format rows=${invalidCount})`,
      );
      continue;
    }

    const isAlreadyChar13 =
      String(meta.COLUMN_TYPE).toLowerCase() === "char(13)";
    const isAlreadyBinaryCollation =
      String(meta.COLLATION_NAME ?? "").toLowerCase().includes("_bin");
    const isNullable = String(meta.IS_NULLABLE) === "YES";
    const nullableMatches = spec.nullable ? isNullable : !isNullable;

    if (isAlreadyChar13 && isAlreadyBinaryCollation && nullableMatches) {
      console.log(`  - skip alter ${spec.table}.${columnName} (already normalized)`);
      continue;
    }

    const nullableSql = spec.nullable ? "NULL" : "NOT NULL";
    const defaultSql =
      meta.COLUMN_DEFAULT == null
        ? ""
        : ` DEFAULT ${conn.escape(meta.COLUMN_DEFAULT)}`;
    const commentValue = String(meta.COLUMN_COMMENT ?? "").trim();
    const commentSql = commentValue ? ` COMMENT ${conn.escape(commentValue)}` : "";

    await conn.query(
      `
      ALTER TABLE \`${spec.table}\`
      MODIFY COLUMN \`${columnName}\`
      CHAR(13) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin
      ${nullableSql}${defaultSql}${commentSql}
      `,
    );
    console.log(`  - normalize ${spec.table}.${columnName} -> CHAR(13) utf8mb4_bin`);
  }

  for (const target of CHECK_TARGETS) {
    const exists = await hasConstraint(conn, target.table, target.constraint);
    if (exists) {
      console.log(`  - skip check ${target.constraint} (exists)`);
      continue;
    }
    const invalid = await countInvalidCitizenIds(conn, target.table, "citizen_id", false);
    if (invalid > 0) {
      console.warn(
        `  - skip check ${target.constraint} (invalid existing rows=${invalid})`,
      );
      continue;
    }
    await conn.query(
      `
      ALTER TABLE \`${target.table}\`
      ADD CONSTRAINT \`${target.constraint}\`
      CHECK (\`citizen_id\` REGEXP '^[0-9]{13}$')
      `,
    );
    console.log(`  - add check ${target.constraint}`);
  }

  const stageKeyConstraint = "chk_hrms_sync_stage_runs_stage_key";
  const hasStageKeyCheck = await hasConstraint(
    conn,
    "hrms_sync_stage_runs",
    stageKeyConstraint,
  );
  if (!hasStageKeyCheck) {
    const [rows] = await conn.query<RowDataPacket[]>(
      `
      SELECT COUNT(*) AS total
      FROM hrms_sync_stage_runs
      WHERE stage_key NOT IN (${STAGE_KEYS.map(() => "?").join(",")})
      `,
      [...STAGE_KEYS],
    );
    const invalid = Number(rows[0]?.total ?? 0);
    if (invalid > 0) {
      console.warn(
        `  - skip check ${stageKeyConstraint} (invalid existing rows=${invalid})`,
      );
    } else {
      await conn.query(
        `
        ALTER TABLE hrms_sync_stage_runs
        ADD CONSTRAINT ${stageKeyConstraint}
        CHECK (stage_key IN (${STAGE_KEYS.map((v) => `'${v}'`).join(", ")}))
        `,
      );
      console.log(`  - add check ${stageKeyConstraint}`);
    }
  } else {
    console.log(`  - skip check ${stageKeyConstraint} (exists)`);
  }
};

const main = async () => {
  const conn = await getConnection();
  try {
    console.log("[sync-schema] starting hardening...");
    await ensurePhase1(conn);
    await ensurePhase2(conn);
    console.log("[sync-schema] completed.");
  } finally {
    conn.release();
  }
};

main().catch((error) => {
  console.error("[sync-schema] failed:", error);
  process.exit(1);
});
