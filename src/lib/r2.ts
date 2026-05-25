import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env, r2Enabled } from "@/lib/env";
import { randomBytes } from "crypto";

let _client: S3Client | null = null;
function client(): S3Client {
  if (_client) return _client;
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${env.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.r2.accessKeyId,
      secretAccessKey: env.r2.secretAccessKey,
    },
  });
  return _client;
}

export type PresignResult =
  | { ok: true; uploadUrl: string; publicUrl: string; key: string }
  | { ok: false; reason: "DISABLED" };

export async function presignPhotoUpload(opts: {
  contentType: string;
}): Promise<PresignResult> {
  if (!r2Enabled) return { ok: false, reason: "DISABLED" };

  const ext = opts.contentType.split("/")[1] || "jpg";
  const key = `${new Date().toISOString().slice(0, 10)}/${randomBytes(12).toString("hex")}.${ext}`;
  const cmd = new PutObjectCommand({
    Bucket: env.r2.bucket,
    Key: key,
    ContentType: opts.contentType,
  });
  const uploadUrl = await getSignedUrl(client(), cmd, { expiresIn: 300 });
  const publicUrl = env.r2.publicUrl
    ? `${env.r2.publicUrl.replace(/\/$/, "")}/${key}`
    : uploadUrl.split("?")[0];
  return { ok: true, uploadUrl, publicUrl, key };
}
