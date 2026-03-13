import { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getConnection } from '@config/database.js';
import db from '@config/database.js';
import { DB_HEAD_SCOPE_ROLE_SQL_LIST } from '@/shared/utils/head-scope-category.js';

export class AdminRepository {
  static async searchUsers(params: {
    q: string;
    page: number;
    limit: number;
    role?: string;
    isActive?: number;
  }): Promise<{
    rows: Array<{
      id: number;
      citizen_id: string;
      role: string;
      is_active: number;
      last_login_at: Date | null;
      first_name: string | null;
      last_name: string | null;
    }>;
    total: number;
    active_total: number;
    inactive_total: number;
    page: number;
    limit: number;
    total_pages: number;
  }> {
    const page = Number.isFinite(params.page) && params.page > 0 ? Math.floor(params.page) : 1;
    const limitRaw = Number.isFinite(params.limit) && params.limit > 0 ? Math.floor(params.limit) : 20;
    const limit = Math.min(limitRaw, 100);
    const offset = (page - 1) * limit;

    const sanitized = params.q.replace(/[%_]/g, '\\$&');
    const search = `%${sanitized}%`;

    const whereParts: string[] = [
      `(u.citizen_id LIKE ? OR COALESCE(e.first_name, s.first_name, '') LIKE ? OR COALESCE(e.last_name, s.last_name, '') LIKE ?)`,
    ];
    const whereParams: Array<string | number> = [search, search, search];

    if (params.role) {
      whereParts.push('u.role = ?');
      whereParams.push(params.role);
    }
    if (params.isActive === 0 || params.isActive === 1) {
      whereParts.push('u.is_active = ?');
      whereParams.push(params.isActive);
    }

    const whereClause = `WHERE ${whereParts.join(' AND ')}`;

    const [countRows] = await db.query<RowDataPacket[]>(
      `SELECT
         COUNT(DISTINCT u.id) AS total,
         COUNT(DISTINCT CASE WHEN u.is_active = 1 THEN u.id END) AS active_total
       FROM users u
       LEFT JOIN emp_profiles e ON u.citizen_id = e.citizen_id
       LEFT JOIN emp_support_staff s ON u.citizen_id = s.citizen_id
       ${whereClause}`,
      whereParams,
    );
    const total = Number((countRows[0] as { total?: number })?.total ?? 0);
    const activeTotal = Number((countRows[0] as { active_total?: number })?.active_total ?? 0);
    const inactiveTotal = Math.max(0, total - activeTotal);
    const totalPages = total > 0 ? Math.ceil(total / limit) : 1;

    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT
         u.id,
         u.citizen_id,
         u.role,
         u.is_active,
         u.last_login_at,
         COALESCE(e.first_name, s.first_name) AS first_name,
         COALESCE(e.last_name, s.last_name) AS last_name
       FROM users u
       LEFT JOIN emp_profiles e ON u.citizen_id = e.citizen_id
       LEFT JOIN emp_support_staff s ON u.citizen_id = s.citizen_id
       ${whereClause}
       GROUP BY u.id, u.citizen_id, u.role, u.is_active, u.last_login_at, e.first_name, s.first_name, e.last_name, s.last_name
       ORDER BY u.id DESC
       LIMIT ? OFFSET ?`,
      [...whereParams, limit, offset],
    );

    return {
      rows: rows as Array<{
        id: number;
        citizen_id: string;
        role: string;
        is_active: number;
        last_login_at: Date | null;
        first_name: string | null;
        last_name: string | null;
      }> ,
      total,
      active_total: activeTotal,
      inactive_total: inactiveTotal,
      page,
      limit,
      total_pages: totalPages,
    };
  }

  static async updateUserRole(
    userId: number,
    role: string,
    isActive: boolean | undefined,
  ): Promise<void> {
    const conn: PoolConnection = await getConnection();
    try {
      await conn.beginTransaction();

      await conn.execute('UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?', [
        role,
        userId,
      ]);

      if (isActive !== undefined) {
        await conn.execute('UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ?', [
          isActive ? 1 : 0,
          userId,
        ]);
      }

      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  static async findUserById(userId: number): Promise<{
    id: number;
    citizen_id: string;
    role: string;
    is_active: number;
    last_login_at: Date | null;
    first_name: string | null;
    last_name: string | null;
    department: string | null;
    position_name: string | null;
    updated_at: Date | null;
    created_at: Date | null;
    scopes: Array<{
      scope_type: 'UNIT' | 'DEPT';
      scope_name: string;
      source: string;
    }>;
  } | null> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT
        u.id,
        u.citizen_id,
        u.role,
        u.is_active,
        u.last_login_at,
        u.updated_at,
        u.created_at,
        COALESCE(e.first_name, s.first_name) AS first_name,
        COALESCE(e.last_name, s.last_name) AS last_name,
        COALESCE(e.department, s.department) AS department,
        COALESCE(e.position_name, s.position_name) AS position_name
       FROM users u
       LEFT JOIN emp_profiles e ON u.citizen_id = e.citizen_id
       LEFT JOIN emp_support_staff s ON u.citizen_id = s.citizen_id
       WHERE u.id = ?
       LIMIT 1`,
      [userId],
    );
    const userRow = (rows[0] as {
      id: number;
      citizen_id: string;
      role: string;
      is_active: number;
      last_login_at: Date | null;
      first_name: string | null;
      last_name: string | null;
      department: string | null;
      position_name: string | null;
      updated_at: Date | null;
      created_at: Date | null;
    } | undefined) ?? null;

    if (!userRow) return null;

    const [scopeRows] = await db.query<RowDataPacket[]>(
      `SELECT scope_type, scope_name, source
       FROM special_position_scope_map
       WHERE user_id = ?
         AND is_active = 1
         AND (
           (? = 'HEAD_SCOPE' AND role IN (${DB_HEAD_SCOPE_ROLE_SQL_LIST}))
           OR role = ?
         )
       ORDER BY scope_type, scope_name`,
      [userRow.id, userRow.role, userRow.role],
    );

    return {
      ...userRow,
      scopes: scopeRows.map((row) => ({
        scope_type: String(row.scope_type) === 'DEPT' ? 'DEPT' : 'UNIT',
        scope_name: String(row.scope_name ?? ''),
        source: String(row.source ?? 'AUTO'),
      })),
    };
  }
}
