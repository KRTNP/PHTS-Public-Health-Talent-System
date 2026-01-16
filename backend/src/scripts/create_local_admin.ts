import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'phts_system',
  port: parseInt(process.env.DB_PORT || '3306', 10),
};

async function createLocalAdmin() {
  const citizenId = process.argv[2] || '9999999999999'; // รับค่าจาก command line หรือใช้ค่า default
  const password = process.argv[3] || process.env.LOCAL_ADMIN_PASSWORD;

  if (!password) {
    console.error('Missing admin password. Provide as argument or LOCAL_ADMIN_PASSWORD env var.');
    process.exit(1);
  }

  console.log(`👤 Creating Local Admin: ${citizenId}`);

  const connection = await mysql.createConnection(dbConfig);
  const hash = await bcrypt.hash(password, 10);

  await connection.query(
    `
    INSERT INTO users (citizen_id, password_hash, role, is_active)
    VALUES (?, ?, 'ADMIN', 1)
    ON DUPLICATE KEY UPDATE
      password_hash = VALUES(password_hash),
      role = 'ADMIN',
      is_active = 1
  `,
    [citizenId, hash],
  );

  console.log(`✅ Admin created! Login with: ${citizenId} / ${password}`);
  await connection.end();
}

createLocalAdmin();
