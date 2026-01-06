import { Router } from 'express';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';
import { UserRole } from '../types/auth.js';
import * as systemCtrl from '../controllers/systemController.js';
import * as officerCtrl from '../controllers/officerController.js';

const router = Router();

// All routes require authentication
router.use(protect);

// Officer only access
const officerAuth = restrictTo(UserRole.PTS_OFFICER);

router.get('/holidays', officerAuth, officerCtrl.getHolidays);
router.post('/holidays', officerAuth, officerCtrl.addHoliday);
router.delete('/holidays/:date', officerAuth, officerCtrl.deleteHoliday);

router.get('/rates', officerAuth, officerCtrl.getMasterRates);
router.put('/rates/:rateId', officerAuth, officerCtrl.updateMasterRate);

router.put('/leaves/:id/adjust', officerAuth, officerCtrl.adjustLeaveRequest);

// Admin only
const adminAuth = restrictTo(UserRole.ADMIN);

router.get('/users', adminAuth, systemCtrl.searchUsers);
router.put('/users/:userId/role', adminAuth, systemCtrl.updateUserRole);

router.post('/system/sync', adminAuth, systemCtrl.triggerSync);
router.post('/system/maintenance', adminAuth, systemCtrl.toggleMaintenanceMode);
router.post('/system/backup', adminAuth, systemCtrl.triggerBackup);

export default router;
