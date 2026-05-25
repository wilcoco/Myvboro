import { destroyCurrentSession } from "@/lib/session";

export async function POST() {
  await destroyCurrentSession();
  return Response.json({ ok: true });
}
