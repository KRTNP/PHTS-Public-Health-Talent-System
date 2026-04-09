type RedirectToLoginOptions = {
  pathname?: string;
  navigate?: (path: string) => void;
};

let isRedirecting = false;
let lastRedirectAt = 0;
const REDIRECT_COOLDOWN_MS = 500;

const isLoginPath = (pathname: string): boolean =>
  pathname === '/login' || pathname.startsWith('/login');

export const redirectToLogin = (options: RedirectToLoginOptions = {}) => {
  if (typeof window === 'undefined') return;

  const currentPath = options.pathname ?? window.location.pathname;
  if (isLoginPath(currentPath)) return;

  const now = Date.now();
  if (isRedirecting && now - lastRedirectAt < REDIRECT_COOLDOWN_MS) {
    return;
  }
  isRedirecting = true;
  lastRedirectAt = now;

  const releaseGuard = () => {
    window.setTimeout(() => {
      isRedirecting = false;
    }, REDIRECT_COOLDOWN_MS);
  };

  if (options.navigate) {
    options.navigate('/login');
    releaseGuard();
    return;
  }

  window.location.href = '/login';
  releaseGuard();
};
