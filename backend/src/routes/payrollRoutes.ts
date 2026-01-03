import { Router } from "express";
import { payrollController } from "../controllers/payrollController.js";
import { calculatePayrollValidator } from "../validators/payrollValidators.js";
// import { protect, restrictTo } from "../middlewares/authMiddleware.js";

const router = Router();

// router.use(protect);

// 1. ?????????????? (????????????????? ADMIN ???? HR/FINANCE)
// POST /api/payroll/calculate
router.post('/calculate', calculatePayrollValidator, payrollController.calculatePayroll);

// 2. ????????????????
// GET /api/payroll/periods
router.get('/periods', payrollController.getPeriods);

// 3. ????????????????????
// GET /api/payroll/periods/:id/payouts
router.get('/periods/:id/payouts', payrollController.getPayouts);

export default router;
