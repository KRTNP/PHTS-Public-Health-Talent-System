/**
 * PHTS System - Delegation Controller
 *
 * Handles HTTP requests for delegation operations.
 */

import { Request, Response } from 'express';
import { ApiResponse } from '../../types/auth.js';
import * as delegationService from './delegation.service.js';

/**
 * Get delegations for current user
 * GET /api/delegations/my
 */
export async function getMyDelegations(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const userId = (req.user as any).id;
    const includeExpired = req.query.includeExpired === 'true';

    const delegations = await delegationService.getUserDelegations(userId, includeExpired);
    res.json({ success: true, data: delegations });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get active delegations where current user is delegate
 * GET /api/delegations/acting
 */
export async function getActingRoles(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const userId = (req.user as any).id;

    const delegations = await delegationService.getActiveDelegationsForDelegate(userId);
    res.json({ success: true, data: delegations });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Create a new delegation
 * POST /api/delegations
 */
export async function createDelegation(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const delegatorId = (req.user as any).id;
    const { delegateId, delegatedRole, scopeType, scopeValue, startDate, endDate, reason } =
      req.body;

    if (!delegateId || !delegatedRole || !startDate || !endDate) {
      res.status(400).json({
        success: false,
        error: 'delegateId, delegatedRole, startDate, and endDate are required',
      });
      return;
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      res.status(400).json({ success: false, error: 'startDate must be before endDate' });
      return;
    }

    const delegation = await delegationService.createDelegation(delegatorId, {
      delegateId,
      delegatedRole,
      scopeType,
      scopeValue,
      startDate,
      endDate,
      reason,
    });

    res.status(201).json({ success: true, data: delegation });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

/**
 * Cancel a delegation
 * DELETE /api/delegations/:id
 */
export async function cancelDelegation(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const delegationId = parseInt(req.params.id, 10);
    const cancelledBy = (req.user as any).id;
    const { reason } = req.body;

    await delegationService.cancelDelegation(delegationId, cancelledBy, reason);
    res.json({ success: true, message: 'Delegation cancelled' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

/**
 * Check if current user can act as a role
 * GET /api/delegations/check/:role
 */
export async function checkCanAct(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const userId = (req.user as any).id;
    const role = req.params.role;
    const scopeType = req.query.scopeType as string | undefined;
    const scopeValue = req.query.scopeValue as string | undefined;

    const result = await delegationService.canActAsRole(
      userId,
      role,
      scopeType as any,
      scopeValue,
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get all active delegations (admin view)
 * GET /api/delegations/all
 */
export async function getAllDelegations(
  _req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const delegations = await delegationService.getAllActiveDelegations();
    res.json({ success: true, data: delegations });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Manually trigger expire job (admin only)
 * POST /api/delegations/expire
 */
export async function expireDelegations(
  _req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const count = await delegationService.expireOldDelegations();
    res.json({ success: true, message: `Expired ${count} delegations` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
