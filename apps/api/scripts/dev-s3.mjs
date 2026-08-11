/**
 * Local S3-compatible server for development and tests. Not used in production.
 *
 * The CORS rule below mirrors what a real bucket needs: the browser uploads
 * straight to storage, so without it the preflight fails and every upload dies
 * before a byte moves. See apps/api/README.md for the AWS equivalent.
 */
import S3rver from "s3rver";
import { mkdirSync } from "node:fs";

const dir = process.env.S3_DEV_DIR || "/tmp/gvs-s3-dev";
const port = Number(process.env.S3_DEV_PORT || 9100);
const bucket = process.env.S3_BUCKET || "gvs-documents";
const origins = (process.env.S3_DEV_ORIGINS || "*").split(",");

mkdirSync(dir, { recursive: true });

const corsXml = `<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <CORSRule>
    ${origins.map((o) => `<AllowedOrigin>${o}</AllowedOrigin>`).join("\n    ")}
    <AllowedMethod>POST</AllowedMethod>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>3000</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>`;

const server = new S3rver({
  port, address: "127.0.0.1", silent: true, directory: dir,
  configureBuckets: [{ name: bucket, configs: [Buffer.from(corsXml)] }],
});

await server.run();
console.log(`[s3-dev] bucket "${bucket}" on http://127.0.0.1:${port} (CORS: ${origins.join(", ")})`);
