import { z } from "zod";
import { requireUser } from "@/lib/session";
import { presignPhotoUpload } from "@/lib/r2";

const Body = z.object({
  contentType: z.string().regex(/^image\/(jpeg|png|webp|heic)$/),
});

export async function POST(req: Request) {
  try {
    await requireUser();
  } catch {
    return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "INVALID" }, { status: 400 });
  }

  const result = await presignPhotoUpload({ contentType: parsed.data.contentType });
  if (!result.ok) {
    // R2 not configured: surface a stub so the UI can still flow in dev.
    return Response.json({
      ok: true,
      stub: true,
      uploadUrl: null,
      publicUrl: `https://placehold.co/600x400?text=photo+stub`,
      key: "stub",
    });
  }
  return Response.json(result);
}
