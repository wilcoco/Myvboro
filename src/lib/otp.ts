import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/session";
import { sendSms } from "@/lib/sms";

const OTP_TTL_MIN = 5;
const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SEC = 60;
const MAX_ATTEMPTS_PER_CODE = 5;
// Rate limit: at most N OTPs per phoneNumber per hour.
const MAX_PER_HOUR = 5;

function generateCode(): string {
  // 6 digits, leading zeros preserved.
  const n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(OTP_LENGTH, "0");
}

export type IssueResult =
  | { ok: true; expiresAt: Date }
  | { ok: false; reason: "RATE_LIMITED" | "COOLDOWN"; retryAfterSec?: number };

export async function issueOtp(phoneNumber: string): Promise<IssueResult> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const cooldownAgo = new Date(now.getTime() - RESEND_COOLDOWN_SEC * 1000);

  const [perHour, lastIssued] = await Promise.all([
    prisma.otpCode.count({
      where: { phoneNumber, createdAt: { gte: oneHourAgo } },
    }),
    prisma.otpCode.findFirst({
      where: { phoneNumber },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  if (perHour >= MAX_PER_HOUR) return { ok: false, reason: "RATE_LIMITED" };
  if (lastIssued && lastIssued.createdAt > cooldownAgo) {
    const wait = Math.ceil(
      (RESEND_COOLDOWN_SEC * 1000 - (now.getTime() - lastIssued.createdAt.getTime())) / 1000,
    );
    return { ok: false, reason: "COOLDOWN", retryAfterSec: Math.max(1, wait) };
  }

  const code = generateCode();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MIN * 60 * 1000);

  await prisma.otpCode.create({
    data: {
      phoneNumber,
      codeHash: sha256(code),
      expiresAt,
    },
  });

  await sendSms(phoneNumber, `[myvboro] 인증번호: ${code} (${OTP_TTL_MIN}분간 유효)`);

  return { ok: true, expiresAt };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "NOT_FOUND" | "EXPIRED" | "WRONG" | "TOO_MANY_ATTEMPTS" };

export async function verifyOtp(phoneNumber: string, code: string): Promise<VerifyResult> {
  const otp = await prisma.otpCode.findFirst({
    where: { phoneNumber, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return { ok: false, reason: "NOT_FOUND" };
  if (otp.expiresAt < new Date()) return { ok: false, reason: "EXPIRED" };
  if (otp.attempts >= MAX_ATTEMPTS_PER_CODE) return { ok: false, reason: "TOO_MANY_ATTEMPTS" };

  if (otp.codeHash !== sha256(code)) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: otp.attempts + 1 },
    });
    return { ok: false, reason: "WRONG" };
  }

  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { consumedAt: new Date() },
  });
  return { ok: true };
}
