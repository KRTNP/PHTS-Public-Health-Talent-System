/**
 * PHTS System - Request Controller
 * Refactored to Class-based structure
 *
 * Handles HTTP requests for PTS Request module, delegating business logic to services.
 */

import { Request, Response } from "express";
import { ApiResponse, UserRole } from "@/types/auth.js";

// Services
import { requestQueryService } from "@/modules/request/read/services/query.service.js";
import { requestCommandService } from "@/modules/request/services/command.service.js";

import {
  getUserScopesForDisplay,
  getUserScopesWithMembers,
} from "@/modules/request/scope/application/scope.service.js";

import { requestRepository } from "@/modules/request/data/repositories/request.repository.js";
import { cleanupUploadSession } from "@/modules/request/helpers/utils.js";

import { createRequestSchema } from "@/modules/request/dto/create-request.dto.js";
import { updateRequestSchema } from "@/modules/request/dto/update-request.dto.js";

import {
  catchAsync,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
} from "@shared/utils/errors.js";
import { resolveProfessionCode } from "@shared/utils/profession.js";
import { ELIGIBILITY_EXPIRING_DAYS } from "@/modules/request/contracts/request.constants.js";
import {
  hasEligibilityFilters,
  parseEligibilityFilters,
  parsePositiveInt,
  readOptionalQueryString,
} from "@/modules/request/api/helpers/request-query.helper.js";
import {
  buildEligibilityCsv,
  buildEligibilityCsvFileName,
} from "@/modules/request/api/helpers/eligibility-csv.helper.js";
import { dispatchRequestAction } from "@/modules/request/api/helpers/request-action-dispatcher.helper.js";
import {
  collectEligibilityAttachmentUploadFiles,
  collectRequestUploadFiles,
} from "@/modules/request/api/helpers/request-upload-files.helper.js";
import { parseEligibilityExportFilters } from "@/modules/request/api/helpers/request-eligibility-export-filter.helper.js";
import {
  parseFiniteNumberParam,
  resolveRequestIdFromParam,
} from "@/modules/request/api/helpers/request-param-resolver.helper.js";

export class RequestController {
  // --- READ Operations ---

  getRequestById = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      assertNotAdmin(req);
      const rawId = String(req.params.id || "");
      const requestId = await resolveRequestIdFromParam(rawId);

      const request = await requestQueryService.getRequestById(
        requestId,
        req.user.userId,
        req.user.role,
      );

      res.json({ success: true, data: request });
    },
  );

  getMyRequests = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      assertNotAdmin(req);
      const requests = await requestQueryService.getMyRequests(req.user.userId);
      res.json({ success: true, data: requests });
    },
  );

  getHistory = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
    if (!req.user) throw new AuthenticationError("Unauthorized access");
    const view = req.query.view === "mine" ? "mine" : "team";
    const includeAllActions = req.query.actions === "all";
    const history = await requestQueryService.getApprovalHistory(
      req.user.userId,
      req.user.role,
      { view, includeAllActions },
    );
    res.json({ success: true, data: history });
  });

  getOcrPrecheckHistory = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 20);
      const status = readOptionalQueryString(req.query, "status");
      const search = readOptionalQueryString(req.query, "search");
      const data = await requestQueryService.getOcrPrecheckHistory({
        page: Number.isFinite(page) && page > 0 ? page : 1,
        limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20,
        status,
        search,
      });
      res.json({ success: true, data });
    },
  );

  getPendingApprovals = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      const scopeParam = req.query.scope as string | undefined;
      const requests = await requestQueryService.getPendingForApprover(
        req.user.role,
        req.user.userId,
        scopeParam,
      );
      res.json({ success: true, data: requests });
    },
  );

  getEligibilityList = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      const activeOnlyParam = String(req.query.active_only ?? "1");
      const activeOnly = activeOnlyParam === "1";
      const inactiveOnly = activeOnlyParam === "2";
      const hasAnyFilter = hasEligibilityFilters(req.query);

      if (!hasAnyFilter && !inactiveOnly) {
        const rows = await requestQueryService.getEligibilityList(activeOnly);
        res.json({ success: true, data: rows });
        return;
      }

      const filters = parseEligibilityFilters(req.query);

      const data = await requestQueryService.getEligibilityListPaged({
        activeOnly,
        inactiveOnly,
        page: filters.page,
        limit: filters.limit,
        professionCode: filters.professionCode,
        search: filters.search,
        rateGroup: filters.rateGroup,
        department: filters.department,
        subDepartment: filters.subDepartment,
        licenseStatus: filters.licenseStatus,
        alertFilter: filters.alertFilter,
        expiringDays: ELIGIBILITY_EXPIRING_DAYS,
      });

      res.json({ success: true, data });
    },
  );

  getEligibilitySummary = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      const activeOnly = String(req.query.active_only ?? "1") !== "0";
      const filters = parseEligibilityFilters(req.query);
      const data = await requestQueryService.getEligibilitySummary({
        activeOnly,
        professionCode: filters.professionCode,
        search: filters.search,
        rateGroup: filters.rateGroup,
        department: filters.department,
        subDepartment: filters.subDepartment,
        licenseStatus: filters.licenseStatus,
        alertFilter: filters.alertFilter,
        expiringDays: ELIGIBILITY_EXPIRING_DAYS,
      });
      res.json({ success: true, data });
    },
  );

  uploadEligibilityAttachments = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      let eligibilityId: number;
      try {
        eligibilityId = parseFiniteNumberParam(
          req.params.eligibilityId,
          "Invalid eligibility ID",
        );
      } catch (error) {
        cleanupUploadSession(req);
        throw error;
      }

      const allFiles = collectEligibilityAttachmentUploadFiles(
        req.files as { [fieldname: string]: Express.Multer.File[] } | undefined,
      );

      let data;
      try {
        data = await requestCommandService.addEligibilityAttachments(
          eligibilityId,
          req.user.userId,
          allFiles,
        );
      } catch (error) {
        cleanupUploadSession(req);
        throw error;
      }
      res
        .status(201)
        .json({ success: true, data, message: "อัปโหลดไฟล์แนบสำเร็จ" });
    },
  );

  removeEligibilityAttachment = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      const eligibilityId = parseFiniteNumberParam(
        req.params.eligibilityId,
        "Invalid attachment identifier",
      );
      const attachmentId = parseFiniteNumberParam(
        req.params.attachmentId,
        "Invalid attachment identifier",
      );

      const data = await requestCommandService.removeEligibilityAttachment(
        eligibilityId,
        attachmentId,
        req.user.userId,
      );
      res.json({ success: true, data, message: "ลบไฟล์แนบสำเร็จ" });
    },
  );

  exportEligibilityCsv = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AuthenticationError("Unauthorized access");
    const filters = parseEligibilityExportFilters(req.query);

    // Hard safety guard to avoid accidental huge exports.
    const meta = await requestRepository.findEligibilityListMeta({
      activeOnly: filters.activeOnly,
      professionCode: filters.professionCode,
      search: filters.search,
      rateGroup: filters.rateGroup,
      department: filters.department,
      subDepartment: filters.subDepartment,
      licenseStatus: filters.licenseStatus,
      alertFilter: filters.alertFilter,
      expiringDays: ELIGIBILITY_EXPIRING_DAYS,
    });
    const maxRows = 20000;
    if (meta.total > maxRows) {
      res.status(413).json({
        success: false,
        error: `Too many rows to export (${meta.total}). Please narrow filters (max ${maxRows}).`,
      });
      return;
    }

    const rows = await requestRepository.findEligibilityListPaged(
      {
        activeOnly: filters.activeOnly,
        professionCode: filters.professionCode,
        search: filters.search,
        rateGroup: filters.rateGroup,
        department: filters.department,
        subDepartment: filters.subDepartment,
        licenseStatus: filters.licenseStatus,
        alertFilter: filters.alertFilter,
        expiringDays: ELIGIBILITY_EXPIRING_DAYS,
      },
      1,
      maxRows,
    );

    const fileName = buildEligibilityCsvFileName();
    const csv = buildEligibilityCsv(rows as Array<Record<string, unknown>>);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.status(200).send(csv);
  });

  getEligibilityById = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      const eligibilityId = parseFiniteNumberParam(
        req.params.eligibilityId,
        "Invalid eligibility ID",
      );
      const row = await requestQueryService.getEligibilityById(
        eligibilityId,
        req.user.userId,
        req.user.role,
      );
      res.json({ success: true, data: row });
    },
  );

  setPrimaryEligibility = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      const eligibilityId = parseFiniteNumberParam(
        req.params.eligibilityId,
        "Invalid eligibility ID",
      );
      const data = await requestCommandService.setPrimaryEligibility(
        eligibilityId,
        req.user.userId,
        req.user.role,
        typeof req.body?.reason === "string" ? req.body.reason : null,
      );
      res.json({
        success: true,
        data,
        message: "ตั้งเป็นสิทธิ์ใช้งานหลักแล้ว",
      });
    },
  );

  deactivateEligibility = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      const eligibilityId = parseFiniteNumberParam(
        req.params.eligibilityId,
        "Invalid eligibility ID",
      );
      const data = await requestCommandService.deactivateEligibilityById(
        eligibilityId,
        req.user.userId,
        req.user.role,
        typeof req.body?.reason === "string" ? req.body.reason : null,
      );
      res.json({ success: true, data, message: "ปิดสิทธิ์เรียบร้อย" });
    },
  );

  reactivateEligibility = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      const eligibilityId = parseFiniteNumberParam(
        req.params.eligibilityId,
        "Invalid eligibility ID",
      );
      const data = await requestCommandService.reactivateEligibilityById(
        eligibilityId,
        req.user.userId,
        req.user.role,
        typeof req.body?.reason === "string" ? req.body.reason : null,
      );
      res.json({ success: true, data, message: "เปิดสิทธิ์กลับเรียบร้อย" });
    },
  );

  // --- WRITE Operations ---

  createRequest = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      assertNotAdmin(req);

      const validation = createRequestSchema.safeParse(req);
      if (!validation.success) {
        cleanupUploadSession(req);
        // ZodError 'errors' property is valid for SafeParseError
        throw new ValidationError("Validation failed", {
          errors: (validation as any).error.format(),
        });
      }

      const { allFiles, signatureFile } = collectRequestUploadFiles(
        req.files as { [fieldname: string]: Express.Multer.File[] } | undefined,
      );

      const requestData = validation.data.body;
      const targetUserId = requestData.target_user_id;
      const targetCitizenId =
        req.user.role === UserRole.PTS_OFFICER && targetUserId
          ? await requestRepository.findUserCitizenId(targetUserId)
          : req.user.citizenId;
      if (!targetCitizenId) {
        cleanupUploadSession(req);
        res.status(404).json({ success: false, error: "Employee not found" });
        return;
      }

      const employeeExists =
        await requestRepository.findEmployeeExists(targetCitizenId);
      if (!employeeExists) {
        cleanupUploadSession(req);
        res.status(404).json({ success: false, error: "Employee not found" });
        return;
      }

      const request = await requestCommandService.createRequest(
        req.user.userId,
        req.user.role,
        requestData,
        allFiles,
        signatureFile,
      );

      res.status(201).json({
        success: true,
        data: request,
        message: "Request created successfully",
      });
    },
  );

  updateRequest = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      assertNotAdmin(req);
      const requestId = parseInt(req.params.id);

      const validation = updateRequestSchema.safeParse(req);
      if (!validation.success) {
        cleanupUploadSession(req);
        throw new ValidationError("Validation failed", {
          errors: (validation as any).error.format(),
        });
      }

      const { allFiles, signatureFile } = collectRequestUploadFiles(
        req.files as { [fieldname: string]: Express.Multer.File[] } | undefined,
      );

      const requestData = validation.data.body;

      const updated = await requestCommandService.updateRequest(
        requestId,
        req.user.userId,
        req.user.role,
        requestData,
        allFiles,
        signatureFile,
      );

      res.json({ success: true, data: updated });
    },
  );

  removeRequestAttachment = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      assertNotAdmin(req);
      const requestId = parseInt(req.params.id);
      const attachmentId = Number(req.params.attachmentId);
      if (!Number.isFinite(requestId) || !Number.isFinite(attachmentId)) {
        throw new ValidationError("Invalid attachment identifier");
      }

      const updated = await requestCommandService.removeRequestAttachment(
        requestId,
        attachmentId,
        req.user.userId,
        req.user.role,
      );

      res.json({ success: true, data: updated, message: "ลบไฟล์แนบสำเร็จ" });
    },
  );

  createVerificationSnapshot = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      const requestId = parseInt(req.params.id);

      const snapshot = await requestCommandService.createVerificationSnapshot(
        requestId,
        req.user.userId,
        req.user.role,
        req.body,
      );

      res.status(201).json({ success: true, data: snapshot });
    },
  );

  // --- ACTIONS ---

  processAction = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      const requestId = parseInt(req.params.id);
      const { action, comment, signature_base64 } = req.body;
      const result = await dispatchRequestAction({
        action,
        requestId,
        userId: req.user.userId,
        userRole: req.user.role,
        comment,
        signatureBase64: signature_base64,
      });

      res.json({ success: true, data: result });
    },
  );

  // --- OTHER ---

  getPrefill = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
    if (!req.user?.citizenId) throw new AuthenticationError("Unauthorized");
    assertNotAdmin(req);
    const targetUserId = parsePositiveInt(req.query.target_user_id);
    let citizenId = req.user.citizenId;

    if (targetUserId) {
      if (req.user.role !== UserRole.PTS_OFFICER) {
        throw new AuthorizationError(
          "มีสิทธิ์เลือกบุคลากรได้เฉพาะเจ้าหน้าที่ พ.ต.ส.",
        );
      }
      const targetCitizenId =
        await requestRepository.findUserCitizenId(targetUserId);
      if (!targetCitizenId) {
        throw new ValidationError("ไม่พบบุคลากรที่เลือก");
      }
      citizenId = targetCitizenId;
    }

    const emp = await requestRepository.findEmployeeProfile(citizenId);

    if (!emp) {
      res.json({ success: true, data: null });
      return;
    }
    const professionCode = resolveProfessionCode(emp.position_name || "");

    res.json({
      success: true,
      data: { ...emp, profession_code: professionCode },
    });
  });

  searchPersonnelOptions = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      if (req.user.role !== UserRole.PTS_OFFICER) {
        throw new AuthorizationError(
          "มีสิทธิ์ค้นหาบุคลากรได้เฉพาะเจ้าหน้าที่ พ.ต.ส.",
        );
      }

      const search = readOptionalQueryString(req.query, "search") ?? "";
      const limit = parsePositiveInt(req.query.limit) ?? 20;
      const rows = await requestRepository.searchPersonnelOptions(
        search,
        limit,
      );
      const data = rows.map((row) => ({
        user_id: Number(row.user_id),
        citizen_id: String(row.citizen_id ?? ""),
        title: row.title ?? null,
        first_name: row.first_name ?? null,
        last_name: row.last_name ?? null,
        position_name: row.position_name ?? null,
        position_number: row.position_number ?? null,
        department: row.department ?? null,
        sub_department: row.sub_department ?? null,
        emp_type: row.emp_type ?? null,
      }));
      res.json({ success: true, data });
    },
  );

  getMyScopes = catchAsync(async (req: Request, res: Response<ApiResponse>) => {
    if (!req.user?.userId) throw new AuthenticationError("Unauthorized");
    if (!req.user?.role) throw new AuthenticationError("Unauthorized");

    const scopes = await getUserScopesForDisplay(
      req.user.userId,
      req.user.role,
    );
    res.json({ success: true, data: scopes });
  });

  getMyScopeMembers = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user?.userId) throw new AuthenticationError("Unauthorized");
      if (!req.user?.role) throw new AuthenticationError("Unauthorized");

      const scopeMembers = await getUserScopesWithMembers(
        req.user.userId,
        req.user.role,
      );
      res.json({ success: true, data: scopeMembers });
    },
  );

  confirmAttachments = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      assertNotAdmin(req);
      const requestId = parseInt(req.params.id);
      if (isNaN(requestId)) throw new ValidationError("Invalid Request ID");
      const result = await requestCommandService.confirmAttachments(
        requestId,
        req.user.userId,
      );
      res.json({
        success: true,
        data: result,
        message: "Attachments confirmed",
      });
    },
  );

  updateRateMapping = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      assertNotAdmin(req);
      const requestId = parseInt(req.params.id);
      const { group_no, item_no, sub_item_no } = req.body;

      const result = await requestCommandService.updateRateMapping(
        requestId,
        req.user.userId,
        req.user.role,
        { group_no, item_no, sub_item_no },
      );

      res.json({ success: true, data: result });
    },
  );

  persistManualOcrPrecheck = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      assertNotAdmin(req);
      const requestId = parseInt(req.params.id);
      const result = await requestCommandService.persistManualOcrPrecheck(
        requestId,
        req.user.userId,
        req.user.role,
        req.body,
      );
      res.json({ success: true, data: result });
    },
  );

  runRequestAttachmentsOcr = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      assertNotAdmin(req);
      const requestId = parseInt(req.params.id);
      const result = await requestCommandService.runRequestAttachmentsOcr(
        requestId,
        req.user.userId,
        req.user.role,
        req.body,
      );
      res.json({ success: true, data: result });
    },
  );

  clearRequestAttachmentOcr = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      assertNotAdmin(req);
      const requestId = parseInt(req.params.id);
      const result = await requestCommandService.clearRequestAttachmentOcr(
        requestId,
        req.user.userId,
        req.user.role,
        req.body.file_name,
      );
      res.json({ success: true, data: result });
    },
  );

  persistEligibilityManualOcrPrecheck = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      assertNotAdmin(req);
      const eligibilityId = parseInt(req.params.id);
      const result =
        await requestCommandService.persistEligibilityManualOcrPrecheck(
          eligibilityId,
          req.user.userId,
          req.user.role,
          req.body,
        );
      res.json({ success: true, data: result });
    },
  );

  runEligibilityAttachmentsOcr = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      assertNotAdmin(req);
      const eligibilityId = parseInt(req.params.eligibilityId);
      const result = await requestCommandService.runEligibilityAttachmentsOcr(
        eligibilityId,
        req.user.userId,
        req.user.role,
        req.body,
      );
      res.json({ success: true, data: result });
    },
  );

  clearEligibilityAttachmentOcr = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      assertNotAdmin(req);
      const eligibilityId = parseInt(req.params.eligibilityId);
      const result = await requestCommandService.clearEligibilityAttachmentOcr(
        eligibilityId,
        req.user.userId,
        req.user.role,
        req.body.file_name,
      );
      res.json({ success: true, data: result });
    },
  );

  updateVerificationChecks = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      const requestId = parseInt(req.params.id);
      const result = await requestCommandService.updateVerificationChecks(
        requestId,
        req.user.userId,
        req.user.role,
        req.body,
      );
      res.json({ success: true, data: result });
    },
  );

  cancelRequest = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      assertNotAdmin(req);
      const user = req.user;
      const requestId = parseInt(req.params.id);
      await requestCommandService.cancelRequest(requestId, user.userId);
      res.json({ success: true, message: "Cancelled" });
    },
  );

  submitRequest = catchAsync(
    async (req: Request, res: Response<ApiResponse>) => {
      if (!req.user) throw new AuthenticationError("Unauthorized access");
      assertNotAdmin(req);
      const user = req.user;
      const requestId = parseInt(req.params.id);
      const result = await requestCommandService.submitRequest(
        requestId,
        user.userId,
        user.role,
      );
      res.json({ success: true, message: "Submitted", data: result });
    },
  );

}

const assertNotAdmin = (req: Request) => {
  if (req.user?.role === UserRole.ADMIN) {
    throw new AuthorizationError("ADMIN ไม่สามารถทำรายการคำขอได้");
  }
};

export const requestController = new RequestController();
