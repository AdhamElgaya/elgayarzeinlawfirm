import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export function r2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME
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
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

function bucket() {
  return process.env.R2_BUCKET_NAME;
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

export async function r2GetObject(key) {
  return getClient().send(
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
    })
  );
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
