import { resolveMemberRoleForScope } from '@/modules/request/scope/application/scope.service.js';

describe('resolveMemberRoleForScope', () => {
  const deptScope = { value: 'กลุ่มงานเภสัชกรรม', label: 'กลุ่มงานเภสัชกรรม', type: 'DEPT' as const };

  test('returns WARD_SCOPE in DEPT page when member has ward mapping on same scope value', () => {
    const role = resolveMemberRoleForScope(
      deptScope,
      'กลุ่มงานเภสัชกรรม',
      'ห้องจ่ายยาผู้ป่วยนอก',
      [{ role: 'WARD_SCOPE', scope_type: 'UNIT', scope_name: 'กลุ่มงานเภสัชกรรม' }],
    );

    expect(role).toBe('WARD_SCOPE');
  });

  test('keeps DEPT_SCOPE priority when both dept and ward map to same scope', () => {
    const role = resolveMemberRoleForScope(
      deptScope,
      'กลุ่มงานเภสัชกรรม',
      'ห้องจ่ายยาผู้ป่วยนอก',
      [
        { role: 'DEPT_SCOPE', scope_type: 'DEPT', scope_name: 'กลุ่มงานเภสัชกรรม' },
        { role: 'WARD_SCOPE', scope_type: 'UNIT', scope_name: 'กลุ่มงานเภสัชกรรม' },
      ],
    );

    expect(role).toBe('DEPT_SCOPE');
  });
});
