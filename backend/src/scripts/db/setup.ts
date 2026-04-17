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

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "phts_system",
  port: Number.parseInt(process.env.DB_PORT || "3306", 10),
  multipleStatements: true, // จำเป็นมาก เพื่อให้รัน SQL ก้อนใหญ่ได้
};

async function setupDatabase() {
  console.log("🚀 Starting PHTS System Setup...");
  let connection;

  try {
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`❌ Migration directory not found at: ${migrationsDir}`);
    }

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.toLowerCase().endsWith(".sql"))
      .sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
      );

    if (migrationFiles.length === 0) {
      throw new Error(`❌ No SQL migration files found at: ${migrationsDir}`);
    }

    // 2. เชื่อมต่อ Database
    connection = await mysql.createConnection(dbConfig);
    console.log(`📦 Connected to database: ${dbConfig.database}`);

    // 3. รัน SQL migration ตามลำดับ phase
    console.log(
      `⏳ Applying ${migrationFiles.length} migration files from active set...`,
    );
    for (const migrationFile of migrationFiles) {
      const migrationPath = path.join(migrationsDir, migrationFile);
      const sqlContent = fs.readFileSync(migrationPath, "utf8").trim();

      if (!sqlContent) {
        console.log(`⏭️ Skipped empty migration: ${migrationFile}`);
        continue;
      }

      await connection.query(sqlContent);
      console.log(`✅ Applied migration: ${migrationFile}`);
    }
    console.log("✅ Database structure prepared successfully.");

    // 4. สร้างโฟลเดอร์สำหรับเก็บไฟล์ (Uploads)
    const uploadDirs = ["uploads", "uploads/documents", "uploads/signatures"];

    uploadDirs.forEach((dir) => {
      const fullPath = path.join(backendRoot, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`📂 Created directory: ${dir}`);
      }
    });

    console.log("\n✨ Setup completed successfully!");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("\n❌ Setup Failed:", message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

setupDatabase();
