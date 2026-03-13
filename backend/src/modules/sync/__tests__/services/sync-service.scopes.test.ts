import {
  DB_HEAD_SCOPE_ROLE_DEPT,
  DB_HEAD_SCOPE_ROLE_WARD,
} from '@/shared/utils/head-scope-category.js';

const loadModule = async () => import('../../services/domain/sync-scope.service.js');

describe('buildScopesFromSpecialPosition', () => {
  test('parses head mission scopes as dept scopes', async () => {
    const mod = await loadModule();
    const build = (mod as any).buildScopesFromSpecialPosition ?? null;

    const result = build?.(
      'ตำแหน่งด้านบริหาร-รองผู้อำนวยการฝ่ายการแพทย์,หัวหน้ากลุ่มภารกิจ-ภารกิจด้านบริการปฐมภูมิ,หัวหน้ากลุ่มภารกิจ-ภารกิจด้านทุติยภูมิและตติยภูมิ',
    );

    expect(result).toEqual({
      wardScopes: [],
      deptScopes: [
        'ภารกิจด้านบริการปฐมภูมิ',
        'ภารกิจด้านทุติยภูมิและตติยภูมิ',
      ],
    });
  });

  test('keeps valid head mission scope and ignores non-scope entries', async () => {
    const mod = await loadModule();
    const build = (mod as any).buildScopesFromSpecialPosition ?? null;

    const result = build?.(
      'ตำแหน่งด้านบริหาร-หัวหน้าพยาบาล,หัวหน้ากลุ่มภารกิจ-รองผู้อำนวยการฝ่ายการพยาบาล,หัวหน้ากลุ่มภารกิจ-หัวหน้าพยาบาล,หัวหน้ากลุ่มภารกิจ-ภารกิจด้านการพยาบาล',
    );

    expect(result).toEqual({
      wardScopes: [],
      deptScopes: ['ภารกิจด้านการพยาบาล'],
    });
  });

  test('keeps only exact ward/dept head prefixes', async () => {
    const mod = await loadModule();
    const build = (mod as any).buildScopesFromSpecialPosition ?? null;

    const result = build?.(
      'ผู้ช่วยหัวหน้าตึก-ICU,หัวหน้าตึก/หัวหน้างาน-ICU Neuro.,หัวหน้ากลุ่มงาน-กลุ่มงานการพยาบาลผู้ป่วยหนัก,รองหัวหน้ากลุ่มงาน-กลุ่มงานอายุรกรรม',
    );

    expect(result).toEqual({
      wardScopes: ['ICU Neuro.'],
      deptScopes: ['กลุ่มงานการพยาบาลผู้ป่วยหนัก'],
    });
  });

  test('does not auto-convert ward prefix to dept scope when scope name contains กลุ่มงาน', async () => {
    const mod = await loadModule();
    const build = (mod as any).buildScopesFromSpecialPosition ?? null;

    const result = build?.('หัวหน้าตึก/หัวหน้างาน-กลุ่มงานเภสัชกรรม');

    expect(result).toEqual({
      wardScopes: ['กลุ่มงานเภสัชกรรม'],
      deptScopes: [],
    });
  });

  test('parses head prefixes with optional separator/spacing and normalizes dept label', async () => {
    const mod = await loadModule();
    const build = (mod as any).buildScopesFromSpecialPosition ?? null;

    const result = build?.('หัวหน้ากลุ่มงานการเงิน; หัวหน้าตึก/หัวหน้างาน - ICU Neuro.');

    expect(result).toEqual({
      wardScopes: ['ICU Neuro.'],
      deptScopes: ['กลุ่มงานการเงิน'],
    });
  });

  test('returns empty scopes for empty input', async () => {
    const mod = await loadModule();
    const build = (mod as any).buildScopesFromSpecialPosition ?? null;

    const result = build?.('');

    expect(result).toEqual({ wardScopes: [], deptScopes: [] });
  });

  test('does not create scopes when profile special_position is empty', async () => {
    const mod = await loadModule();
    const syncSpecialPositionScopes = (
      mod as {
        syncSpecialPositionScopes: (conn: unknown, deps: Record<string, unknown>) => Promise<void>;
      }
    ).syncSpecialPositionScopes;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const conn = {
      query: jest.fn().mockResolvedValue([
        [
          {
            user_id: 43815,
            citizen_id: '3102200342989',
            special_position: null,
            original_status: null,
            support_active: 1,
          },
        ],
      ]),
    } as any;
    const deps = {
      citizenIdJoinBinary: jest.fn().mockReturnValue('u.citizen_id = e.citizen_id'),
      isActiveOriginalStatus: jest.fn().mockReturnValue(false),
      parseScopes: jest.fn().mockReturnValue({
        wardScopes: [],
        deptScopes: [],
      }),
      disableScopeMappings: jest.fn().mockResolvedValue(undefined),
      disableScopeMappingsByCitizenId: jest.fn().mockResolvedValue(undefined),
      insertScopeMappings: jest.fn().mockResolvedValue(undefined),
      clearScopeCache: jest.fn(),
    };

    await syncSpecialPositionScopes(conn, deps);

    expect(deps.parseScopes).toHaveBeenCalledWith(null);
    expect(deps.insertScopeMappings).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('special_position parse failed: citizen_id=3102200342989'),
    );
    warnSpy.mockRestore();
  });

  test('creates scope mappings even when current user role is USER', async () => {
    const mod = await loadModule();
    const syncSpecialPositionScopes = (
      mod as {
        syncSpecialPositionScopes: (conn: unknown, deps: Record<string, unknown>) => Promise<void>;
      }
    ).syncSpecialPositionScopes;

    const conn = {
      query: jest.fn().mockResolvedValue([
        [
          {
            user_id: 43815,
            citizen_id: '3102200342989',
            special_position: 'หัวหน้ากลุ่มงาน-กลุ่มงานเภสัชกรรม,หัวหน้าตึก-ICU',
            original_status: 'ปกติ',
            support_active: 0,
          },
        ],
      ]),
    } as any;
    const deps = {
      citizenIdJoinBinary: jest.fn().mockReturnValue('u.citizen_id = e.citizen_id'),
      isActiveOriginalStatus: jest.fn().mockReturnValue(true),
      parseScopes: jest.fn().mockReturnValue({
        wardScopes: ['ICU'],
        deptScopes: ['กลุ่มงานเภสัชกรรม'],
      }),
      disableScopeMappings: jest.fn().mockResolvedValue(undefined),
      disableScopeMappingsByCitizenId: jest.fn().mockResolvedValue(undefined),
      insertScopeMappings: jest.fn().mockResolvedValue(undefined),
      clearScopeCache: jest.fn(),
    };

    await syncSpecialPositionScopes(conn, deps);

    expect(deps.disableScopeMappings).toHaveBeenCalledWith(43815, DB_HEAD_SCOPE_ROLE_WARD, conn);
    expect(deps.disableScopeMappings).toHaveBeenCalledWith(43815, DB_HEAD_SCOPE_ROLE_DEPT, conn);
    expect(deps.insertScopeMappings).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          citizen_id: '3102200342989',
          role: DB_HEAD_SCOPE_ROLE_WARD,
          scope_type: 'UNIT',
          scope_name: 'ICU',
        }),
        expect.objectContaining({
          citizen_id: '3102200342989',
          role: DB_HEAD_SCOPE_ROLE_DEPT,
          scope_type: 'DEPT',
          scope_name: 'กลุ่มงานเภสัชกรรม',
        }),
      ]),
      conn,
    );
  });
});
