import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { getAppTimezone, isTestEnv } from "@config/runtime-config.js";

let loaded = false;

export function loadEnv(): void {
  if (loaded) return;
  const root = process.cwd();
  const testPath = path.join(root, ".env.test");
  const localPath = path.join(root, ".env.local");
  const defaultPath = path.join(root, ".env");
  const useTestEnv = isTestEnv() && fs.existsSync(testPath);
  let envPath = defaultPath;
  if (useTestEnv) {
    envPath = testPath;
  } else if (fs.existsSync(localPath)) {
    envPath = localPath;
  }
  dotenv.config({ path: envPath });

  const appTimezone = getAppTimezone();
  process.env.APP_TIMEZONE = appTimezone;
  if (!process.env.TZ) {
    process.env.TZ = appTimezone;
  }

  loaded = true;
}
