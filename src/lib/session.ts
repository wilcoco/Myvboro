import { cookies, headers } from "next/headers";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

const COOKIE_NAME = "mv_session";
const SESSION_TTL_DAYS = 60;

function randomToken(): string {
  // 32 bytes -> 64 hex chars. Plenty.
  return randomBytes(32).toString("hex");
}

function hashFingerprint(ua: string | null, accept: string | null, ip: string | null): string {
  return createHash("sha256")
    .update([ua ?? "", accept ?? "", ip ?? ""].join("|"))
    .digest("hex")
    .slice(0, 32);
}

export async function createSession(userId: string): Promise<string> {
  const hdrs = await headers();
  const ua = hdrs.get("user-agent");
  const accept = hdrs.get("accept-language");
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    null;
  const fp = hashFingerprint(ua, accept, ip);

  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 3600 * 1000);

  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
      userAgent: ua,
      deviceFingerprint: fp,
      ip,
    },
  });

  // Upsert the device link for sybil tracking. Best-effort: failures here
  // shouldn't block login.
  try {
    await prisma.deviceLink.upsert({
      where: { userId_deviceFingerprint: { userId, deviceFingerprint: fp } },
      create: { userId, deviceFingerprint: fp },
      update: { lastSeenAt: new Date() },
    });
  } catch {
    /* ignore */
  }

  const jar = await cookies();
  jar.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } }).catch(() => undefined);
  }
  jar.delete(COOKIE_NAME);
}

export type CurrentUser = {
  id: string;
  phoneNumber: string;
  displayName: string | null;
  points: number;
  createdAt: Date;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;

  // Touch lastSeenAt sporadically (no need on every request).
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    await prisma.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }

  const u = session.user;
  return {
    id: u.id,
    phoneNumber: u.phoneNumber,
    displayName: u.displayName,
    points: u.points,
    createdAt: u.createdAt,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw new Error("UNAUTHENTICATED");
  return u;
}

// Re-exported helper kept here so callers don't have to import crypto.
export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

// Suppress unused-var warning while keeping env import alive for tree-shaking
// (the secret will be used when we move to stateless JWTs).
void env;
