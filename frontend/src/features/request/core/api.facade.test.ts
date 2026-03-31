import { describe, expect, it } from 'vitest';
import * as facade from '@/features/request/core/api';
import * as splitIndex from '@/features/request/core/api/index';

describe('request api facade export compatibility', () => {
  it('keeps facade exports aligned with split api index', () => {
    const facadeKeys = Object.keys(facade).sort();
    const splitKeys = Object.keys(splitIndex).sort();

    expect(facadeKeys).toEqual(splitKeys);
  });

  it('exposes core action and query APIs through facade path', () => {
    expect(facade).toHaveProperty('getPendingApprovals');
    expect(facade).toHaveProperty('processAction');
    expect(facade).toHaveProperty('getMyRequests');
  });
});
