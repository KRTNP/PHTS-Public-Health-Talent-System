import { getJwtSecret as getJwtSecretFromRuntime } from "@config/runtime-config.js";

export function getJwtSecret(): string {
  return getJwtSecretFromRuntime();
}
