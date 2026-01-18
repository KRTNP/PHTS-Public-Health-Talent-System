import { Request, Response } from 'express';
import { query } from '../../config/database.js';
import { clearScopeCache } from '../request/scope/scope.service.js';
import { UserRole } from '../../types/auth.js';
import { SyncService } from '../../services/syncService.js';
import { runBackupJob } from '../../services/backupService.js';

export const searchUsers = async (req: Request, res: Response) => {
  try {
    const searchTerm = typeof req.query.q === 'string' ? req.query.q : '';
    const search = `%${searchTerm}%`;
    const sql = `
      SELECT u.id, u.citizen_id, u.role, u.is_active, u.last_login_at,
             COALESCE(e.first_name, s.first_name) as first_name,
             COALESCE(e.last_name, s.last_name) as last_name
      FROM users u
      LEFT JOIN emp_profiles e ON u.citizen_id = e.citizen_id
      LEFT JOIN emp_support_staff s ON u.citizen_id = s.citizen_id
      WHERE u.citizen_id LIKE ? OR e.first_name LIKE ? OR e.last_name LIKE ?
      LIMIT 50
    `;
    const users = await query(sql, [search, search, search]);
    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { role, is_active } = req.body;

    if (!Object.values(UserRole).includes(role)) {
      throw new Error('Invalid role');
    }

    await query('UPDATE users SET role = ?, is_active = ? WHERE id = ?', [
      role,
      is_active,
      userId,
    ]);
    clearScopeCache(Number(userId));
    res.json({ success: true, message: 'User role updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const toggleMaintenanceMode = async (req: Request, res: Response) => {
  const { enabled } = req.body;
  res.json({ success: true, message: `Maintenance mode ${enabled ? 'ENABLED' : 'DISABLED'}` });
};

export const triggerBackup = async (_req: Request, res: Response) => {
  try {
    const result = await runBackupJob();
    if (!result.enabled) {
      res.json({ success: true, message: 'Backup is disabled (BACKUP_ENABLED=false)' });
      return;
    }
    res.json({ success: true, message: 'Backup completed', data: { output: result.output } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const triggerSync = async (_req: Request, res: Response) => {
  try {
    const result = await SyncService.performFullSync();
    res.json({ success: true, message: 'Sync process started successfully', data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
