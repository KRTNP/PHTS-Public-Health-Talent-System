import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(__filename);
const backendRoot = path.resolve(scriptDir, "../../../");
const migrationsDir = path.join(scriptDir, "migrations", "active");
const DB_CHARSET = "utf8mb4";
const DB_COLLATION = "utf8mb4_unicode_ci";

const serverConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  port: Number.parseInt(process.env.DB_PORT || "3306", 10),
};

const dbConfig = {
  ...serverConfig,
  database: process.env.DB_NAME || "phts_system",
  // Required for running SQL migration files containing multiple statements.
  multipleStatements: true,
};

function listActiveMigrations(): string[] {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migration directory not found: ${migrationsDir}`);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.toLowerCase().endsWith(".sql"))
    .sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    );

  if (files.length === 0) {
    throw new Error(`No SQL migration files found: ${migrationsDir}`);
  }

  return files;
}

async function ensureDatabaseDefaults() {
  const adminConnection = await mysql.createConnection({
    ...serverConfig,
    multipleStatements: true,
  });

  try {
    await adminConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET ${DB_CHARSET} COLLATE ${DB_COLLATION}`,
    );
    await adminConnection.query(
      `ALTER DATABASE \`${dbConfig.database}\` CHARACTER SET ${DB_CHARSET} COLLATE ${DB_COLLATION}`,
    );
  } finally {
    await adminConnection.end();
  }
}

function ensureUploadDirectories() {
  const uploadDirs = ["uploads", "uploads/documents", "uploads/signatures"];

  for (const dir of uploadDirs) {
    const fullPath = path.join(backendRoot, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  }
}

async function setupDatabase() {
  console.log("Starting database setup...");
  let connection: mysql.Connection | undefined;
  const strictMode =
    String(process.env.DB_SETUP_STRICT ?? "true").trim().toLowerCase() !==
    "false";

  try {
    const migrationFiles = listActiveMigrations();
    await ensureDatabaseDefaults();
    connection = await mysql.createConnection(dbConfig);
    console.log(`Connected to database: ${dbConfig.database}`);

    console.log(`Applying ${migrationFiles.length} migration files...`);
    const failedMigrations: string[] = [];
    for (const migrationFile of migrationFiles) {
      const migrationPath = path.join(migrationsDir, migrationFile);
      const sqlContent = fs.readFileSync(migrationPath, "utf8").trim();

      if (!sqlContent) {
        console.log(`Skipped empty migration: ${migrationFile}`);
        continue;
      }

      try {
        await connection.query(sqlContent);
        console.log(`Applied migration: ${migrationFile}`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        failedMigrations.push(migrationFile);
        if (strictMode) {
          throw new Error(`Migration failed (${migrationFile}): ${message}`);
        }
        console.warn(`Skipped migration (${migrationFile}): ${message}`);
      }
    }

    if (failedMigrations.length > 0) {
      console.warn(
        `Completed with ${failedMigrations.length} skipped migration(s). Set DB_SETUP_STRICT=false only when partial setup is intentional.`,
      );
    }

    ensureUploadDirectories();

    console.log("Database setup completed.");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Database setup failed:", message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

setupDatabase();
