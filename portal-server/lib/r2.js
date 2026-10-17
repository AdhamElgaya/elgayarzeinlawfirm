import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutBucketCorsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function r2Value(name) {
  return String(process.env[name] || "").trim();
}

export function r2Configured() {
  return Boolean(
    r2Value("R2_ACCOUNT_ID") &&
      r2Value("R2_ACCESS_KEY_ID") &&
      r2Value("R2_SECRET_ACCESS_KEY") &&
      r2Value("R2_BUCKET_NAME")
  );
}

let client;

function getClient() {
  if (!r2Configured()) {
    throw new Error("R2 is not configured.");
  }
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${r2Value("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2Value("R2_ACCESS_KEY_ID"),
        secretAccessKey: r2Value("R2_SECRET_ACCESS_KEY"),
      },
      // Newer AWS SDK checksums are rejected by R2 unless they are optional.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return client;
}

function bucket() {
  return r2Value("R2_BUCKET_NAME");
}

function corsOrigins() {
  const fromEnv = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return [
    ...new Set([
      ...fromEnv,
      String(process.env.PUBLIC_BASE_URL || "").trim(),
      "https://www.gzlawfirm.net",
      "https://gzlawfirm.net",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ].filter(Boolean)),
  ];
}

export async function r2Prepare() {
  if (!r2Configured()) return { ok: false, reason: "missing R2 env" };
  await getClient().send(new ListObjectsV2Command({ Bucket: bucket(), MaxKeys: 1 }));
  try {
    await getClient().send(
      new PutBucketCorsCommand({
        Bucket: bucket(),
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: corsOrigins(),
              AllowedMethods: ["GET", "PUT", "HEAD"],
              AllowedHeaders: ["*"],
              ExposeHeaders: ["ETag"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      })
    );
  } catch (error) {
    console.warn("[portal] R2 CORS was not updated:", error.name || error.message);
  }
  return { ok: true, bucket: bucket() };
}

export async function r2PutObject(key, body, contentType) {
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType || "application/octet-stream",
    })
  );
}

export async function r2GetObject(key, options = {}) {
  return getClient().send(
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ...(options.range ? { Range: options.range } : {}),
    })
  );
}

export async function r2PeekObject(key, length = 8) {
  const result = await r2GetObject(key, { range: `bytes=0-${Math.max(0, length - 1)}` });
  if (result.Body?.transformToByteArray) {
    return Buffer.from(await result.Body.transformToByteArray());
  }
  const chunks = [];
  for await (const chunk of result.Body || []) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function r2DeleteObject(key) {
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: bucket(),
      Key: key,
    })
  );
}

export async function r2ObjectExists(key) {
  try {
    await getClient().send(
      new HeadObjectCommand({
        Bucket: bucket(),
        Key: key,
      })
    );
    return true;
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode;
    if (status === 404 || error?.name === "NotFound") return false;
    throw error;
  }
}

export async function r2SignedPutUrl(key, contentType, expiresInSeconds = 300) {
  const command = new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    ContentType: contentType || "application/octet-stream",
  });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

export async function r2SignedGetUrl(key, options = {}) {
  const command = new GetObjectCommand({
    Bucket: bucket(),
    Key: key,
    ResponseContentType: options.contentType,
    ResponseContentDisposition: options.contentDisposition,
  });
  return getSignedUrl(getClient(), command, { expiresIn: options.expiresInSeconds || 120 });
}
