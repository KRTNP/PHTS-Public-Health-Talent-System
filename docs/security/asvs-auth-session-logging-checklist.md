# OWASP ASVS Checklist (Auth / Session / Logging)

Last updated: 2026-04-10
Scope: `backend` + `frontend` authentication/session/logging hardening

## V2 Authentication

| Control | Status | Evidence |
|---|---|---|
| Login does not expose bearer token in response body | Done | `backend/src/modules/auth/api/auth.controller.ts` |
| Authentication failures return generic message (no credential enumeration) | Done | `backend/src/modules/auth/services/auth.service.ts` |
| Login/logout are rate-limited | Done | `backend/src/modules/auth/api/auth.route.ts`, `backend/src/middlewares/rateLimiter.ts` |

## V3 Session Management

| Control | Status | Evidence |
|---|---|---|
| Session token set as `HttpOnly` cookie | Done | `backend/src/modules/auth/api/auth.controller.ts` |
| `SameSite=Lax` enforced for auth cookie | Done | `backend/src/modules/auth/api/auth.controller.ts` |
| `Secure` flag enabled in production | Done | `backend/src/modules/auth/api/auth.controller.ts` |
| Logout clears auth cookie even when token is missing/expired | Done | `backend/src/modules/auth/api/auth.route.ts`, `backend/src/modules/auth/__tests__/auth.cookie-flags.http.test.ts` |
| Frontend no longer stores auth token in `localStorage` | Done | `frontend/src/shared/auth/session.ts`, `frontend/src/shared/api/axios.ts` |
| Cookie-authenticated unsafe methods enforce same-site origin check (CSRF mitigation) | Done | `backend/src/middlewares/csrfProtection.ts`, `backend/src/bootstrap/app.ts`, `backend/src/middlewares/__tests__/csrfProtection.test.ts` |

## V5 Validation / Sanitization

| Control | Status | Evidence |
|---|---|---|
| Sensitive login query payload (`password`, `token`, `citizenId`) stripped before rendering login route | Done | `frontend/src/proxy.ts`, `frontend/src/proxy.test.ts` |
| Request validation enforced on auth login input schema | Done | `backend/src/modules/auth/api/auth.route.ts`, `backend/src/modules/auth/auth.schema.ts` |

## V9 API / Transport

| Control | Status | Evidence |
|---|---|---|
| Browser API requests use same-origin transport and credentials mode | Done | `frontend/src/shared/api/axios.ts`, `frontend/src/shared/api/base-url.ts` |
| CSP and secure headers applied on frontend responses | Done | `frontend/next.config.ts` |
| Backend CORS allow-list enforced | Done | `backend/src/bootstrap/app.ts` |
| Rate-limit client key defaults to `req.ip` (forwarded headers opt-in only) | Done | `backend/src/middlewares/rateLimiter.ts`, `backend/src/middlewares/__tests__/rateLimiter.test.ts` |

## V10 Logging

| Control | Status | Evidence |
|---|---|---|
| Request URL logging sanitizes sensitive query keys | Done | `backend/src/shared/utils/log-sanitizer.ts`, `backend/src/bootstrap/app.ts` |
| Error logs sanitize request path before output | Done | `backend/src/middlewares/errorHandler.ts` |
| Middleware logger sanitizes URL before structured log emit | Done | `backend/src/middlewares/loggingMiddleware.ts` |
| PII masking applied for sync warning path (`citizen_id`) | Done | `backend/src/modules/sync/services/domain/sync-scope.service.ts` |

## Dependency Security

| Control | Status | Evidence |
|---|---|---|
| Production dependency audit (`backend`) = 0 vulns | Done | `npm audit --omit=dev --json` (run 2026-04-10) |
| Production dependency audit (`frontend`) = 0 vulns | Done | `npm audit --omit=dev --json` (run 2026-04-10) |
| Critical `axios` advisory fixed by upgrade to safe range | Done | `frontend/package.json`, `frontend/package-lock.json` |

## Remaining Monitoring Items (No open critical in current scope)

1. Keep running `npm audit --omit=dev` in CI to catch newly published advisories.
2. Add scheduled DAST against deployed preview/staging for route-level abuse cases.
3. Expand redaction dictionary if new sensitive query keys are introduced by future features.
