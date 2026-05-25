import { z } from "zod";
import { issueOtp } from "@/lib/otp";
import { toE164 } from "@/lib/utils";

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

  const result = await issueOtp(phone);
  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.reason, retryAfterSec: result.retryAfterSec },
      { status: 429 },
    );
  }
  return Response.json({ ok: true, expiresAt: result.expiresAt });
}
