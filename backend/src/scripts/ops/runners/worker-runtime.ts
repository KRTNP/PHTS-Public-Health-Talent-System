import { loadEnv } from '@config/env.js';
import { closePool, testConnection } from '@config/database.js';

type WorkerRuntimeOptions = {
  name: string;
  start: () => void;
  stop: () => Promise<void> | void;
};

export const runWorkerRuntime = (options: WorkerRuntimeOptions): void => {
  loadEnv();

  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[${options.name}] stopping... signal=${signal}`);
    try {
      await options.stop();
    } finally {
      await closePool();
      process.exit(0);
    }
  };

  const main = async () => {
    console.log(`[${options.name}] booting...`);
    await testConnection();
    options.start();
    console.log(`[${options.name}] running`);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  main().catch((error) => {
    console.error(`[${options.name}] failed:`, error);
    process.exit(1);
  });
};

