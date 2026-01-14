/**
 * PHTS System - Audit Trail Controller
 *
 * Handles HTTP requests for audit trail operations.
 */

import { Request, Response } from 'express';
import { ApiResponse } from '../../types/auth.js';
import * as auditService from './audit.service.js';
import { AuditEventType, AuditSearchFilter } from './audit.service.js';

/**
 * Search audit events with filters
 * GET /api/audit/events
 */
export async function searchEvents(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const filter: AuditSearchFilter = {
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
    };

    // Parse event type(s)
    if (req.query.eventType) {
      const eventTypes = (req.query.eventType as string).split(',');
      if (eventTypes.length === 1) {
        filter.eventType = eventTypes[0] as AuditEventType;
      } else {
        filter.eventType = eventTypes as AuditEventType[];
      }
    }

    // Entity filters
    if (req.query.entityType) {
      filter.entityType = req.query.entityType as string;
    }

    if (req.query.entityId) {
      filter.entityId = parseInt(req.query.entityId as string, 10);
    }

    // Actor filter
    if (req.query.actorId) {
      filter.actorId = parseInt(req.query.actorId as string, 10);
    }

    // Date range
    if (req.query.startDate) {
      filter.startDate = req.query.startDate as string;
    }

    if (req.query.endDate) {
      filter.endDate = req.query.endDate as string;
    }

    // Text search
    if (req.query.search) {
      filter.search = req.query.search as string;
    }

    const result = await auditService.searchAuditEvents(filter);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get audit trail for a specific entity
 * GET /api/audit/entity/:entityType/:entityId
 */
export async function getEntityAuditTrail(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const { entityType, entityId } = req.params;

    if (!entityType || !entityId) {
      res.status(400).json({ success: false, error: 'entityType and entityId are required' });
      return;
    }

    const events = await auditService.getEntityAuditTrail(entityType, parseInt(entityId, 10));
    res.json({ success: true, data: events });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get audit summary
 * GET /api/audit/summary
 */
export async function getSummary(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const summary = await auditService.getAuditSummary(startDate, endDate);
    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Export audit events to JSON (for Excel export on frontend or further processing)
 * GET /api/audit/export
 */
export async function exportEvents(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const filter: Omit<AuditSearchFilter, 'page' | 'limit'> = {};

    // Parse filters same as search
    if (req.query.eventType) {
      const eventTypes = (req.query.eventType as string).split(',');
      if (eventTypes.length === 1) {
        filter.eventType = eventTypes[0] as AuditEventType;
      } else {
        filter.eventType = eventTypes as AuditEventType[];
      }
    }

    if (req.query.entityType) {
      filter.entityType = req.query.entityType as string;
    }

    if (req.query.entityId) {
      filter.entityId = parseInt(req.query.entityId as string, 10);
    }

    if (req.query.actorId) {
      filter.actorId = parseInt(req.query.actorId as string, 10);
    }

    if (req.query.startDate) {
      filter.startDate = req.query.startDate as string;
    }

    if (req.query.endDate) {
      filter.endDate = req.query.endDate as string;
    }

    if (req.query.search) {
      filter.search = req.query.search as string;
    }

    const events = await auditService.getAuditEventsForExport(filter);

    // Log the export action
    await auditService.logAuditEventWithRequest(req, {
      eventType: auditService.AuditEventType.DATA_EXPORT,
      entityType: 'audit_events',
      actionDetail: {
        filter,
        recordCount: events.length,
        exportedAt: new Date().toISOString(),
      },
    });

    res.json({
      success: true,
      data: {
        events,
        exportedAt: new Date().toISOString(),
        recordCount: events.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get available event types for filtering
 * GET /api/audit/event-types
 */
export async function getEventTypes(
  _req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const eventTypes = Object.values(AuditEventType).map((type) => ({
      value: type,
      label: type.replace(/_/g, ' '),
    }));

    res.json({ success: true, data: eventTypes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
