type HrmsSourceDbKey = "main" | "leave" | "meeting";

const DEFAULT_SOURCE_DB = "hrms_databases";
const SOURCE_DB_ENV_KEYS: Record<HrmsSourceDbKey, string> = {
  main: "HRMS_MAIN_DB",
  leave: "HRMS_LEAVE_DB",
  meeting: "HRMS_MEETING_DB",
};

const SOURCE_DB_NAME_PATTERN = /^[A-Za-z0-9_]+$/;

const resolveSourceDbName = (key: HrmsSourceDbKey): string => {
  const envKey = SOURCE_DB_ENV_KEYS[key];
  const configured = String(process.env[envKey] ?? "").trim();
  const value = configured || DEFAULT_SOURCE_DB;
  if (!SOURCE_DB_NAME_PATTERN.test(value)) {
    throw new Error(
      `[hrms-source] Invalid database identifier in ${envKey}: ${value}`,
    );
  }
  return value;
};

export const getHrmsSourceDbName = (key: HrmsSourceDbKey): string =>
  resolveSourceDbName(key);

type HrmsSourceTable =
  | "tb_ap_index_view"
  | "setdays"
  | "data_leave"
  | "tb_meeting"
  | "signature"
  | "tb_bp_status"
  | "tb_bp_license";

const SOURCE_TABLE_DB: Record<HrmsSourceTable, HrmsSourceDbKey> = {
  tb_ap_index_view: "main",
  signature: "main",
  tb_bp_status: "main",
  tb_bp_license: "main",
  setdays: "leave",
  data_leave: "leave",
  tb_meeting: "meeting",
};

export const getHrmsSourceTable = (table: HrmsSourceTable): string => {
  const db = resolveSourceDbName(SOURCE_TABLE_DB[table]);
  return `${db}.${table}`;
};

