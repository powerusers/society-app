import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { forbidden } from "./lib/errors.js";
import { authRouter } from "./routes/auth.js";
import { setupRouter } from "./routes/setup.js";
import { meRouter } from "./routes/me.js";
import { flatsRouter, registrationsRouter } from "./routes/flats.js";
import { usersRouter } from "./routes/users.js";
import { visitorsRouter } from "./routes/visitors.js";
import { billsRouter } from "./routes/bills.js";
import { ticketsRouter } from "./routes/tickets.js";
import { noticesRouter } from "./routes/notices.js";
import { documentsRouter } from "./routes/documents.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { pool } from "./db/pool.js";

/** Built as a factory so tests can mount the app without binding a port. */
export function createApp() {
  const app = express();

  // Railway terminates TLS upstream, so trust its proxy for req.ip and rate limiting.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(cors({
    origin(origin, cb) {
      // same-origin and server-to-server calls arrive without an Origin header
      if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
      /* Name both sides. A refusal that logs neither the origin nor the
         allow-list turns a one-line misconfiguration into a stack trace the
         browser reports only as a generic network failure. */
      console.warn(
        `[cors] refused ${origin} — CORS_ORIGIN allows: ${config.corsOrigins.join(", ") || "(nothing configured)"}`,
      );
      cb(forbidden(`Origin ${origin} is not allowed to call this API`));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: "256kb" }));

  app.use(rateLimit({
    windowMs: 60_000,
    limit: config.isProd ? 300 : 10_000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: "rate_limited", message: "Slow down a moment and try again." } },
  }));

  app.get("/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ ok: true, env: config.env });
    } catch (err) {
      res.status(503).json({ ok: false, error: "database unreachable" });
    }
  });

  app.use("/api/setup", setupRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/me", meRouter);
  app.use("/api/flats", flatsRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/registrations", registrationsRouter);
  app.use("/api/visitors", visitorsRouter);
  app.use("/api/bills", billsRouter);
  app.use("/api/tickets", ticketsRouter);
  app.use("/api/notices", noticesRouter);
  app.use("/api/documents", documentsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
