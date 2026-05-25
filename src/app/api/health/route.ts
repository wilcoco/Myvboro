// Lightweight healthcheck — Railway hits this to decide if a deploy is up.
// Does NOT touch the DB so a degraded Postgres doesn't cause crashloops.
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ ok: true, t: Date.now() });
}
