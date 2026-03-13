import { requestController } from '@/modules/request/controllers/request.controller.js';
import { requestRepository } from '@/modules/request/data/repositories/request.repository.js';
import { requestQueryService } from '@/modules/request/read/services/query.service.js';
import * as reassignService from '@/modules/request/reassign/application/reassign.service.js';
import { requestCommandService } from '@/modules/request/services/command.service.js';
import { makeJsonRes, makeNext, makeStatusJsonRes, makeUser } from './request.controller.test-helpers.js';

jest.mock('@/modules/request/services/command.service.js', () => ({
  requestCommandService: {
    createRequest: jest.fn(),
    persistManualOcrPrecheck: jest.fn(),
    persistEligibilityManualOcrPrecheck: jest.fn(),
    runEligibilityAttachmentsOcr: jest.fn(),
    updateVerificationChecks: jest.fn(),
  },
}));

jest.mock('@/modules/request/read/services/query.service.js', () => ({
  requestQueryService: {
    getEligibilitySummary: jest.fn(),
    getOcrPrecheckHistory: jest.fn(),
    getRequestById: jest.fn(),
  },
}));

jest.mock('@/modules/request/data/repositories/request.repository.js', () => ({
  requestRepository: {
    findEmployeeExists: jest.fn(),
    findUserCitizenId: jest.fn(),
  },
}));

jest.mock('@/modules/request/reassign/application/reassign.service.js', () => ({
  getReassignmentHistory: jest.fn(),
}));

describe('request.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRequest on behalf', () => {
    it('allows PTS_OFFICER to create request for selected personnel even when actor is not in emp_profiles', async () => {
      const req: any = {
        body: {
          target_user_id: '45927',
          personnel_type: 'CIVIL_SERVANT',
          request_type: 'NEW_ENTRY',
          requested_amount: '1500',
          effective_date: '2026-03-03',
          work_attributes: JSON.stringify({
            operation: true,
            planning: true,
            coordination: true,
            service: true,
          }),
          submission_data: JSON.stringify({
            title: 'นางสาว',
            first_name: 'พีรดา',
            last_name: 'แก้วทอด',
          }),
        },
        files: {},
        user: { userId: 9001, citizenId: '3640500458749', role: 'PTS_OFFICER' },
      };

      const res: any = makeStatusJsonRes();

      (requestRepository.findUserCitizenId as jest.Mock).mockResolvedValue('1100702579863');
      (requestRepository.findEmployeeExists as jest.Mock).mockResolvedValue(true);
      (requestCommandService.createRequest as jest.Mock).mockResolvedValue({
        request_id: 501,
        user_id: 45927,
        citizen_id: '1100702579863',
      });

      const next = makeNext();

      await (requestController.createRequest as any)(req, res, next);

      expect(requestCommandService.createRequest).toHaveBeenCalledWith(
        9001,
        'PTS_OFFICER',
        expect.objectContaining({
          target_user_id: 45927,
        }),
        [],
        undefined,
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('persistManualOcrPrecheck', () => {
    it('passes manual OCR payload through', async () => {
      const req: any = {
        params: { id: '67909' },
        body: {
          service_url: 'http://ocr.test',
          worker: 'browser-manual',
          count: 1,
          success_count: 1,
          failed_count: 0,
          results: [{ name: 'license.pdf', ok: true, markdown: 'ocr text' }],
        },
        user: makeUser(),
      };
      const res: any = makeJsonRes();

      (requestCommandService.persistManualOcrPrecheck as jest.Mock).mockResolvedValue({
        saved: true,
      });

      const next = makeNext();
      await (requestController.persistManualOcrPrecheck as any)(req, res, next);

      expect(requestCommandService.persistManualOcrPrecheck).toHaveBeenCalledWith(
        67909,
        46941,
        'PTS_OFFICER',
        expect.objectContaining({
          service_url: 'http://ocr.test',
          worker: 'browser-manual',
        }),
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { saved: true },
      });
    });
  });

  describe('persistEligibilityManualOcrPrecheck', () => {
    it('passes manual OCR payload through for eligibility detail', async () => {
      const req: any = {
        params: { id: '2978' },
        body: {
          service_url: 'http://ocr.test',
          worker: 'browser-manual',
          count: 1,
          success_count: 1,
          failed_count: 0,
          results: [{ name: 'memo.pdf', ok: true, markdown: 'ocr text' }],
        },
        user: makeUser(),
      };
      const res: any = makeJsonRes();

      (requestCommandService.persistEligibilityManualOcrPrecheck as jest.Mock).mockResolvedValue({
        saved: true,
      });

      const next = makeNext();
      await (requestController.persistEligibilityManualOcrPrecheck as any)(req, res, next);

      expect(requestCommandService.persistEligibilityManualOcrPrecheck).toHaveBeenCalledWith(
        2978,
        46941,
        'PTS_OFFICER',
        expect.objectContaining({
          service_url: 'http://ocr.test',
          worker: 'browser-manual',
        }),
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { saved: true },
      });
    });

    it('runs allowance attachment OCR via backend', async () => {
      const req: any = {
        params: { eligibilityId: '2978' },
        body: {
          attachments: [
            { attachment_id: 11, source: 'eligibility' },
            { attachment_id: 22, source: 'request' },
          ],
        },
        user: makeUser(),
      };
      const res: any = makeJsonRes();

      (requestCommandService.runEligibilityAttachmentsOcr as jest.Mock).mockResolvedValue({
        saved: true,
        count: 2,
        success_count: 2,
        failed_count: 0,
        results: [],
      });

      const next = makeNext();
      await (requestController.runEligibilityAttachmentsOcr as any)(req, res, next);

      expect(requestCommandService.runEligibilityAttachmentsOcr).toHaveBeenCalledWith(
        2978,
        46941,
        'PTS_OFFICER',
        {
          attachments: [
            { attachment_id: 11, source: 'eligibility' },
            { attachment_id: 22, source: 'request' },
          ],
        },
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          saved: true,
          count: 2,
          success_count: 2,
          failed_count: 0,
          results: [],
        },
      });
    });
  });

  describe('getOcrPrecheckHistory', () => {
    it('passes OCR history filters through and returns paged payload', async () => {
      const req: any = {
        query: {
          page: '2',
          limit: '25',
          status: 'failed',
          search: 'REQ-2569-67903',
        },
        user: { userId: 46941, role: 'PTS_OFFICER' },
      };

      const res: any = makeJsonRes();

      (requestQueryService.getOcrPrecheckHistory as jest.Mock).mockResolvedValue({
        items: [
          {
            request_id: 67903,
            request_no: 'REQ-2569-67903',
            status: 'failed',
          },
        ],
        meta: {
          page: 2,
          limit: 25,
          total: 1,
        },
      });

      const next = jest.fn();

      await (requestController.getOcrPrecheckHistory as any)(req, res, next);

      expect(requestQueryService.getOcrPrecheckHistory).toHaveBeenCalledWith({
        page: 2,
        limit: 25,
        status: 'failed',
        search: 'REQ-2569-67903',
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          items: [
            expect.objectContaining({
              request_id: 67903,
              status: 'failed',
            }),
          ],
          meta: expect.objectContaining({
            total: 1,
          }),
        }),
      });
    });
  });

  describe('getEligibilitySummary', () => {
    it('passes summary filters through and returns alert summary payload', async () => {
      const req: any = {
        query: {
          active_only: '1',
          profession_code: 'NURSE',
          search: 'ปราณี',
          rate_group: '2',
          department: 'กลุ่มงานการพยาบาลผู้ป่วยอุบัติเหตุและฉุกเฉิน',
          sub_department: 'งานอุบัติเหตุและฉุกเฉิน (ER)',
          license_status: 'expiring',
          alert_filter: 'error',
        },
        user: makeUser({ userId: 10 }),
      };

      const res: any = makeJsonRes();

      (requestQueryService.getEligibilitySummary as jest.Mock).mockResolvedValue({
        updated_at: '2026-03-03T09:34:16.000Z',
        total_people: 75,
        total_rate_amount: 127500,
        alert_summary: {
          people_with_alerts: 75,
          critical_people: 0,
          no_license_people: 0,
          duplicate_people: 0,
          upcoming_change_people: 0,
        },
        by_profession: [
          {
            profession_code: 'NURSE',
            people_count: 75,
            total_rate_amount: 127500,
            people_with_alerts: 75,
            critical_people: 0,
            no_license_people: 0,
            duplicate_people: 0,
            upcoming_change_people: 0,
          },
        ],
      });

      const next = makeNext();

      await (requestController.getEligibilitySummary as any)(req, res, next);

      expect(requestQueryService.getEligibilitySummary).toHaveBeenCalledWith({
        activeOnly: true,
        professionCode: 'NURSE',
        search: 'ปราณี',
        rateGroup: '2',
        department: 'กลุ่มงานการพยาบาลผู้ป่วยอุบัติเหตุและฉุกเฉิน',
        subDepartment: 'งานอุบัติเหตุและฉุกเฉิน (ER)',
        licenseStatus: 'expiring',
        alertFilter: 'error',
        expiringDays: 90,
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          total_people: 75,
          alert_summary: expect.objectContaining({
            people_with_alerts: 75,
          }),
        }),
      });
    });
  });

  describe('getReassignHistory', () => {
    it('rejects ADMIN from request workflow history endpoint', async () => {
      const req: any = {
        params: { id: '123' },
        user: makeUser({ userId: 1, role: 'ADMIN' }),
      };
      const res: any = makeJsonRes();
      const next = makeNext();

      await (requestController.getReassignHistory as any)(req, res, next);

      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err?.message).toContain('ADMIN');
    });

    it('returns history for non-admin with access', async () => {
      const req: any = {
        params: { id: '123' },
        user: makeUser({ userId: 10 }),
      };
      const res: any = makeJsonRes();
      const next = makeNext();

      (requestQueryService.getRequestById as jest.Mock).mockResolvedValue({ request_id: 123 });
      (reassignService.getReassignmentHistory as jest.Mock).mockResolvedValue([{ actionId: 1 }]);

      await (requestController.getReassignHistory as any)(req, res, next);

      expect(requestQueryService.getRequestById).toHaveBeenCalledWith(123, 10, 'PTS_OFFICER');
      expect(reassignService.getReassignmentHistory).toHaveBeenCalledWith(123);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ actionId: 1 }] });
    });
  });

  describe('updateVerificationChecks', () => {
    it('calls command service and returns updated request payload', async () => {
      const req: any = {
        params: { id: '42' },
        body: {
          qualification_check: { passed: true },
          evidence_check: { passed: true },
        },
        user: makeUser({ userId: 10 }),
      };

      const res: any = makeJsonRes();

      (requestCommandService.updateVerificationChecks as jest.Mock).mockResolvedValue({
        request_id: 42,
        status: 'PENDING',
      });

      const next = makeNext();

      await (requestController.updateVerificationChecks as any)(req, res, next);

      expect(requestCommandService.updateVerificationChecks).toHaveBeenCalledWith(
        42,
        10,
        'PTS_OFFICER',
        req.body,
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { request_id: 42, status: 'PENDING' },
      });
    });
  });
});
