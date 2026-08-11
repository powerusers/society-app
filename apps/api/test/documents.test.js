import "./setup.js";
import test, { before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import S3rver from "s3rver";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { MAX_DOCUMENT_BYTES } from "@gvs/shared";
import { query } from "../src/db/pool.js";
import { resetStorageClient, headObject } from "../src/lib/storage.js";
import { startTestServer, stopTestServer, get, post, del, login, ACCOUNTS } from "./helpers.js";

/*
 * s3rver implements enough of the S3 API to exercise the real presigned upload
 * and download path, but not all of it. Two behaviours below are AWS's and
 * cannot be observed here:
 *
 *   - POST policy conditions (content-length-range, eq $Content-Type). s3rver
 *     accepts a body that violates them; real S3 rejects it. The tests instead
 *     assert that we sign the correct policy, which is the part we own.
 *   - response-content-disposition / response-content-type overrides on a
 *     presigned GET. s3rver ignores them, so the tests assert the signed URL
 *     carries them rather than checking the response header.
 *
 * Both are called out by name in the test titles so nobody reads this suite as
 * proof that S3 enforcement was verified end to end.
 */

/* A local S3-compatible server, so these tests exercise the real presigned
   upload and download path rather than a stubbed client. */
let s3, s3dir;
let secretary, resident, manager, guard;

before(async () => {
  s3dir = mkdtempSync(join(tmpdir(), "gvs-s3-"));
  s3 = new S3rver({
    port: 0, address: "127.0.0.1", silent: true, directory: s3dir,
    configureBuckets: [{ name: "gvs-docs-test", configs: [] }],
  });
  const { port } = await s3.run();

  process.env.S3_BUCKET = "gvs-docs-test";
  process.env.S3_ENDPOINT = `http://127.0.0.1:${port}`;
  process.env.S3_REGION = "us-east-1";
  process.env.S3_FORCE_PATH_STYLE = "true";
  process.env.AWS_ACCESS_KEY_ID = "S3RVER";
  process.env.AWS_SECRET_ACCESS_KEY = "S3RVER";
  resetStorageClient();

  await startTestServer();
  [secretary, resident, manager, guard] = await Promise.all([
    login(ACCOUNTS.secretary), login(ACCOUNTS.resident), login(ACCOUNTS.manager), login(ACCOUNTS.guard),
  ]);
});

after(async () => {
  await stopTestServer();
  await s3.close();
  rmSync(s3dir, { recursive: true, force: true });
});

/** Performs the browser half of the flow: multipart POST straight to S3. */
async function uploadTo({ url, fields }, body, contentType, fileName = "file.pdf") {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append("file", new Blob([body], { type: contentType }), fileName);
  return fetch(url, { method: "POST", body: form });
}

/** Reads an object's bytes with the SDK, bypassing the presign-URL path. */
async function readObject(key) {
  const client = new S3Client({
    region: "us-east-1", endpoint: process.env.S3_ENDPOINT, forcePathStyle: true,
    credentials: { accessKeyId: "S3RVER", secretAccessKey: "S3RVER" },
  });
  const r = await client.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
  return Buffer.from(await r.Body.transformToByteArray());
}

const keyOf = async (id) =>
  (await query("SELECT storage_key FROM documents WHERE id = $1", [id])).rows[0].storage_key;

/** The signed POST policy, decoded back into the conditions we asked S3 to enforce. */
const decodePolicy = (fields) => JSON.parse(Buffer.from(fields.Policy, "base64").toString("utf8"));

const PDF = Buffer.from("%PDF-1.4\nAGM minutes\n%%EOF");

async function uploadDocument(token, overrides = {}, body = PDF) {
  const requested = await post("/api/documents/upload-url", {
    name: "AGM Minutes — Jul 2026.pdf",
    fileName: "agm-minutes.pdf",
    category: "Meeting minutes",
    contentType: "application/pdf",
    sizeBytes: body.length,
    ...overrides,
  }, token);
  if (requested.status !== 201) return { requested };

  const put = await uploadTo(requested.body.upload, body, overrides.contentType || "application/pdf");
  const completed = await post(`/api/documents/${requested.body.document.id}/complete`, {}, token);
  return { requested, put, completed, id: requested.body.document.id };
}

describe("document upload", () => {
  test("the full lifecycle: presign, upload to S3, confirm, list, download", async () => {
    const { requested, put, completed, id } = await uploadDocument(secretary.accessToken);

    assert.equal(requested.status, 201);
    assert.equal(requested.body.document.status, "pending", "not a document until the bytes arrive");
    assert.ok(requested.body.upload.url);
    assert.ok(requested.body.upload.fields.key, "presigned POST fields are returned for the browser form");

    assert.equal(put.status, 204, "S3 accepted the body");

    assert.equal(completed.status, 200);
    assert.equal(completed.body.document.status, "ready");
    assert.equal(completed.body.document.sizeBytes, PDF.length, "size is read back from storage, not trusted");

    const listed = await get("/api/documents", resident.accessToken);
    assert.ok(listed.body.documents.some((d) => d.id === id));

    const link = await get(`/api/documents/${id}/download`, resident.accessToken);
    assert.equal(link.status, 200);
    assert.ok(link.body.url.includes("X-Amz-Signature"), "a presigned URL, not a public one");
    assert.ok(link.body.expiresIn <= 300);

    assert.equal((await readObject(await keyOf(id))).toString(), PDF.toString(),
      "the bytes in the bucket are the bytes that were uploaded");
  });

  test("the download URL is signed to force an attachment and expire quickly", async () => {
    // s3rver ignores response-header overrides, so this asserts the signed URL,
    // not the response. Honouring the override is AWS behaviour.
    const { id } = await uploadDocument(secretary.accessToken, { fileName: "notice.pdf" });
    const link = await get(`/api/documents/${id}/download`, resident.accessToken);

    const url = new URL(link.body.url);
    assert.match(url.searchParams.get("response-content-disposition") || "", /^attachment/,
      "nothing from the bucket should ever render inline in a resident's browser");
    assert.equal(url.searchParams.get("response-content-type"), "application/pdf");
    assert.ok(Number(url.searchParams.get("X-Amz-Expires")) <= 300, "links must be short-lived");
  });

  test("bytes never pass through the API — the upload goes straight to the bucket", async () => {
    const { requested } = await uploadDocument(secretary.accessToken, { fileName: "direct.pdf" });
    assert.ok(
      requested.body.upload.url.startsWith(process.env.S3_ENDPOINT),
      "the browser is pointed at S3, not back at this server",
    );
  });

  test("the object key is derived from the society and document id, not the client", async () => {
    const { id } = await uploadDocument(secretary.accessToken, { fileName: "../../escape.pdf" });
    const { rows } = await query("SELECT storage_key, society_id FROM documents WHERE id = $1", [id]);
    assert.equal(rows[0].storage_key, `societies/${rows[0].society_id}/documents/${id}/escape.pdf`);
    assert.ok(!rows[0].storage_key.includes(".."), "path traversal is stripped");
  });

  test("a document is not listed until the upload is confirmed", async () => {
    const requested = await post("/api/documents/upload-url", {
      name: "Half-finished upload", fileName: "half.pdf", category: "Circulars",
      contentType: "application/pdf", sizeBytes: 100,
    }, secretary.accessToken);

    const listed = await get("/api/documents", secretary.accessToken);
    assert.ok(!listed.body.documents.some((d) => d.id === requested.body.document.id));
  });

  test("completing an upload that never arrived is refused", async () => {
    const requested = await post("/api/documents/upload-url", {
      name: "Never uploaded", fileName: "ghost.pdf", category: "Circulars",
      contentType: "application/pdf", sizeBytes: 100,
    }, secretary.accessToken);

    const completed = await post(`/api/documents/${requested.body.document.id}/complete`, {}, secretary.accessToken);
    assert.equal(completed.status, 400);
    assert.match(completed.body.error.message, /has not reached storage/);
  });

  test("completing twice is refused", async () => {
    const { id } = await uploadDocument(secretary.accessToken, { fileName: "once.pdf" });
    const again = await post(`/api/documents/${id}/complete`, {}, secretary.accessToken);
    assert.equal(again.status, 409);
  });
});

describe("upload restrictions", () => {
  test("a disallowed content type is refused before any presigning", async () => {
    const { requested } = await uploadDocument(secretary.accessToken, {
      fileName: "payload.html", contentType: "text/html",
    });
    assert.equal(requested.status, 422);
    assert.match(requested.body.error.details.contentType, /not accepted/);
  });

  test("SVG is refused too — it executes script when rendered", async () => {
    const { requested } = await uploadDocument(secretary.accessToken, {
      fileName: "logo.svg", contentType: "image/svg+xml",
    });
    assert.equal(requested.status, 422);
  });

  test("a file over the limit is refused before a byte is uploaded", async () => {
    const { requested } = await uploadDocument(secretary.accessToken, {
      fileName: "huge.pdf", sizeBytes: MAX_DOCUMENT_BYTES + 1,
    });
    assert.equal(requested.status, 422);
    assert.match(requested.body.error.details.sizeBytes, /25 MB/);
  });

  /* A client can simply lie about sizeBytes, so the real limit has to live in
     the signed policy that S3 enforces. s3rver does not enforce POST policy
     conditions, so these assert that the policy we sign is correct — the
     enforcement itself is AWS's, and is not exercised locally. */
  test("the signed upload policy caps the body size at the bucket", async () => {
    const requested = await post("/api/documents/upload-url", {
      name: "Understated file", fileName: "small.pdf", category: "Circulars",
      contentType: "application/pdf", sizeBytes: 10,
    }, secretary.accessToken);

    const policy = decodePolicy(requested.body.upload.fields);
    const range = policy.conditions.find((c) => Array.isArray(c) && c[0] === "content-length-range");
    assert.ok(range, "the policy must carry a content-length-range condition");
    assert.equal(range[1], 1, "an empty body is not a document");
    assert.equal(range[2], MAX_DOCUMENT_BYTES);
    assert.equal(requested.body.upload.maxBytes, MAX_DOCUMENT_BYTES);
  });

  test("the signed upload policy pins the content type", async () => {
    const requested = await post("/api/documents/upload-url", {
      name: "Mislabelled", fileName: "claimed.pdf", category: "Circulars",
      contentType: "application/pdf", sizeBytes: 20,
    }, secretary.accessToken);

    const policy = decodePolicy(requested.body.upload.fields);
    const pinned = policy.conditions.find(
      (c) => Array.isArray(c) && c[0] === "eq" && c[1] === "$Content-Type",
    );
    assert.ok(pinned, "the policy must pin Content-Type so a claimed PDF cannot arrive as HTML");
    assert.equal(pinned[2], "application/pdf");
    assert.equal(requested.body.upload.fields["Content-Type"], "application/pdf");
  });

  test("the signed upload policy expires", async () => {
    const requested = await post("/api/documents/upload-url", {
      name: "Expiring", fileName: "expiring.pdf", category: "Circulars",
      contentType: "application/pdf", sizeBytes: 20,
    }, secretary.accessToken);

    const policy = decodePolicy(requested.body.upload.fields);
    const expiry = new Date(policy.expiration).getTime() - Date.now();
    assert.ok(expiry > 0 && expiry <= 305_000, `upload window should be minutes, got ${expiry}ms`);
    assert.ok(requested.body.upload.expiresIn <= 300);
  });

  test("an oversized body is refused up front, before any presign is issued", async () => {
    const { requested } = await uploadDocument(secretary.accessToken, {
      fileName: "huge.pdf", sizeBytes: MAX_DOCUMENT_BYTES + 1,
    });
    assert.equal(requested.status, 422);
    assert.equal(requested.body.upload, undefined, "no upload credentials are handed out at all");
  });

  test("an unknown category is refused", async () => {
    const { requested } = await uploadDocument(secretary.accessToken, { category: "Blackmail" });
    assert.equal(requested.status, 422);
  });
});

describe("document authorization", () => {
  test("a resident cannot upload", async () => {
    const { requested } = await uploadDocument(resident.accessToken);
    assert.equal(requested.status, 403);
  });

  test("a guard cannot upload", async () => {
    const { requested } = await uploadDocument(guard.accessToken);
    assert.equal(requested.status, 403);
  });

  test("committee-only documents are invisible to residents", async () => {
    const { id } = await uploadDocument(secretary.accessToken, {
      name: "Legal notice — dispute file", fileName: "dispute.pdf", category: "Legal", visibility: "committee",
    });

    const asCommittee = await get("/api/documents", secretary.accessToken);
    assert.ok(asCommittee.body.documents.some((d) => d.id === id));

    const asResident = await get("/api/documents", resident.accessToken);
    assert.ok(!asResident.body.documents.some((d) => d.id === id), "not merely hidden in the UI — absent from the response");
  });

  test("a resident cannot download a committee-only document by guessing its id", async () => {
    const { id } = await uploadDocument(secretary.accessToken, {
      name: "Board papers", fileName: "board.pdf", category: "Legal", visibility: "committee",
    });
    const link = await get(`/api/documents/${id}/download`, resident.accessToken);
    assert.equal(link.status, 404, "and 404, not 403 — a resident learns nothing about what exists");
  });

  test("a resident cannot delete a document", async () => {
    const { id } = await uploadDocument(secretary.accessToken, { fileName: "keepme.pdf" });
    assert.equal((await del(`/api/documents/${id}`, resident.accessToken)).status, 403);
  });

  test("an unauthenticated caller gets nothing", async () => {
    assert.equal((await get("/api/documents")).status, 401);
  });
});

describe("document deletion and cleanup", () => {
  test("deleting removes the row and the object from the bucket", async () => {
    const { id } = await uploadDocument(secretary.accessToken, { fileName: "temporary.pdf" });
    const { rows } = await query("SELECT storage_key FROM documents WHERE id = $1", [id]);
    const key = rows[0].storage_key;

    assert.equal((await headObject(key)).exists, true);

    const removed = await del(`/api/documents/${id}`, secretary.accessToken);
    assert.equal(removed.status, 204);

    assert.equal((await headObject(key)).exists, false, "the object is gone, not just the row");
    const after = await query("SELECT id FROM documents WHERE id = $1", [id]);
    assert.equal(after.rows.length, 0);
  });

  test("a download link stops working once the document is deleted", async () => {
    const { id } = await uploadDocument(secretary.accessToken, { fileName: "vanishing.pdf" });
    await del(`/api/documents/${id}`, secretary.accessToken);
    assert.equal((await get(`/api/documents/${id}/download`, secretary.accessToken)).status, 404);
  });

  test("the sweep clears abandoned uploads and leaves finished ones alone", async () => {
    const { id: finished } = await uploadDocument(secretary.accessToken, { fileName: "finished.pdf" });

    const abandoned = await post("/api/documents/upload-url", {
      name: "Abandoned", fileName: "abandoned.pdf", category: "Circulars",
      contentType: "application/pdf", sizeBytes: 50,
    }, secretary.accessToken);
    await query("UPDATE documents SET created_at = now() - interval '3 days' WHERE id = $1",
      [abandoned.body.document.id]);

    const swept = await post("/api/documents/sweep", { olderThanHours: 24 }, secretary.accessToken);
    assert.equal(swept.status, 200);
    assert.ok(swept.body.removed >= 1);

    const gone = await query("SELECT id FROM documents WHERE id = $1", [abandoned.body.document.id]);
    assert.equal(gone.rows.length, 0);

    const kept = await query("SELECT id FROM documents WHERE id = $1", [finished]);
    assert.equal(kept.rows.length, 1);
  });

  test("only an admin can run the sweep", async () => {
    assert.equal((await post("/api/documents/sweep", {}, manager.accessToken)).status, 403);
  });
});

describe("document audit trail", () => {
  test("uploads, downloads and deletions are all recorded", async () => {
    const { id } = await uploadDocument(secretary.accessToken, { name: "Audited file", fileName: "audited.pdf" });
    await get(`/api/documents/${id}/download`, resident.accessToken);
    await del(`/api/documents/${id}`, secretary.accessToken);

    const { body } = await get("/api/me/audit", secretary.accessToken);
    const forThis = body.audit.filter((a) => a.entityId === id);
    const actions = forThis.map((a) => a.action);

    assert.ok(actions.includes("document.upload"));
    assert.ok(actions.includes("document.download"));
    assert.ok(actions.includes("document.delete"));

    const download = forThis.find((a) => a.action === "document.download");
    assert.equal(download.actorName, "Rahul Mehta", "the trail names who took a copy");
  });
});

describe("when storage is not configured", () => {
  test("the API says so plainly instead of failing obscurely", async () => {
    const saved = process.env.S3_BUCKET;
    delete process.env.S3_BUCKET;
    try {
      const { requested } = await uploadDocument(secretary.accessToken);
      assert.equal(requested.status, 503);
      assert.equal(requested.body.error.code, "storage_unconfigured");
    } finally {
      process.env.S3_BUCKET = saved;
    }
  });
});
