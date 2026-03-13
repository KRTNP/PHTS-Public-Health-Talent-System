import { resolveApproverRole } from '@/modules/request/scope/domain/scope.utils.js';

describe('resolveApproverRole', () => {
  test('returns WARD_SCOPE when ward scope is dept-like and request has sub_department', () => {
    const role = resolveApproverRole(
      ['กลุ่มงานเภสัชกรรม'],
      [],
      'กลุ่มงานเภสัชกรรม',
      'ห้องจ่ายยาผู้ป่วยนอก',
    );

    expect(role).toBe('WARD_SCOPE');
  });

  test('keeps DEPT_SCOPE precedence when both ward(dept-like) and dept scopes match', () => {
    const role = resolveApproverRole(
      ['กลุ่มงานเภสัชกรรม'],
      ['กลุ่มงานเภสัชกรรม'],
      'กลุ่มงานเภสัชกรรม',
      'งานบริบาลเภสัชกรรม',
    );

    expect(role).toBe('DEPT_SCOPE');
  });
});
