/**
 * Database Helper Utilities
 *
 * Shared utilities for common database operations
 * to reduce code duplication across services
 */

import { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getConnection } from '../config/database.js';

// ============================================================================
// Types
// ============================================================================

export interface EmployeeRow {
  citizen_id: string;
  title?: string;
  first_name?: string;
  last_name?: string;
  position_name?: string;
  department?: string;
  sub_department?: string;
  level?: string;
  email?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  maxLimit?: number;
}

export interface PaginationResult {
  page: number;
  limit: number;
  offset: number;
  total?: number;
  totalPages?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// Employee Name Formatting
// ============================================================================

/**
 * Format employee full name from row data
 * Handles both emp_profiles and emp_support_staff with COALESCE pattern
 */
export function formatEmployeeName(row: {
  title?: string;
  first_name?: string;
  last_name?: string;
}): string {
  const parts = [row.title, row.first_name, row.last_name].filter(Boolean);
  return parts.join(' ').trim() || 'ไม่ระบุชื่อ';
}

/**
 * Format employee name without title
 */
export function formatEmployeeNameShort(row: {
  first_name?: string;
  last_name?: string;
}): string {
  return `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'ไม่ระบุชื่อ';
}

// ============================================================================
// SQL Query Fragments (Employee Joins)
// ============================================================================

/**
 * SQL fragment for joining users with employee tables
 * Returns columns with COALESCE to handle both emp_profiles and emp_support_staff
 */
export const SQL_EMPLOYEE_JOINS = `
  LEFT JOIN emp_profiles e ON u.citizen_id = e.citizen_id
  LEFT JOIN emp_support_staff s ON u.citizen_id = s.citizen_id
`;

/**
 * SQL columns for employee data with COALESCE
 */
export const SQL_EMPLOYEE_COLUMNS = `
  COALESCE(e.title, s.title, '') AS title,
  COALESCE(e.first_name, s.first_name, '') AS first_name,
  COALESCE(e.last_name, s.last_name, '') AS last_name,
  COALESCE(e.position_name, s.position_name, '') AS position_name,
  COALESCE(e.department, s.department, '') AS department,
  COALESCE(e.sub_department, '', '') AS sub_department,
  COALESCE(e.level, s.level, '') AS level
`;

/**
 * SQL columns for basic employee info (minimal)
 */
export const SQL_EMPLOYEE_COLUMNS_BASIC = `
  COALESCE(e.first_name, s.first_name, '') AS first_name,
  COALESCE(e.last_name, s.last_name, '') AS last_name
`;

/**
 * Build employee join SQL for a specific alias
 */
export function buildEmployeeJoinSQL(userAlias: string, empAlias: string, supportAlias: string): string {
  return `
    LEFT JOIN emp_profiles ${empAlias} ON ${userAlias}.citizen_id = ${empAlias}.citizen_id
    LEFT JOIN emp_support_staff ${supportAlias} ON ${userAlias}.citizen_id = ${supportAlias}.citizen_id
  `;
}

// ============================================================================
// Pagination Helpers
// ============================================================================

/**
 * Calculate pagination values with validation
 */
export function calculatePagination(params: PaginationParams): PaginationResult {
  const maxLimit = params.maxLimit || 100;
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(Math.max(1, params.limit || 20), maxLimit);
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Build paginated response with metadata
 */
export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  pagination: PaginationResult
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
}

/**
 * SQL fragment for LIMIT and OFFSET
 * Note: These values should be validated integers before use
 */
export function buildLimitOffsetSQL(limit: number, offset: number): string {
  // Ensure integers to prevent SQL injection
  const safeLimit = Math.floor(Math.abs(limit));
  const safeOffset = Math.floor(Math.abs(offset));
  return `LIMIT ${safeLimit} OFFSET ${safeOffset}`;
}

// ============================================================================
// Transaction Wrapper
// ============================================================================

type TransactionCallback<T> = (connection: PoolConnection) => Promise<T>;

/**
 * Execute a function within a database transaction
 * Automatically handles commit/rollback and connection release
 *
 * @example
 * const result = await withTransaction(async (conn) => {
 *   await conn.query('INSERT INTO ...');
 *   await conn.query('UPDATE ...');
 *   return { success: true };
 * });
 */
export async function withTransaction<T>(callback: TransactionCallback<T>): Promise<T> {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Execute a read-only query (no transaction needed)
 * Automatically handles connection release
 */
export async function withConnection<T>(
  callback: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await getConnection();

  try {
    return await callback(connection);
  } finally {
    connection.release();
  }
}

// ============================================================================
// Query Result Helpers
// ============================================================================

/**
 * Safely get first row from query result
 */
export function getFirstRow<T>(rows: RowDataPacket[]): T | null {
  return rows.length > 0 ? (rows[0] as T) : null;
}

/**
 * Safely get count from COUNT(*) query
 */
export function getCountFromResult(rows: RowDataPacket[]): number {
  if (rows.length === 0) return 0;
  const row = rows[0] as { total?: number; count?: number; 'COUNT(*)'?: number };
  return row.total ?? row.count ?? row['COUNT(*)'] ?? 0;
}

/**
 * Check if query affected any rows
 */
export function hasAffectedRows(result: { affectedRows?: number }): boolean {
  return (result.affectedRows ?? 0) > 0;
}

/**
 * Get insert ID from result
 */
export function getInsertId(result: { insertId?: number }): number {
  return result.insertId ?? 0;
}

// ============================================================================
// Date Helpers
// ============================================================================

/**
 * Format date for MySQL (YYYY-MM-DD)
 */
export function formatDateForDB(date: Date | string): string {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  return date.toISOString().split('T')[0];
}

/**
 * Format datetime for MySQL (YYYY-MM-DD HH:mm:ss)
 */
export function formatDateTimeForDB(date: Date | string): string {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Get current datetime for MySQL
 */
export function getCurrentDateTime(): string {
  return formatDateTimeForDB(new Date());
}
