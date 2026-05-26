import { z } from "zod";
import { issueOtp } from "@/lib/otp";
import { toE164 } from "@/lib/utils";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { grantSignupBonus } from "@/lib/economy";

const Body = z.object({ phoneNumber: z.string().min(7).max(20) });

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "INVALID" }, { status: 400 });
  }
  const phone = toE164(parsed.data.phoneNumber);
  if (!phone) {
    return Response.json({ ok: false, error: "INVALID_PHONE" }, { status: 400 });
  }

  // Dev / staging shortcut: when no real SMS provider is wired, skip OTP
  // entirely and create the session right away. env.ts already refuses to
  // start the app in production with SMS_PROVIDER=mock unless
  // ALLOW_MOCK_SMS_IN_PROD=true is set, so reaching this branch in prod is
  // an explicit operator choice, not an oversight.
  if (env.smsProvider === "mock") {
    const existing = await prisma.user.findUnique({ where: { phoneNumber: phone } });
    let userId: string;
    if (existing) {
      userId = existing.id;
    } else {
      const created = await prisma.user.create({
        data: { phoneNumber: phone },
        select: { id: true },
      });
      userId = created.id;
      await grantSignupBonus(userId);
    }
    await createSession(userId);
    return Response.json({ ok: true, autoSignedIn: true, newUser: !existing });
  }

  const result = await issueOtp(phone);
  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.reason, retryAfterSec: result.retryAfterSec },
      { status: 429 },
    );
  }
  return Response.json({ ok: true, expiresAt: result.expiresAt });
}
