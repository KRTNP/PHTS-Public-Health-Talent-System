/**
 * PHTS System - Main Server Entry Point
 *
 * Keeps startup orchestration in one place while delegating
 * app wiring and worker lifecycle to bootstrap modules.
 */

import { loadEnv } from "@config/env.js";
import { testConnection, closePool } from "@config/database.js";
import { createConfiguredApp } from "@/bootstrap/app.js";
import { registerProcessHandlers } from "@/bootstrap/process-handlers.js";
import { startBackgroundWorkers, stopBackgroundWorkers } from "@/bootstrap/workers.js";
import {
  getDatabaseRuntimeConfig,
  getNodeEnv,
  getRuntimePort,
  getStartServerFlag,
  isJestRuntime,
  isTestEnv,
} from "@config/runtime-config.js";

loadEnv();

const PORT = getRuntimePort();
const HOST = String(process.env.HOST || "127.0.0.1");
const NODE_ENV = getNodeEnv();
const app = createConfiguredApp(NODE_ENV);
const START_SERVER = getStartServerFlag();
const jestRuntime = isJestRuntime();
const shouldStartServer =
  !jestRuntime &&
  (START_SERVER === "true" || (!isTestEnv() && START_SERVER !== "false"));

async function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  try {
    await stopBackgroundWorkers();
    await closePool();
    console.log("Server shut down successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
}

registerProcessHandlers(NODE_ENV, gracefulShutdown);

if (shouldStartServer) {
  try {
    console.log("[Server] Verifying database connection...");
    await testConnection();
    startBackgroundWorkers();

    app.listen(PORT, HOST, () => {
      console.log(
        `[Server] PHTS Backend started on port ${PORT} (${getNodeEnv()})`,
      );
      console.log(
        `[Server] Database host: ${getDatabaseRuntimeConfig().host}`,
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

export default app;
