/**
 * personnel-changes module - route map
 *
 */
import { Router } from "express";
import { protect, restrictTo } from "@middlewares/authMiddleware.js";
import { validate } from "@shared/validate.middleware.js";
import { UserRole } from "@/types/auth.js";
import {
  getPersonnelMovements,
  getRetirements,
  postPersonnelMovement,
  putPersonnelMovement,
  removePersonnelMovement,
  postRetirement,
  putRetirement,
  removeRetirement,
} from "@/modules/workforce-compliance/controllers/workforce-compliance.controller.js";
import {
  retirementCreateSchema,
  retirementIdSchema,
  retirementUpdateSchema,
  movementCreateSchema,
  movementUpdateSchema,
  movementIdSchema,
} from "@/modules/workforce-compliance/workforce-compliance.schema.js";

const router = Router();

router.get(
  "/retirements",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  getRetirements,
);

router.get(
  "/movements",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  getPersonnelMovements,
);

router.post(
  "/movements",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  validate(movementCreateSchema),
  postPersonnelMovement,
);

router.put(
  "/movements/:id",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  validate(movementUpdateSchema),
  putPersonnelMovement,
);

router.delete(
  "/movements/:id",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  validate(movementIdSchema),
  removePersonnelMovement,
);

router.post(
  "/retirements",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  validate(retirementCreateSchema),
  postRetirement,
);

router.put(
  "/retirements/:id",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  validate(retirementUpdateSchema),
  putRetirement,
);

router.delete(
  "/retirements/:id",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  validate(retirementIdSchema),
  removeRetirement,
);

export default router;
