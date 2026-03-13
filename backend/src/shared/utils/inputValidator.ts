/**
 * Input Validation Utility
 *
 * Enforces maximum field lengths to prevent:
 * - DoS attacks (huge payloads)
 * - Database field overflow
 * - Memory issues
 */

export const FIELD_LIMITS = {
  // User Input
  CITIZEN_ID: 13,
  PASSWORD: 128,
  FIRST_NAME: 100,
  LAST_NAME: 100,
  EMAIL: 255,
  PHONE: 20,

  // Request Fields
  REQUEST_NO: 50,
  COMMENT: 2000,
  REJECTION_REASON: 2000,
  MAIN_DUTY: 500,

  // PTS Fields
  RATE_NAME: 255,
  RATE_DESCRIPTION: 1000,

  // Generic
  NAME: 255,
  DESCRIPTION: 5000,
  TITLE: 255,
  ADDRESS: 500,
  URL: 2048,
  ERROR_MESSAGE: 1000,

  // Files
  FILE_NAME: 255,
  FILE_PATH: 512,

  // Notes & Comments
  NOTES: 5000,
  REMARK: 2000,
};

/**
 * Validate string field length
 * @param value Value to validate
 * @param fieldName Field name (for error message)
 * @param maxLength Maximum allowed length
 * @throws Error if value exceeds max length
 */
export function validateLength(
  value: any,
  fieldName: string,
  maxLength: number,
): void {
  if (typeof value === "string" && value.length > maxLength) {
    throw new Error(
      `${fieldName} exceeds maximum length of ${maxLength} characters. Received: ${value.length}`,
    );
  }
}

/**
 * Validate multiple fields
 * @param data Object containing fields to validate
 * @param limits Map of field names to max lengths
 */
export function validateFieldLengths(
  data: Record<string, any>,
  limits: Record<string, number>,
): void {
  const errors: string[] = [];

  for (const [field, maxLength] of Object.entries(limits)) {
    const value = data[field];

    if (typeof value === "string" && value.length > maxLength) {
      errors.push(
        `${field}: exceeds max length of ${maxLength} (received ${value.length})`,
      );
    }
  }

  if (errors.length > 0) {
    const details = errors.map((e) => `  - ${e}`).join("\n");
    throw new Error(
      `Input validation failed:\n${details}`,
    );
  }
}

/**
 * Validate request body fields
 * @param body Request body
 * @param schema Field length schema
 */
export function validateRequestBody(
  body: Record<string, any>,
  schema: Record<string, number>,
): void {
  validateFieldLengths(body, schema);
}

/**
 * Validate citizen ID
 */
export function validateCitizenId(citizenId: string): void {
  validateLength(citizenId, "citizen_id", FIELD_LIMITS.CITIZEN_ID);
  if (!/^\d{13}$/.test(citizenId)) {
    throw new Error("Citizen ID must be exactly 13 digits");
  }
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): void {
  validateLength(password, "password", FIELD_LIMITS.PASSWORD);
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }
}

/**
 * Validate name fields
 */
export function validateName(name: string, fieldName = "name"): void {
  validateLength(name, fieldName, FIELD_LIMITS.NAME);
  if (name.trim().length === 0) {
    throw new Error(`${fieldName} cannot be empty`);
  }
}

/**
 * Validate email
 */
export function validateEmail(email: string): void {
  validateLength(email, "email", FIELD_LIMITS.EMAIL);
  const value = String(email ?? "").trim();
  const atIndex = value.indexOf("@");
  const lastAtIndex = value.lastIndexOf("@");
  const hasSingleAt = atIndex > 0 && atIndex === lastAtIndex;
  const hasNoWhitespace = !value.includes(" ");
  const domain = hasSingleAt ? value.slice(atIndex + 1) : "";
  const local = hasSingleAt ? value.slice(0, atIndex) : "";
  const dotIndex = domain.indexOf(".");
  const hasValidDomainDot = dotIndex > 0 && dotIndex < domain.length - 1;
  if (!hasSingleAt || !hasNoWhitespace || local.length === 0 || !hasValidDomainDot) {
    throw new Error("Invalid email format");
  }
}

/**
 * Validate comment/note fields
 */
export function validateComment(comment: string, fieldName = "comment"): void {
  if (!comment || comment.trim().length === 0) {
    throw new Error(`${fieldName} cannot be empty`);
  }
  validateLength(comment, fieldName, FIELD_LIMITS.COMMENT);
}

/**
 * Sanitize string input (trim and remove control characters)
 */
export function sanitizeString(value: string): string {
  if (typeof value !== "string") {
    return value;
  }

  // Trim whitespace
  let sanitized = value.trim();

  // Remove control characters (keep TAB/LF/CR for readable multi-line text)
  sanitized = Array.from(sanitized)
    .filter((char) => {
      const code = char.charCodeAt(0);
      if (code === 9 || code === 10 || code === 13) return true;
      return code >= 32 && code !== 127;
    })
    .join("");

  return sanitized;
}

/**
 * Validate and sanitize input object
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized: Record<string, unknown> = { ...obj };

  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizeString(value);
    }
  }

  return sanitized as T;
}
