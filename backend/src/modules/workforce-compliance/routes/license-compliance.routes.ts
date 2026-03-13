/**
 * license-compliance module - route map
 *
 */
import { Router } from "express";
import { protect, restrictTo } from "@middlewares/authMiddleware.js";
import { validate } from "@shared/validate.middleware.js";
import { UserRole } from "@/types/auth.js";
import {
  getLicenseList,
  postLicenseNotify,
  getLicenseSummary,
} from "@/modules/workforce-compliance/controllers/license-compliance.controller.js";
import { licenseNotifySchema } from "@/modules/workforce-compliance/workforce-compliance.schema.js";

const router = Router();

router.get(
  "/summary",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  getLicenseSummary,
);

router.get(
  "/list",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  getLicenseList,
);

router.post(
  "/notify",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  validate(licenseNotifySchema),
  postLicenseNotify,
);

export default router;
