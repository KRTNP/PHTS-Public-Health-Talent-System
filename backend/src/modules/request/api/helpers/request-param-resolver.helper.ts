import { requestRepository } from "@/modules/request/data/repositories/request.repository.js";
import { ValidationError } from "@shared/utils/errors.js";

export const resolveRequestIdFromParam = async (rawId: string): Promise<number> => {
  const normalized = rawId.trim();
  if (!normalized) {
    throw new ValidationError("Invalid Request ID");
  }
  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }
  const request = await requestRepository.findByRequestNo(normalized);
  if (!request) throw new ValidationError("Request not found");
  return request.request_id;
};

export const parseFiniteNumberParam = (
  rawValue: unknown,
  invalidMessage: string,
): number => {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    throw new ValidationError(invalidMessage);
  }
  return value;
};
