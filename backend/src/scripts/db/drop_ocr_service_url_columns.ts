import { getConnection } from "@config/database.js";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";

const columnExists = async (
  conn: PoolConnection,
  tableName: string,
  columnName: string,
): Promise<boolean> => {
  const [rows] = await conn.query<RowDataPacket[]>(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName],
  );
  return rows.length > 0;
};

const dropColumnIfExists = async (
  conn: PoolConnection,
  tableName: string,
  columnName: string,
): Promise<void> => {
  const exists = await columnExists(conn, tableName, columnName);
  if (!exists) {
    console.log(`[schema] skip ${tableName}.${columnName} (not found)`);
    return;
  }
  await conn.query(
    `ALTER TABLE \`${tableName}\` DROP COLUMN \`${columnName}\``,
  );
  console.log(`[schema] dropped ${tableName}.${columnName}`);
};

const main = async (): Promise<void> => {
  const conn = await getConnection();
  try {
    await dropColumnIfExists(conn, "req_ocr_prechecks", "service_url");
    await dropColumnIfExists(conn, "eligibility_ocr_prechecks", "service_url");
  } finally {
    conn.release();
  }
};

void main()
  .then(() => {
    console.log("[schema] OCR service_url cleanup complete");
  })
  .catch((error) => {
    console.error("[schema] OCR service_url cleanup failed:", error);
    process.exitCode = 1;
  });
