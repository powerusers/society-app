import { createApp } from "./app.js";
import { config } from "./config.js";
import { closePool, pool } from "./db/pool.js";
import { migrate } from "./db/migrate.js";

const app = createApp();

/* Migrations run at boot so a deploy cannot serve traffic against an older
   schema than the code expects. */
await migrate({ silent: config.isProd });

const server = app.listen(config.port, () => {
  console.log(`[api] listening on :${config.port} (${config.env})`);
});

const shutdown = async (signal) => {
  console.log(`[api] ${signal} received, draining`);
  server.close(async () => {
    await closePool().catch(() => {});
    process.exit(0);
  });
  // Do not hang a deploy forever on a stuck connection.
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (err) => {
  console.error("[api] unhandled rejection", err);
});
