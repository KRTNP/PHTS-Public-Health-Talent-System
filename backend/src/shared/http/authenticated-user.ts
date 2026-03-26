import { Request } from "express";
import { AuthenticationError } from "@shared/utils/errors.js";

type LegacyAuthenticatedUser = Express.User & {
  id?: number;
};

const readUser = (req: Pick<Request, "user">): LegacyAuthenticatedUser | undefined => {
  return req.user as LegacyAuthenticatedUser | undefined;
};

export const getAuthenticatedUserId = (
  req: Pick<Request, "user">,
): number | undefined => {
  const user = readUser(req);
  if (!user) return undefined;
  const id = user.userId ?? user.id;
  return typeof id === "number" ? id : undefined;
};

export const getAuthenticatedUserRole = (
  req: Pick<Request, "user">,
): string | undefined => {
  const user = readUser(req);
  if (!user) return undefined;
  return typeof user.role === "string" ? user.role : undefined;
};

export const requireAuthenticatedUserId = (
  req: Pick<Request, "user">,
): number => {
  const userId = getAuthenticatedUserId(req);
  if (typeof userId !== "number") {
    throw new AuthenticationError("Unauthorized access");
  }
  return userId;
};
