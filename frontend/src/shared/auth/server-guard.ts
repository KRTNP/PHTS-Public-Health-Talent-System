import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@/types/auth";
import { AUTH_TOKEN_COOKIE_NAME } from "@/shared/auth/storage";
import { hasRequiredRole } from "@/shared/auth/role-authorization";

type AuthMeResponse = {
  success?: boolean;
  data?: {
    role?: string;
  };
};

const normalizeApiBase = (rawBase: string): string => {
  const trimmed = rawBase.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/api")) return trimmed;
  return `${trimmed}/api`;
};

const resolveBackendBase = (): string | null => {
  const configuredTarget = process.env.NEXT_INTERNAL_API_PROXY_TARGET?.trim();
  if (configuredTarget) return configuredTarget;

  const publicApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (publicApiUrl && /^https?:\/\//i.test(publicApiUrl)) {
    return publicApiUrl;
  }

  return null;
};

const getRoleFromBackend = async (token: string): Promise<string | null> => {
  const backendBase = resolveBackendBase();
  if (!backendBase) return null;

  const authMeUrl = `${normalizeApiBase(backendBase)}/auth/me`;

  try {
    const response = await fetch(authMeUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as AuthMeResponse;
    return payload?.data?.role ?? null;
  } catch {
    return null;
  }
};

export async function requireRoleAccess(requiredRole: Role): Promise<void> {
  const token = (await cookies()).get(AUTH_TOKEN_COOKIE_NAME)?.value;
  if (!token) redirect("/login");

  const actualRole = await getRoleFromBackend(token);
  if (!hasRequiredRole(actualRole, requiredRole)) {
    redirect("/login");
  }
}
