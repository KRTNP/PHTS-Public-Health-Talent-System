export const registerProcessHandlers = (
  nodeEnv: string,
  shutdown: (signal: string) => Promise<void>,
): void => {
  if (nodeEnv === "test") return;

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("uncaughtException", (error: Error) => {
    console.error("Uncaught Exception:", error);
    void shutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    if (nodeEnv === "production") {
      void shutdown("unhandledRejection");
      return;
    }
    console.warn(
      "[Server] unhandledRejection captured in development; server kept alive.",
    );
  });
};

