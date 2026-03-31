import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loadRedirectPolicy = async () => import('@/shared/auth/redirect-policy');

describe('redirectToLogin', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    window.history.pushState({}, '', '/head-hr');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not redirect when current path is already login', async () => {
    const { redirectToLogin } = await loadRedirectPolicy();
    const navigate = vi.fn();

    redirectToLogin({ pathname: '/login', navigate });

    expect(navigate).not.toHaveBeenCalled();
  });

  it('uses navigate callback when provided', async () => {
    const { redirectToLogin } = await loadRedirectPolicy();
    const navigate = vi.fn();

    redirectToLogin({ pathname: '/head-finance', navigate });

    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('applies duplicate-trigger guard and releases after cooldown', async () => {
    const { redirectToLogin } = await loadRedirectPolicy();
    const navigate = vi.fn();

    redirectToLogin({ pathname: '/head-finance', navigate });
    redirectToLogin({ pathname: '/head-finance', navigate });
    expect(navigate).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(500);
    redirectToLogin({ pathname: '/head-finance', navigate });
    expect(navigate).toHaveBeenCalledTimes(2);
  });
});
