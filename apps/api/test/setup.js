/**
 * Imported first by every test file so the config module reads test values.
 * ESM evaluates imports depth-first in source order, so putting this at the top
 * of a test file guarantees it runs before ../src/config.js is touched.
 */
process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgres://gvs:gvs@127.0.0.1:5432/gvs_test";
process.env.JWT_SECRET ||= "test-secret";
process.env.ACCESS_TTL ||= "15m";
process.env.SETUP_TOKEN ||= "test-setup-token";

if (!/gvs_test|_test\b/.test(process.env.DATABASE_URL)) {
  throw new Error(
    `Refusing to run tests against ${process.env.DATABASE_URL} — the test suite truncates every table. ` +
    "Point DATABASE_URL at a database whose name ends in _test.",
  );
}
