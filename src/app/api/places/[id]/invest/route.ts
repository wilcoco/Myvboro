import { z } from "zod";
import { requireUser } from "@/lib/session";
import { investInPlace } from "@/lib/invest";

const Body = z.object({ amount: z.number().int().positive() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { id: placeId } = await params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "INVALID" }, { status: 400 });
  }

  const result = await investInPlace({
    userId: user.id,
    placeId,
    amount: parsed.data.amount,
  });
  if (!result.ok) {
    return Response.json(result, { status: 400 });
  }
  return Response.json(result);
}
