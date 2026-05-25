import {
  S3Client,
  PutObjectCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID ?? "";
const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";

export const R2_BUCKET = process.env.R2_BUCKET ?? "myvboro-photos";
export const R2_PUBLIC_URL =
  process.env.R2_PUBLIC_URL?.replace(/\/$/, "") ?? "";

export const r2 = new S3Client({
  region: "auto",
  endpoint: accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined,
  credentials:
    accessKeyId && secretAccessKey
      ? { accessKeyId, secretAccessKey }
      : undefined,
});

export function isR2Configured() {
  return Boolean(accountId && accessKeyId && secretAccessKey && R2_PUBLIC_URL);
}

export async function createUploadUrl(opts: {
  key: string;
  contentType: string;
  expiresInSec?: number;
}) {
  const input: PutObjectCommandInput = {
    Bucket: R2_BUCKET,
    Key: opts.key,
    ContentType: opts.contentType,
  };
  const url = await getSignedUrl(r2, new PutObjectCommand(input), {
    expiresIn: opts.expiresInSec ?? 60 * 5,
  });
  return { url, publicUrl: `${R2_PUBLIC_URL}/${opts.key}` };
}
