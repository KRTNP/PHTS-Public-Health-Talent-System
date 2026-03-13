import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

type MissingRef = {
  ref: string;
  file: string;
};

const IGNORE_EXTERNAL_TABLE_REFS = new Set([
  "hrms_databases.tb_ap_index_view",
  "hrms_databases.setdays",
  "hrms_databases.data_leave",
  "hrms_databases.tb_meeting",
  "hrms_databases.signature",
  "hrms_databases.tb_bp_status",
  "hrms_databases.tb_bp_license",
  // CTE alias, not physical table
  "role_effective",
]);

const SQL_CALL_RE =
  /\b(?:query|execute)\s*(?:<[^>]*>)?\s*\(\s*`([\s\S]*?)`\s*(?:,|\))/g;
const SQL_CALL_DOUBLE_QUOTE_RE =
  /\b(?:query|execute)\s*(?:<[^>]*>)?\s*\(\s*"([\s\S]*?)"\s*(?:,|\))/g;

const resolveValue = (row: Record<string, unknown>, key: string): string => {
  if (row[key] !== undefined && row[key] !== null) return String(row[key]);
  const matchedKey = Object.keys(row).find((k) => k.toLowerCase() === key.toLowerCase());
  return matchedKey ? String(row[matchedKey]) : "";
};

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

async function main(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const projectRoot = path.resolve(__dirname, "../../../");
  dotenv.config({ path: path.join(projectRoot, ".env.local") });
  dotenv.config({ path: path.join(projectRoot, ".env") });
  const sourceRoot = path.join(projectRoot, "src");
  const files = collectSourceFiles(sourceRoot);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "phts_system",
  });

  const [tableRows] = await connection.query("SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()");
  const [columnRows] = await connection.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = DATABASE()");

  const dbTables = new Set<string>(
    (tableRows as Array<Record<string, unknown>>).map((row) =>
      resolveValue(row, "table_name").toLowerCase(),
    ),
  );

  const tableColumns = new Map<string, Set<string>>();
  (columnRows as Array<Record<string, unknown>>).forEach((row) => {
    const tableName = resolveValue(row, "table_name").toLowerCase();
    const columnName = resolveValue(row, "column_name").toLowerCase();
    if (!tableColumns.has(tableName)) tableColumns.set(tableName, new Set());
    tableColumns.get(tableName)!.add(columnName);
  });

  const missingTables = new Map<string, Set<string>>();
  const missingColumns = new Map<string, Set<string>>();
  const usedTables = new Set<string>();
  const usedColumns = new Map<string, Set<string>>();

  const markUsedColumn = (table: string, column: string): void => {
    if (!usedColumns.has(table)) usedColumns.set(table, new Set());
    usedColumns.get(table)!.add(column);
  };

  for (const filePath of files) {
    const relPath = path.relative(projectRoot, filePath);
    const text = fs.readFileSync(filePath, "utf8");
    const sqlCalls = extractSqlCalls(text);

    for (const sqlRaw of sqlCalls) {
      const sql = normalizeSql(sqlRaw);
      const aliasToTable = new Map<string, string>();
      const referencedTables = new Set<string>();

      let match: RegExpExecArray | null;

      const tableAliasRe =
        /\b(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_.]*)(?:\s+(?:AS\s+)?([a-zA-Z_][a-zA-Z0-9_]*))?/gi;
      while ((match = tableAliasRe.exec(sql))) {
        const full = match[1].toLowerCase();
        const table = full.includes(".") ? full.split(".").pop()! : full;
        const alias = (match[2] || "").toLowerCase();
        if (dbTables.has(table)) {
          usedTables.add(table);
          referencedTables.add(table);
          aliasToTable.set(table, table);
          if (alias) aliasToTable.set(alias, table);
        } else if (!full.startsWith("information_schema.") && !IGNORE_EXTERNAL_TABLE_REFS.has(full)) {
          if (!missingTables.has(full)) missingTables.set(full, new Set());
          missingTables.get(full)!.add(relPath);
        }
      }

      const insertRe = /\bINSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]+)\)/gi;
      while ((match = insertRe.exec(sql))) {
        const table = match[1].toLowerCase();
        if (!dbTables.has(table)) continue;
        usedTables.add(table);
        referencedTables.add(table);
        const columns = tableColumns.get(table) ?? new Set<string>();
        for (const rawPart of match[2].split(",")) {
          const column = rawPart.replace(/[`\s]/g, "").toLowerCase();
          if (!column) continue;
          markUsedColumn(table, column);
          if (!columns.has(column)) {
            const key = `${table}.${column}`;
            if (!missingColumns.has(key)) missingColumns.set(key, new Set());
            missingColumns.get(key)!.add(relPath);
          }
        }
      }

      const updateRe = /\bUPDATE\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+SET\s+([\s\S]*?)(?:\bWHERE\b|$)/gi;
      while ((match = updateRe.exec(sql))) {
        const table = match[1].toLowerCase();
        if (!dbTables.has(table)) continue;
        usedTables.add(table);
        referencedTables.add(table);
        const columns = tableColumns.get(table) ?? new Set<string>();
        const setPart = match[2];
        for (const assignment of setPart.split(",")) {
          const assignMatch = assignment.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
          if (!assignMatch) continue;
          const column = assignMatch[1].toLowerCase();
          markUsedColumn(table, column);
          if (!columns.has(column)) {
            const key = `${table}.${column}`;
            if (!missingColumns.has(key)) missingColumns.set(key, new Set());
            missingColumns.get(key)!.add(relPath);
          }
        }
      }

      const referenceRe = /\b([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
      while ((match = referenceRe.exec(sql))) {
        const prefix = match[1].toLowerCase();
        const column = match[2].toLowerCase();
        const table = aliasToTable.get(prefix) ?? (dbTables.has(prefix) ? prefix : null);
        if (!table) continue;
        markUsedColumn(table, column);
        const columns = tableColumns.get(table) ?? new Set<string>();
        if (!columns.has(column)) {
          const key = `${table}.${column}`;
          if (!missingColumns.has(key)) missingColumns.set(key, new Set());
          missingColumns.get(key)!.add(relPath);
        }
      }

      if (/\bSELECT\s+\*/i.test(sql)) {
        referencedTables.forEach((table) => {
          (tableColumns.get(table) ?? new Set<string>()).forEach((column) =>
            markUsedColumn(table, column),
          );
        });
      }

      if (referencedTables.size === 1) {
        const onlyTable = [...referencedTables][0]!;
        const columns = tableColumns.get(onlyTable) ?? new Set<string>();
        const bareWordRe = /(?<!\.)\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
        while ((match = bareWordRe.exec(sql))) {
          const token = match[1].toLowerCase();
          if (columns.has(token)) markUsedColumn(onlyTable, token);
        }
      }
    }
  }

  const realMissingTables = [...missingTables.entries()].map(([table, filesSet]) => ({
    ref: table,
    file: [...filesSet][0]!,
  })) as MissingRef[];

  const realMissingColumns = [...missingColumns.entries()].map(([column, filesSet]) => ({
    ref: column,
    file: [...filesSet][0]!,
  })) as MissingRef[];

  const unusedTables = [...dbTables].filter((table) => !usedTables.has(table)).sort();
  const possiblyUnusedColumns = [...tableColumns.entries()]
    .map(([table, columns]) => ({
      table,
      columns: [...columns]
        .filter((column) => !(usedColumns.get(table) ?? new Set<string>()).has(column))
        .sort(),
    }))
    .filter((item) => item.columns.length > 0)
    .sort((a, b) => a.table.localeCompare(b.table));

  console.log(`Runtime schema audit summary`);
  console.log(`- DB tables: ${dbTables.size}`);
  console.log(`- Used tables (from SQL calls): ${usedTables.size}`);
  console.log(`- Missing table refs: ${realMissingTables.length}`);
  console.log(`- Missing column refs: ${realMissingColumns.length}`);
  console.log(`- Unused DB tables: ${unusedTables.length}`);
  console.log(`- Tables with possibly-unused columns: ${possiblyUnusedColumns.length}`);

  if (realMissingTables.length > 0) {
    console.log("\nMissing table refs:");
    realMissingTables.forEach((item) => console.log(`- ${item.ref} @ ${item.file}`));
  }
  if (realMissingColumns.length > 0) {
    console.log("\nMissing column refs:");
    realMissingColumns.forEach((item) => console.log(`- ${item.ref} @ ${item.file}`));
  }
  if (unusedTables.length > 0) {
    console.log("\nUnused DB tables:");
    unusedTables.forEach((table) => console.log(`- ${table}`));
  }
  if (possiblyUnusedColumns.length > 0) {
    console.log("\nPossibly-unused columns:");
    possiblyUnusedColumns.forEach((item) => {
      console.log(`- ${item.table}: ${item.columns.join(", ")}`);
    });
  }

  await connection.end();

  if (realMissingTables.length > 0 || realMissingColumns.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Schema audit failed:", error);
  process.exitCode = 1;
});
