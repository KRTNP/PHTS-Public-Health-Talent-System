/**
 * PHTS System - Finance Controller
 *
 * Handles HTTP requests for finance operations.
 */

import { Request, Response } from 'express';
import { ApiResponse } from '../../types/auth.js';
import * as financeService from './finance.service.js';
import { PaymentStatus } from './finance.service.js';

function getStringQuery(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Get finance dashboard overview
 * GET /api/finance/dashboard
 */
export async function getDashboard(
  _req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const dashboard = await financeService.getFinanceDashboard();
    res.json({ success: true, data: dashboard });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get finance summary with optional filters
 * GET /api/finance/summary?year=&month=
 */
export async function getSummary(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const month = req.query.month ? parseInt(req.query.month as string, 10) : undefined;

    const summary = await financeService.getFinanceSummary(year, month);
    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get yearly summary
 * GET /api/finance/yearly?year=
 */
export async function getYearlySummary(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;

    const summary = await financeService.getYearlySummary(year);
    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get payouts for a specific period
 * GET /api/finance/periods/:periodId/payouts?status=&search=
 */
export async function getPayoutsByPeriod(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const periodId = parseInt(req.params.periodId, 10);
    const status = req.query.status as PaymentStatus | undefined;
    const searchRaw = req.query.search;
    const search = typeof searchRaw === 'string' ? searchRaw.trim() : undefined;

    // Validate status if provided
    if (status && !Object.values(PaymentStatus).includes(status)) {
      res.status(400).json({ success: false, error: 'Invalid payment status' });
      return;
    }

    const payouts = await financeService.getPayoutsByPeriod(periodId, status, search);
    res.json({ success: true, data: payouts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Mark a single payout as paid
 * POST /api/finance/payouts/:payoutId/mark-paid
 */
export async function markAsPaid(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const payoutId = parseInt(req.params.payoutId, 10);
    const userId = req.user!.userId;
    const { comment } = req.body;

    await financeService.markPayoutAsPaid(payoutId, userId, comment);
    res.json({ success: true, message: 'Payout marked as paid' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

/**
 * Batch mark payouts as paid
 * POST /api/finance/payouts/batch-mark-paid
 */
export async function batchMarkAsPaid(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const { payoutIds } = req.body;
    const userId = req.user!.userId;

    if (!payoutIds || !Array.isArray(payoutIds) || payoutIds.length === 0) {
      res.status(400).json({ success: false, error: 'payoutIds array is required' });
      return;
    }

    const result = await financeService.batchMarkAsPaid(payoutIds, userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Cancel a payout
 * POST /api/finance/payouts/:payoutId/cancel
 */
export async function cancelPayout(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const payoutId = parseInt(req.params.payoutId, 10);
    const userId = req.user!.userId;
    const { reason } = req.body;

    if (!reason) {
      res.status(400).json({ success: false, error: 'Cancellation reason is required' });
      return;
    }

    await financeService.cancelPayout(payoutId, userId, reason);
    res.json({ success: true, message: 'Payout cancelled' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}
