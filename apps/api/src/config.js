import "dotenv/config";

const required = (name, fallback) => {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required environment variable ${name}`);
  return v;
};

const isProd = process.env.NODE_ENV === "production";

export const config = {
  env: process.env.NODE_ENV || "development",
  isProd,
  port: Number(process.env.PORT || 4000),
  databaseUrl: required("DATABASE_URL", isProd ? undefined : "postgres://gvs:gvs@127.0.0.1:5432/gvs_dev"),
  // A weak secret in production would make every token forgeable, so refuse to boot without one.
  jwtSecret: required("JWT_SECRET", isProd ? undefined : "dev-only-secret-not-for-production"),
  accessTtl: process.env.ACCESS_TTL || "15m",
  refreshTtlDays: Number(process.env.REFRESH_TTL_DAYS || 30),
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:3000,http://127.0.0.1:3000")
    .split(",").map((s) => s.trim()).filter(Boolean),
  logLevel: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
};

if (isProd && config.jwtSecret.startsWith("dev-only")) {
  throw new Error("JWT_SECRET must be set to a real secret in production");
}
