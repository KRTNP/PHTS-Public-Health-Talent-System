import { Router } from 'express';
import {
  approveByDirector,
  approveByHR,
  approveByHeadFinance,
  calculateOnDemand,
  calculatePeriod,
  getPeriodStatus,
  rejectPeriod,
  submitToHR,
} from '../controllers/payrollController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';
import { UserRole } from '../types/auth.js';

const router = Router();

// View period status (authenticated dashboard users)
router.get('/period', protect, getPeriodStatus);

// Ad-hoc calculation for a single employee (integration tests/tools)
router.post(
  '/calculate',
  protect,
  restrictTo(
    UserRole.ADMIN,
    UserRole.PTS_OFFICER,
    UserRole.HEAD_FINANCE,
    UserRole.DIRECTOR,
    UserRole.HEAD_HR,
  ),
  calculateOnDemand,
);

// Calculate (OFFICER/ADMIN)
router.post(
  '/period/:periodId/calculate',
  protect,
  restrictTo(UserRole.PTS_OFFICER, UserRole.ADMIN),
  calculatePeriod,
);

// Submit to HR (OFFICER/ADMIN)
router.post(
  '/period/:periodId/submit',
  protect,
  restrictTo(UserRole.PTS_OFFICER, UserRole.ADMIN),
  submitToHR,
);

// Approve by HR
router.post(
  '/period/:periodId/approve-hr',
  protect,
  restrictTo(UserRole.HEAD_HR, UserRole.ADMIN),
  approveByHR,
);

// Approve by Director
router.post(
  '/period/:periodId/approve-director',
  protect,
  restrictTo(UserRole.DIRECTOR, UserRole.ADMIN),
  approveByDirector,
);

// Approve by Head Finance
router.post(
  '/period/:periodId/approve-head-finance',
  protect,
  restrictTo(UserRole.HEAD_FINANCE, UserRole.ADMIN),
  approveByHeadFinance,
);

// Reject (HR/Director/Admin)
router.post(
  '/period/:periodId/reject',
  protect,
  restrictTo(UserRole.HEAD_HR, UserRole.DIRECTOR, UserRole.ADMIN),
  rejectPeriod,
);

export default router;
