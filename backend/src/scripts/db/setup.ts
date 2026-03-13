import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

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
    // 1. ตรวจสอบไฟล์ SQL Master
    const sqlPath = path.join(__dirname, "../database/phts_system.sql");
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`❌ SQL file not found at: ${sqlPath}`);
    }
    const sqlContent = fs.readFileSync(sqlPath, "utf8");

    // 2. เชื่อมต่อ Database
    connection = await mysql.createConnection(dbConfig);
    console.log(`📦 Connected to database: ${dbConfig.database}`);

    // 3. รัน SQL Script
    console.log("⏳ Executing SQL schema...");
    await connection.query(sqlContent);
    console.log("✅ Database structure created successfully.");

    // 4. สร้างโฟลเดอร์สำหรับเก็บไฟล์ (Uploads)
    const baseDir = path.resolve(__dirname, "../../"); // ถอยกลับไป root project
    const uploadDirs = ["uploads", "uploads/documents", "uploads/signatures"];

    uploadDirs.forEach((dir) => {
      const fullPath = path.join(baseDir, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`📂 Created directory: ${dir}`);
      }
    });

    console.log("\n✨ Setup completed successfully!");
  } catch (error: any) {
    console.error("\n❌ Setup Failed:", error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

setupDatabase();
