import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { createUploadUrl, isR2Configured } from "@/lib/r2";

const BodySchema = z.object({
  kind: z.enum(["STOREFRONT", "MENU", "FOOD", "INTERIOR", "RECEIPT"]),
  contentType: z.string().regex(/^image\/(jpeg|png|webp|heic)$/),
});

// POST /api/photos/upload — returns a presigned PUT URL the client uses to
// upload directly to R2, plus the public URL and storage key to include in
// the subsequent /api/visits payload.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isR2Configured()) {
    return NextResponse.json({ error: "storage not configured" }, { status: 503 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ext = parsed.data.contentType.split("/")[1].replace("jpeg", "jpg");
  const key = `visits/${session.user.id}/${Date.now()}-${crypto
    .randomUUID()
    .slice(0, 8)}.${ext}`;

  const { url, publicUrl } = await createUploadUrl({
    key,
    contentType: parsed.data.contentType,
  });

  return NextResponse.json({ uploadUrl: url, publicUrl, key });
}
