/**
 * PHTS System - Request & Workflow Tables Migration Script
 *
 * This script creates the database tables for Part 2: Request & Workflow System
 * by executing the init_requests.sql file.
 *
 * Tables Created:
 * - pts_requests: Main request header table
 * - pts_request_actions: Approval action audit log
 * - pts_attachments: File attachment metadata
 *
 * Usage:
 *   npx ts-node src/scripts/migrate_requests.ts
 *
 * Requirements:
 *   - mysql2 package installed
 *   - .env file configured with database credentials
 *   - init_requests.sql file exists in src/database/
 *
 * Safety:
 *   - Uses CREATE TABLE IF NOT EXISTS (idempotent)
 *   - Safe to run multiple times
 *   - Will not drop existing tables or data
 *
 * @author Database Specialist (Sub-Agent 1)
 * @date 2025-12-30
 */

import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

/**
 * Configuration for database connection
 */
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'phts_system',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  multipleStatements: true, // Required to execute multiple SQL statements
};

/**
 * Path to the SQL initialization file
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SQL_FILE_PATH = path.join(__dirname, '..', 'database', 'init_requests.sql');

/**
 * Reads the SQL file and returns its contents
 *
 * @returns SQL file contents as string
 * @throws Error if file cannot be read
 */
function readSqlFile(): string {
  try {
    if (!fs.existsSync(SQL_FILE_PATH)) {
      throw new Error(`SQL file not found at: ${SQL_FILE_PATH}`);
    }

    const sqlContent = fs.readFileSync(SQL_FILE_PATH, 'utf8');

    if (!sqlContent || sqlContent.trim().length === 0) {
      throw new Error('SQL file is empty');
    }

    return sqlContent;
  } catch (error) {
    console.error('Error reading SQL file:', error);
    throw error;
  }
}

/**
 * Verifies that the users table exists before creating foreign keys
 *
 * @param connection - MySQL connection
 * @throws Error if users table does not exist
 */
async function verifyPrerequisites(connection: mysql.Connection): Promise<void> {
  try {
    const [tables] = await connection.query<mysql.RowDataPacket[]>(
      `SHOW TABLES LIKE 'users'`
    );

    if (!tables || tables.length === 0) {
      throw new Error(
        'Prerequisite table "users" does not exist. Please run init_users.sql first.'
      );
    }

    console.log('  ✓ Prerequisite check passed: users table exists\n');
  } catch (error) {
    console.error('  ✗ Prerequisite check failed:', error);
    throw error;
  }
}

/**
 * Executes the migration SQL script
 *
 * @param connection - MySQL connection
 * @param sqlContent - SQL statements to execute
 */
async function executeMigration(
  connection: mysql.Connection,
  sqlContent: string
): Promise<void> {
  try {
    console.log('Executing SQL migration script...\n');

    // Execute the SQL file (contains multiple statements)
    await connection.query(sqlContent);

    console.log('  ✓ SQL script executed successfully\n');
  } catch (error) {
    console.error('  ✗ Error executing SQL script:', error);
    throw error;
  }
}

/**
 * Verifies that all tables were created successfully
 *
 * @param connection - MySQL connection
 */
async function verifyTablesCreated(connection: mysql.Connection): Promise<void> {
  try {
    console.log('Verifying table creation...\n');

    const expectedTables = ['pts_requests', 'pts_request_actions', 'pts_attachments'];
    const results: { [key: string]: boolean } = {};

    for (const tableName of expectedTables) {
      const [tables] = await connection.query<mysql.RowDataPacket[]>(
        `SHOW TABLES LIKE ?`,
        [tableName]
      );

      const exists = tables && tables.length > 0;
      results[tableName] = exists;

      if (exists) {
        console.log(`  ✓ Table '${tableName}' exists`);
      } else {
        console.log(`  ✗ Table '${tableName}' was NOT created`);
      }
    }

    console.log('');

    // Check if any table is missing
    const allTablesExist = Object.values(results).every((exists) => exists);

    if (!allTablesExist) {
      throw new Error('One or more tables were not created successfully');
    }
  } catch (error) {
    console.error('Error verifying tables:', error);
    throw error;
  }
}

/**
 * Displays table structure information
 *
 * @param connection - MySQL connection
 */
async function displayTableInfo(connection: mysql.Connection): Promise<void> {
  try {
    console.log('========================================');
    console.log('Table Structure Summary');
    console.log('========================================\n');

    const tables = ['pts_requests', 'pts_request_actions', 'pts_attachments'];

    for (const tableName of tables) {
      // Get column count
      const [columns] = await connection.query<mysql.RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [dbConfig.database, tableName]
      );

      // Get foreign key count
      const [foreignKeys] = await connection.query<mysql.RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
        [dbConfig.database, tableName]
      );

      // Get index count
      const [indexes] = await connection.query<mysql.RowDataPacket[]>(
        `SELECT COUNT(DISTINCT INDEX_NAME) as count FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [dbConfig.database, tableName]
      );

      console.log(`Table: ${tableName}`);
      console.log(`  - Columns: ${columns[0].count}`);
      console.log(`  - Foreign Keys: ${foreignKeys[0].count}`);
      console.log(`  - Indexes: ${indexes[0].count}`);
      console.log('');
    }
  } catch (error) {
    console.error('Error displaying table info:', error);
    // Don't throw - this is just informational
  }
}

/**
 * Main migration function
 */
async function migrateRequests(): Promise<void> {
  let connection: mysql.Connection | null = null;

  try {
    console.log('========================================');
    console.log('PHTS Request & Workflow Tables Migration');
    console.log('========================================\n');

    // Read SQL file
    console.log('Reading SQL initialization file...');
    console.log(`Path: ${SQL_FILE_PATH}\n`);
    const sqlContent = readSqlFile();
    console.log('  ✓ SQL file loaded successfully\n');

    // Establish database connection
    console.log(`Connecting to database: ${dbConfig.database}@${dbConfig.host}...`);
    connection = await mysql.createConnection(dbConfig);
    console.log('  ✓ Database connection established successfully\n');

    // Verify prerequisites
    console.log('Checking prerequisites...');
    await verifyPrerequisites(connection);

    // Execute migration
    await executeMigration(connection, sqlContent);

    // Verify tables were created
    await verifyTablesCreated(connection);

    // Display table information
    await displayTableInfo(connection);

    // Success summary
    console.log('========================================');
    console.log('Migration Completed Successfully');
    console.log('========================================');
    console.log('Tables Created:');
    console.log('  - pts_requests (Request headers)');
    console.log('  - pts_request_actions (Approval audit log)');
    console.log('  - pts_attachments (File metadata)');
    console.log('');
    console.log('Foreign Key Relationships:');
    console.log('  - pts_requests -> users (user_id)');
    console.log('  - pts_request_actions -> pts_requests (request_id)');
    console.log('  - pts_request_actions -> users (actor_id)');
    console.log('  - pts_attachments -> pts_requests (request_id)');
    console.log('');
    console.log('Next Steps:');
    console.log('  1. Implement workflow API endpoints');
    console.log('  2. Create file upload middleware (multer)');
    console.log('  3. Build request submission forms');
    console.log('  4. Implement approval dashboards');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n========================================');
    console.error('MIGRATION FAILED');
    console.error('========================================');
    console.error('An error occurred during the migration process:\n');
    console.error(error);
    console.error('\nPlease check the error message above and try again.\n');
    process.exit(1);
  } finally {
    // Close database connection
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

// Execute the migration function
migrateRequests()
  .then(() => {
    console.log('\nMigration script completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nMigration script failed:', error);
    process.exit(1);
  });
