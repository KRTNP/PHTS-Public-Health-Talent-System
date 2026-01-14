/**
 * PHTS System - Data Quality Controller
 *
 * Handles HTTP requests for data quality operations.
 */

import { Request, Response } from 'express';
import { ApiResponse } from '../../types/auth.js';
import * as dataQualityService from './data-quality.service.js';
import { IssueType, IssueSeverity, IssueStatus } from './data-quality.service.js';

/**
 * Get data quality dashboard
 * GET /api/data-quality/dashboard
 */
export async function getDashboard(
  _req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const dashboard = await dataQualityService.getDashboard();
    res.json({ success: true, data: dashboard });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get issue summary
 * GET /api/data-quality/summary
 */
export async function getSummary(
  _req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const summary = await dataQualityService.getIssueSummary();
    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get issues with filters
 * GET /api/data-quality/issues
 */
export async function getIssues(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const type = req.query.type as IssueType | undefined;
    const severity = req.query.severity as IssueSeverity | undefined;
    const status = req.query.status as IssueStatus | undefined;
    const affectsCalc =
      req.query.affectsCalc === 'true'
        ? true
        : req.query.affectsCalc === 'false'
          ? false
          : undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const result = await dataQualityService.getIssues(
      type,
      severity,
      status,
      affectsCalc,
      page,
      limit,
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Create a new issue (manual report)
 * POST /api/data-quality/issues
 */
export async function createIssue(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const { type, severity, entityType, description, entityId, citizenId, affectsCalc } = req.body;

    if (!type || !severity || !entityType || !description) {
      res.status(400).json({
        success: false,
        error: 'type, severity, entityType, and description are required',
      });
      return;
    }

    // Validate enums
    if (!Object.values(IssueType).includes(type)) {
      res.status(400).json({ success: false, error: 'Invalid issue type' });
      return;
    }

    if (!Object.values(IssueSeverity).includes(severity)) {
      res.status(400).json({ success: false, error: 'Invalid severity' });
      return;
    }

    const issueId = await dataQualityService.createIssue(
      type,
      severity,
      entityType,
      description,
      entityId,
      citizenId,
      affectsCalc,
    );

    res.status(201).json({ success: true, data: { issue_id: issueId } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Update issue status
 * PUT /api/data-quality/issues/:id
 */
export async function updateIssue(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const issueId = parseInt(req.params.id, 10);
    const { status, note } = req.body;
    const userId = (req.user as any).id;

    if (!status || !Object.values(IssueStatus).includes(status)) {
      res.status(400).json({ success: false, error: 'Invalid status' });
      return;
    }

    await dataQualityService.updateIssueStatus(issueId, status, userId, note);
    res.json({ success: true, message: 'Issue updated' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Run data quality checks (admin job)
 * POST /api/data-quality/run-checks
 */
export async function runChecks(
  _req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const result = await dataQualityService.runDataQualityChecks();
    res.json({
      success: true,
      data: result,
      message: `Ran ${result.checksRun} checks, found ${result.issuesFound} new issues`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Auto-resolve fixed issues
 * POST /api/data-quality/auto-resolve
 */
export async function autoResolve(
  _req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const resolved = await dataQualityService.autoResolveFixedIssues();
    res.json({
      success: true,
      message: `Auto-resolved ${resolved} issues`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get issue types for filtering
 * GET /api/data-quality/types
 */
export async function getIssueTypes(
  _req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const types = Object.values(IssueType).map((type) => ({
      value: type,
      label: type.replace(/_/g, ' '),
    }));

    res.json({ success: true, data: types });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
