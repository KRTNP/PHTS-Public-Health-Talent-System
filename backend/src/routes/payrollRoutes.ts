import { Router } from 'express';
import { payrollController } from '../controllers/payrollController.js';
// import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = Router();

// router.use(protect);

// 1. คำนวณเงิน (ควรให้สิทธิ์เฉพาะ ADMIN หรือ HR/FINANCE)
// POST /api/payroll/calculate
router.post('/calculate', payrollController.calculatePayroll);

// 2. ดูรายการงวดเดือน
// GET /api/payroll/periods
router.get('/periods', payrollController.getPeriods);

// 3. ดูรายชื่อคนในงวดนั้น
// GET /api/payroll/periods/:id/payouts
router.get('/periods/:id/payouts', payrollController.getPayouts);

export default router;
