import { requestQueryService } from '@/modules/request/read/services/query.service.js';
import { requestRepository } from '@/modules/request/data/repositories/request.repository.js';
import { OcrRequestRepository } from '@/modules/ocr/repositories/ocr-request.repository.js';

describe('RequestQueryService query methods', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('getRequestDetails OCR precheck', () => {
    it('hydrates OCR precheck from dedicated OCR table when submission_data has no OCR payload', async () => {
      jest.spyOn(requestRepository, 'findById').mockResolvedValue({
        request_id: 2001,
        user_id: 21,
        citizen_id: '1100501215023',
        request_no: 'REQ-2569-2001',
        personnel_type: 'CIVIL_SERVANT',
        current_position_number: '66001',
        current_department: 'กลุ่มงานเภสัชกรรม',
        main_duty: 'บริการ',
        work_attributes: {
          operation: true,
          service: true,
        },
        request_type: 'NEW_ENTRY',
        requested_amount: 3000,
        effective_date: '2026-02-01',
        status: 'PENDING',
        current_step: 3,
        submission_data: {
          title: 'นางสาว',
          first_name: 'นันทิชา',
        },
        created_at: '2026-02-01T01:00:00.000Z',
        updated_at: '2026-02-17T10:00:00.000Z',
      } as any);
      jest.spyOn(requestRepository, 'findAttachmentsWithMetadata').mockResolvedValue([]);
      jest.spyOn(requestRepository, 'findApprovalsWithActor').mockResolvedValue([]);
      jest.spyOn(requestRepository, 'findLatestVerificationSnapshotByRequestId').mockResolvedValue(null);
      jest.spyOn(requestRepository, 'findLatestEligibilityByRequestId').mockResolvedValue({
        eligibility_id: 3363,
        profession_code: 'NURSE',
        is_active: 1,
      } as any);
      jest.spyOn(OcrRequestRepository, 'findRequestPrecheck').mockResolvedValue({
        request_id: 2001,
        status: 'completed',
        service_url: 'http://ocr.test',
        worker: 'redis-list',
        count: 1,
        success_count: 1,
        failed_count: 0,
        started_at: '2026-03-03T10:00:00.000Z',
        finished_at: '2026-03-03T10:01:00.000Z',
        error: null,
        results: [
          {
            name: 'license.pdf',
            ok: true,
            markdown: 'ocr text',
          },
        ],
      } as any);

      const result = await requestQueryService.getRequestDetails(2001);

      expect(OcrRequestRepository.findRequestPrecheck).toHaveBeenCalledWith(2001);
      expect(result.ocr_precheck).toEqual(
        expect.objectContaining({
          status: 'completed',
          service_url: 'http://ocr.test',
        }),
      );
      expect(result.linked_eligibility).toEqual({
        eligibility_id: 3363,
        profession_code: 'NURSE',
        is_active: true,
      });
      expect((result.submission_data as any).ocr_precheck).toBeUndefined();
    });
  });

  describe('getApprovalHistory', () => {
    it('returns requester profile and approval actions for history rows', async () => {
      jest.spyOn(requestRepository, 'findUserIdsByRole').mockResolvedValue([99]);
      jest
        .spyOn(requestRepository, 'findApprovalHistoryIdsForActors')
        .mockResolvedValue([{ request_id: 1001, last_action_date: new Date('2026-02-17T12:00:00.000Z') }]);
      jest.spyOn(requestRepository, 'findByIds').mockResolvedValue([
        {
          request_id: 1001,
          user_id: 21,
          citizen_id: '1100501215023',
          request_no: 'REQ-2569-1001',
          personnel_type: 'CIVIL_SERVANT',
          current_position_number: '66001',
          current_department: 'กลุ่มงานเภสัชกรรม',
          main_duty: 'บริการ',
          work_attributes: {
            operation: true,
            planning: false,
            coordination: false,
            service: true,
          },
          request_type: 'NEW_ENTRY',
          requested_amount: 3000,
          effective_date: '2026-02-01',
          status: 'PENDING',
          current_step: 2,
          submission_data: {},
          created_at: '2026-02-01T01:00:00.000Z',
          updated_at: '2026-02-17T10:00:00.000Z',
          requester_first_name: 'นันทิชา',
          requester_last_name: 'ทักเดือน',
          requester_position: 'เภสัชกร',
        } as any,
      ]);
      jest.spyOn(requestRepository, 'findAttachmentsWithMetadata').mockResolvedValue([]);
      jest.spyOn(requestRepository, 'findApprovalsWithActor').mockResolvedValue([
        {
          action_id: 77,
          request_id: 1001,
          actor_id: 12,
          action: 'APPROVE',
          step_no: 2,
          comment: 'ok',
          created_at: '2026-02-17T11:30:00.000Z',
          actor_citizen_id: '1234567890123',
          actor_role: 'HEAD_SCOPE',
          actor_first_name: 'หัวหน้า',
          actor_last_name: 'กลุ่มงาน',
        } as any,
      ]);

      const result = await requestQueryService.getApprovalHistory(12, 'HEAD_HR');

      expect(result).toHaveLength(1);
      expect(result[0].requester).toMatchObject({
        first_name: 'นันทิชา',
        last_name: 'ทักเดือน',
        position: 'เภสัชกร',
      });
      expect(result[0].actions).toHaveLength(1);
      expect(result[0].actions?.[0]?.action).toBe('APPROVE');
    });
  });

  describe('getOcrPrecheckHistory', () => {
    it('returns OCR history items with engine and document kind metadata', async () => {
      jest.spyOn(OcrRequestRepository, 'findRequestPrecheckHistory').mockResolvedValue({
        items: [
          {
            request_id: 67909,
            request_no: 'REQ-2569-67909',
            status: 'completed',
            success_count: 1,
            failed_count: 0,
            engine_used: 'tesseract',
            document_kind: 'memo',
            fallback_used: false,
            fields: {
              document_no: 'อต 0033.104/000953',
            },
            missing_fields: [],
            fallback_reason: null,
            quality: {
              required_fields: 3,
              captured_fields: 3,
              passed: true,
            },
          } as any,
        ],
        total: 1,
      });

      const result = await requestQueryService.getOcrPrecheckHistory({
        page: 1,
        limit: 20,
        status: 'completed',
        search: '67909',
      });

      expect(result).toEqual({
        items: [
          expect.objectContaining({
            request_id: 67909,
            status: 'completed',
            engine_used: 'tesseract',
            document_kind: 'memo',
            fallback_used: false,
            fields: {
              document_no: 'อต 0033.104/000953',
            },
            missing_fields: [],
            quality: {
              required_fields: 3,
              captured_fields: 3,
              passed: true,
            },
          }),
        ],
        meta: {
          page: 1,
          limit: 20,
          total: 1,
        },
      });
    });
  });

  describe('getRequestById read access', () => {
    it('allows officer-on-behalf creator to read request across roles', async () => {
      jest.spyOn(requestRepository, 'findById').mockResolvedValue({
        request_id: 67918,
        user_id: 12345,
        citizen_id: '1234567890123',
        submission_data: JSON.stringify({
          created_by_officer_id: 49000,
          created_by_officer_role: 'PTS_OFFICER',
          created_mode: 'OFFICER_ON_BEHALF',
        }),
        first_name: 'ทดสอบ',
        last_name: 'ระบบ',
        position_name: 'พยาบาลวิชาชีพ',
        license_no: null,
        license_name: null,
        license_valid_from: null,
        license_valid_until: null,
        license_raw_status: null,
      } as any);
      jest.spyOn(requestQueryService, 'getRequestDetails').mockResolvedValue({ request_id: 67918 } as any);

      await expect(
        requestQueryService.getRequestById(67918, 49000, 'FINANCE_OFFICER'),
      ).resolves.toMatchObject({ request_id: 67918 });
    });
  });
});
