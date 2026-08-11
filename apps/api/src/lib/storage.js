import {
  S3Client, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { MAX_DOCUMENT_BYTES } from "@gvs/shared";

/**
 * S3 object storage for the document vault.
 *
 * Bytes never pass through this server. The browser uploads straight to S3 with
 * a presigned POST and downloads with a short-lived presigned GET, so a 20 MB
 * AGM recording does not occupy a Node process or a Railway egress path.
 *
 * Settings are read at call time rather than import time: it keeps an AWS client
 * out of processes that never touch documents, and lets tests point at a local
 * S3-compatible server.
 */

function settings() {
  const endpoint = process.env.S3_ENDPOINT || undefined;
  return {
    bucket: process.env.S3_BUCKET || "",
    region: process.env.S3_REGION || process.env.AWS_REGION || "ap-south-1",
    endpoint,
    // AWS wants virtual-host style; local S3 servers generally need path style
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true" || !!endpoint,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    uploadTtl: Number(process.env.S3_UPLOAD_TTL_SECONDS || 300),
    downloadTtl: Number(process.env.S3_DOWNLOAD_TTL_SECONDS || 120),
  };
}

export const storageConfigured = () => !!settings().bucket;

let cached = { key: null, client: null };

function client() {
  const s = settings();
  if (!s.bucket) throw new Error("S3_BUCKET is not configured");

  const key = `${s.endpoint || "aws"}|${s.region}|${s.accessKeyId || "default"}`;
  if (cached.key === key) return cached.client;

  cached = {
    key,
    client: new S3Client({
      region: s.region,
      ...(s.endpoint ? { endpoint: s.endpoint } : {}),
      forcePathStyle: s.forcePathStyle,
      // fall back to the default provider chain (IAM role, profile) when no keys are set
      ...(s.accessKeyId && s.secretAccessKey
        ? { credentials: { accessKeyId: s.accessKeyId, secretAccessKey: s.secretAccessKey } }
        : {}),
    }),
  };
  return cached.client;
}

/** Only for tests that restart a local S3 server on a new port. */
export const resetStorageClient = () => { cached = { key: null, client: null }; };

/**
 * Presigned POST for a browser upload.
 *
 * The size limit and the content type are signed *conditions*, so S3 itself
 * rejects an oversized or mistyped body. Validating those in the API alone
 * would only check what the client claimed it was about to send.
 */
export async function presignUpload({ key, contentType, maxBytes = MAX_DOCUMENT_BYTES }) {
  const s = settings();
  const { url, fields } = await createPresignedPost(client(), {
    Bucket: s.bucket,
    Key: key,
    Expires: s.uploadTtl,
    Conditions: [
      ["content-length-range", 1, maxBytes],
      ["eq", "$Content-Type", contentType],
    ],
    Fields: { "Content-Type": contentType },
  });
  return { url, fields, expiresIn: s.uploadTtl, maxBytes };
}

/** Confirms the object landed, and reports what actually arrived. */
export async function headObject(key) {
  const s = settings();
  try {
    const r = await client().send(new HeadObjectCommand({ Bucket: s.bucket, Key: key }));
    return { exists: true, size: Number(r.ContentLength || 0), contentType: r.ContentType || "application/octet-stream" };
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err.name === "NotFound" || err.name === "NoSuchKey") {
      return { exists: false };
    }
    throw err;
  }
}

/**
 * Short-lived download link.
 *
 * Content-Disposition is forced to `attachment`: even though the upload
 * allowlist excludes HTML and SVG, nothing renders inline from the bucket
 * origin, so a mislabelled file cannot execute in a resident's browser.
 */
export async function presignDownload({ key, fileName, contentType }) {
  const s = settings();
  const url = await getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: s.bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${String(fileName || "download").replace(/"/g, "")}"`,
      ...(contentType ? { ResponseContentType: contentType } : {}),
    }),
    { expiresIn: s.downloadTtl },
  );
  return { url, expiresIn: s.downloadTtl };
}

export async function deleteObject(key) {
  const s = settings();
  await client().send(new DeleteObjectCommand({ Bucket: s.bucket, Key: key }));
}

export async function deleteObjects(keys) {
  if (!keys.length) return;
  const s = settings();
  await client().send(new DeleteObjectsCommand({
    Bucket: s.bucket,
    Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
  }));
}
