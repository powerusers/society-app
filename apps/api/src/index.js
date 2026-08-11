import { createApp } from "./app.js";
import { config } from "./config.js";
import { closePool, pool } from "./db/pool.js";
import { migrate } from "./db/migrate.js";
import { storageConfigured } from "./lib/storage.js";

const app = createApp();

/* Migrations run at boot so a deploy cannot serve traffic against an older
   schema than the code expects. */
await migrate({ silent: config.isProd });

/* The rest of the API works without S3; only the document vault needs it. Warn
   rather than refuse to boot, so a missing bucket does not take the gate down. */
if (!storageConfigured()) {
  console.warn("[api] S3_BUCKET is not set — document upload and download will return 503");
}

/* Print the parsed allow-list, not the raw variable. A CORS failure is
   otherwise indistinguishable from a variable that was set on the wrong
   service, never redeployed, or pasted with quotes around it — and the
   browser reports every one of those as the same opaque network error. */
console.log(
  `[api] CORS allows: ${config.corsOrigins.map((o) => JSON.stringify(o)).join(", ") || "(nothing — every browser request will be refused)"}`,
);

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
