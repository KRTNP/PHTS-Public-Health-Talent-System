import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const SQL_CALL_RE = /\b(?:query|execute)\s*(?:<[^>]*>)?\s*\(\s*`([\s\S]*?)`\s*(?:,|\))/g;
const SQL_CALL_DOUBLE_QUOTE_RE =
  /\b(?:query|execute)\s*(?:<[^>]*>)?\s*\(\s*"([\s\S]*?)"\s*(?:,|\))/g;

const IGNORE_EXTERNAL_TABLE_REFS = new Set([
  "hrms_databases.tb_ap_index_view",
  "hrms_databases.setdays",
  "hrms_databases.data_leave",
  "hrms_databases.tb_meeting",
  "hrms_databases.signature",
  "hrms_databases.tb_bp_status",
  "hrms_databases.tb_bp_license",
  "role_effective",
]);

const collectSourceFiles = (dir: string): string[] => {
  const out: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (/\.(ts|js)$/.test(entry.name)) out.push(fullPath);
  }
  return out;
};

const extractSqlCalls = (text: string): string[] => {
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = SQL_CALL_RE.exec(text))) out.push(match[1]);
  while ((match = SQL_CALL_DOUBLE_QUOTE_RE.exec(text))) out.push(match[1]);
  return out.filter((sql) =>
    /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|ALTER\s+TABLE)\b/i.test(sql),
  );
};

const normalizeSql = (sql: string): string =>
  sql.replace(/\$\{[^}]+\}/g, " ").replace(/\s+/g, " ");

const resolveValue = (row: Record<string, unknown>, key: string): string => {
  if (row[key] !== undefined && row[key] !== null) return String(row[key]);
  const matchedKey = Object.keys(row).find((k) => k.toLowerCase() === key.toLowerCase());
  return matchedKey ? String(row[matchedKey]) : "";
};

async function main(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const projectRoot = path.resolve(__dirname, "../../../");
  dotenv.config({ path: path.join(projectRoot, ".env.local") });
  dotenv.config({ path: path.join(projectRoot, ".env") });

  const sourceRoot = path.join(projectRoot, "src");
  const files = collectSourceFiles(sourceRoot);

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "phts_system",
  });

  const [tableRows] = await conn.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()",
  );
  const [columnRows] = await conn.query(
    "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = DATABASE()",
  );

  const dbTables = new Set<string>(
    (tableRows as Array<Record<string, unknown>>).map((row) =>
      resolveValue(row, "table_name").toLowerCase(),
    ),
  );

  const tableColumns = new Map<string, Set<string>>();
  for (const row of columnRows as Array<Record<string, unknown>>) {
    const tableName = resolveValue(row, "table_name").toLowerCase();
    const columnName = resolveValue(row, "column_name").toLowerCase();
    if (!tableColumns.has(tableName)) tableColumns.set(tableName, new Set());
    tableColumns.get(tableName)!.add(columnName);
  }

  const usedColumns = new Map<string, Set<string>>();
  const markColumn = (table: string, column: string) => {
    if (!usedColumns.has(table)) usedColumns.set(table, new Set());
    usedColumns.get(table)!.add(column);
  };

  for (const filePath of files) {
    const text = fs.readFileSync(filePath, "utf8");
    const sqlCalls = extractSqlCalls(text);

    for (const sqlRaw of sqlCalls) {
      const sql = normalizeSql(sqlRaw);
      const aliasToTable = new Map<string, string>();
      let match: RegExpExecArray | null;

      const tableAliasRe =
        /\b(?:FROM|JOIN|UPDATE|INTO)\s+([a-zA-Z_][a-zA-Z0-9_.]*)(?:\s+(?:AS\s+)?([a-zA-Z_][a-zA-Z0-9_]*))?/gi;
      while ((match = tableAliasRe.exec(sql))) {
        const full = match[1].toLowerCase();
        const table = full.includes(".") ? full.split(".").pop()! : full;
        const alias = (match[2] || "").toLowerCase();
        if (dbTables.has(table)) {
          aliasToTable.set(table, table);
          if (alias) aliasToTable.set(alias, table);
        } else if (!full.startsWith("information_schema.") && !IGNORE_EXTERNAL_TABLE_REFS.has(full)) {
          // ignore unresolved refs for this audit
        }
      }

      const insertRe = /\bINSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]+)\)/gi;
      while ((match = insertRe.exec(sql))) {
        const table = match[1].toLowerCase();
        if (!dbTables.has(table)) continue;
        for (const rawPart of match[2].split(",")) {
          const column = rawPart.replace(/[`\s]/g, "").toLowerCase();
          if (column) markColumn(table, column);
        }
      }

      const updateRe = /\bUPDATE\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+SET\s+([\s\S]*?)(?:\bWHERE\b|$)/gi;
      while ((match = updateRe.exec(sql))) {
        const table = match[1].toLowerCase();
        if (!dbTables.has(table)) continue;
        const setPart = match[2];
        for (const assignment of setPart.split(",")) {
          const assignMatch = assignment.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
          if (!assignMatch) continue;
          markColumn(table, assignMatch[1].toLowerCase());
        }
      }

      const refRe = /\b([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
      while ((match = refRe.exec(sql))) {
        const prefix = match[1].toLowerCase();
        const column = match[2].toLowerCase();
        const table = aliasToTable.get(prefix) ?? (dbTables.has(prefix) ? prefix : null);
        if (!table) continue;
        markColumn(table, column);
      }
    }
  }

  const unusedByTable: Array<{ table: string; columns: string[] }> = [];

  for (const table of [...dbTables].sort()) {
    const allCols = tableColumns.get(table) ?? new Set<string>();
    const usedCols = usedColumns.get(table) ?? new Set<string>();
    const unused = [...allCols].filter((c) => !usedCols.has(c)).sort();
    if (unused.length > 0) {
      unusedByTable.push({ table, columns: unused });
    }
  }

  console.log(`Unused-column audit summary`);
  console.log(`- Tables scanned: ${dbTables.size}`);
  console.log(`- Tables with possibly-unused columns: ${unusedByTable.length}`);

  for (const row of unusedByTable) {
    console.log(`\n[${row.table}] (${row.columns.length})`);
    for (const col of row.columns) {
      console.log(`- ${col}`);
    }
  }

  await conn.end();
}

main().catch((error) => {
  console.error("Unused-column audit failed:", error);
  process.exitCode = 1;
});
