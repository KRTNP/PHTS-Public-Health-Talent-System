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

loadEnv();

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || "development";
const app = createConfiguredApp(NODE_ENV);

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

if (process.env.NODE_ENV !== "test" && process.env.START_SERVER !== "false") {
  try {
    console.log("[Server] Verifying database connection...");
    await testConnection();
    startBackgroundWorkers();

    app.listen(PORT, () => {
      console.log(
        `[Server] PHTS Backend started on port ${PORT} (${process.env.NODE_ENV})`,
      );
      console.log(`[Server] Database host: ${process.env.DB_HOST || "localhost"}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

export default app;

