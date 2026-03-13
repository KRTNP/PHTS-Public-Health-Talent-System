import { IdentityRolePolicyService } from '@/modules/identity/services/identity-role-policy.service.js';
import { UserRole } from '@/types/auth.js';

describe('IdentityRolePolicyService role taxonomy', () => {
  test('exposes complete system role sets with expected policy groups', () => {
    expect(IdentityRolePolicyService.ALL_SYSTEM_ROLES).toEqual([
      UserRole.USER,
      UserRole.HEAD_SCOPE,
      UserRole.PTS_OFFICER,
      UserRole.HEAD_HR,
      UserRole.HEAD_FINANCE,
      UserRole.FINANCE_OFFICER,
      UserRole.DIRECTOR,
      UserRole.ADMIN,
    ]);
    expect([...IdentityRolePolicyService.HR_MANAGED_ROLES]).toEqual([
      UserRole.HEAD_SCOPE,
    ]);
    expect([...IdentityRolePolicyService.PROTECTED_ROLES]).toEqual([
      UserRole.ADMIN,
      UserRole.PTS_OFFICER,
    ]);
    expect(IdentityRolePolicyService.MANUAL_ASSIGNABLE_ROLES.has(UserRole.DIRECTOR)).toBe(true);
    expect(IdentityRolePolicyService.MANUAL_ASSIGNABLE_ROLES.has(UserRole.HEAD_SCOPE)).toBe(false);
  });
});

describe('IdentityRolePolicyService.deriveRole', () => {
  test('assigns DEPT_SCOPE when special_position indicates dept head', () => {
    const role = IdentityRolePolicyService.deriveRole({
      citizen_id: '1',
      position_name: 'ผู้อำนวยการ',
      special_position: 'หัวหน้ากลุ่มงานการเงิน',
      department: 'กลุ่มงานการเงิน',
    });
    expect(role).toBe('DEPT_SCOPE');
  });

  test('assigns DEPT_SCOPE for finance head (non-assistant)', () => {
    const role = IdentityRolePolicyService.deriveRole({
      citizen_id: '2',
      special_position: 'หัวหน้ากลุ่มงาน-การเงิน',
      department: 'กลุ่มงานการเงิน',
    });
    expect(role).toBe('DEPT_SCOPE');
  });

  test('assigns DEPT_SCOPE for HR head when pattern matches', () => {
    const role = IdentityRolePolicyService.deriveRole({
      citizen_id: '3',
      special_position: 'หัวหน้ากลุ่มงาน-ทรัพยากรบุคคล',
      department: 'กลุ่มงานทรัพยากรบุคคล',
    });
    expect(role).toBe('DEPT_SCOPE');
  });

  test('assistant head does not get head role', () => {
    const role = IdentityRolePolicyService.deriveRole({
      citizen_id: '4',
      special_position: 'ผู้ช่วยหัวหน้าตึก-ศัลยกรรม',
      department: 'กลุ่มงานศัลยกรรม',
    });
    expect(role).toBe('USER');
  });

  test('assigns DEPT_SCOPE when special position indicates head dept', () => {
    const role = IdentityRolePolicyService.deriveRole({
      citizen_id: '5',
      special_position: 'หัวหน้ากลุ่มงาน-อายุรกรรม',
      department: 'กลุ่มงานอายุรกรรม',
    });
    expect(role).toBe('DEPT_SCOPE');
  });

  test('assigns WARD_SCOPE when special position indicates head ward', () => {
    const role = IdentityRolePolicyService.deriveRole({
      citizen_id: '6',
      special_position: 'หัวหน้าตึก-ศัลยกรรม',
      department: 'กลุ่มงานศัลยกรรม',
    });
    expect(role).toBe('WARD_SCOPE');
  });

  test('assigns WARD_SCOPE for ward-prefix string even when scope text contains กลุ่มงาน', () => {
    const role = IdentityRolePolicyService.deriveRole({
      citizen_id: '7',
      special_position: 'หัวหน้าตึก/หัวหน้างาน-กลุ่มงานเภสัชกรรม',
      department: 'กลุ่มงานเภสัชกรรม',
    });
    expect(role).toBe('WARD_SCOPE');
  });

  test('keeps WARD_SCOPE when valid ward head is mixed with assistant dept entry', () => {
    const role = IdentityRolePolicyService.deriveRole({
      citizen_id: '8',
      special_position: 'หัวหน้าตึก/หัวหน้างาน-กลุ่มงานเภสัชกรรม,รองหัวหน้ากลุ่มงาน-กลุ่มงานเภสัชกรรม',
      department: 'กลุ่มงานเภสัชกรรม',
    });
    expect(role).toBe('WARD_SCOPE');
  });

  test('supports semicolon-delimited special_position entries', () => {
    const role = IdentityRolePolicyService.deriveRole({
      citizen_id: '9',
      special_position: 'หัวหน้าตึก/หัวหน้างาน-ICU;รองหัวหน้ากลุ่มงาน-กลุ่มงานอายุรกรรม',
      department: 'กลุ่มงานอายุรกรรม',
    });
    expect(role).toBe('WARD_SCOPE');
  });
});
