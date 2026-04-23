import { createHash, randomUUID } from "node:crypto";

export const NIL = "00000000-0000-0000-0000-000000000000";

const toUuidFromHex = (hex: string): string => {
  const clean = hex.replace(/[^a-f0-9]/gi, "").padEnd(32, "0").slice(0, 32);
  return [
    clean.slice(0, 8),
    clean.slice(8, 12),
    clean.slice(12, 16),
    clean.slice(16, 20),
    clean.slice(20, 32),
  ].join("-");
};

const hashToUuid = (input: string): string => {
  const hash = createHash("sha1").update(input).digest("hex");
  return toUuidFromHex(hash);
};

export const v1 = (): string => randomUUID();
export const v3 = (value: string, namespace: string): string =>
  hashToUuid(`v3:${namespace}:${value}`);
export const v4 = (): string => randomUUID();
export const v5 = (value: string, namespace: string): string =>
  hashToUuid(`v5:${namespace}:${value}`);
export const v6 = (): string => randomUUID();
export const v7 = (): string => randomUUID();
export const max = (): string => "ffffffff-ffff-ffff-ffff-ffffffffffff";

export const parse = (value: string): Uint8Array => {
  const clean = value.replace(/-/g, "").toLowerCase();
  if (clean.length !== 32 || /[^a-f0-9]/.test(clean)) {
    throw new TypeError("Invalid UUID");
  }
  return Uint8Array.from(
    clean.match(/.{2}/g)!.map((byte) => Number.parseInt(byte, 16)),
  );
};

export const stringify = (bytes: Uint8Array): string => {
  if (bytes.length !== 16) {
    throw new TypeError("Invalid UUID byte array length");
  }
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return toUuidFromHex(hex);
};

export const validate = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );

export const version = (value: string): number => {
  if (!validate(value)) {
    throw new TypeError("Invalid UUID");
  }
  return Number.parseInt(value[14], 16);
};

export default {
  NIL,
  max,
  parse,
  stringify,
  v1,
  v3,
  v4,
  v5,
  v6,
  v7,
  validate,
  version,
};
