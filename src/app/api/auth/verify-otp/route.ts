import { z } from "zod";
import { verifyOtp } from "@/lib/otp";
import { toE164 } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { grantSignupBonus } from "@/lib/economy";

const Body = z.object({
  phoneNumber: z.string().min(7).max(20),
  code: z.string().regex(/^\d{4,8}$/),
});

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

  const result = await verifyOtp(phone, parsed.data.code);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.reason }, { status: 401 });
  }

  // Upsert user. New users get the signup bonus.
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
  return Response.json({ ok: true, newUser: !existing });
}
