import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/routing";

import ProfileVisitsMap from "@/components/ProfileVisitsMap";
import PendingEndorsementsList from "@/components/PendingEndorsementsList";
import SignOutButton from "@/components/SignOutButton";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/signin`);

  const t = await getTranslations("Profile");

  const [user, visits, pending] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.visit.findMany({
      where: { userId: session.user.id },
      include: {
        place: { select: { id: true, primaryName: true, category: true } },
        photos: { select: { id: true, kind: true, url: true }, take: 1 },
      },
      orderBy: { visitedAt: "desc" },
      take: 50,
    }),
    prisma.endorsement.findMany({
      where: {
        toUserId: session.user.id,
        satisfaction: null,
        visitId: { not: null },
      },
      include: {
        fromUser: { select: { id: true, name: true, image: true } },
        place: { select: { id: true, primaryName: true } },
      },
      orderBy: { visitedAt: "desc" },
    }),
  ]);

  if (!user) redirect(`/${locale}/signin`);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  return (
    <main className="min-h-dvh px-4 py-6 max-w-md mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <Link href="/map" className="text-sm hover:underline">
          ← {t("backToMap")}
        </Link>
        <SignOutButton label={t("signOut")} />
      </header>

      <section className="flex items-center gap-3">
        {/* Avatar is a remote URL (Google etc.); keep <img> to avoid
            having to register every provider in next.config images. */}
        {user.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="w-12 h-12 rounded-full" />
        )}
        <div className="min-w-0">
          <div className="font-semibold truncate">{user.name ?? user.email}</div>
          <div className="text-xs text-muted-foreground truncate">{user.email}</div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Stat label={t("authority")} value={user.authorityScore.toFixed(1)} />
        <Stat label={t("breadth")} value={user.breadthScore.toFixed(2)} />
        <Stat label={t("distribution")} value={user.distributionScore.toFixed(2)} />
        <Stat label={t("hitRate")} value={`${Math.round(user.hitRate * 100)}%`} />
      </section>

      {user.suspicionScore > 0.5 && (
        <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">{t("suspicionTitle")}</div>
            <div className="text-xs mt-1 opacity-90">{t("suspicionBody")}</div>
          </div>
        </div>
      )}

      {visits.length > 0 && (
        <section>
          <h2 className="text-sm font-medium mb-2">{t("territoryTitle")}</h2>
          <ProfileVisitsMap
            visits={visits.map((v) => ({ lat: v.lat, lng: v.lng }))}
            mapboxToken={mapboxToken}
          />
        </section>
      )}

      {pending.length > 0 && (
        <PendingEndorsementsList
          items={pending.map((e) => ({
            id: e.id,
            fromUser: e.fromUser,
            place: e.place,
          }))}
          labels={{
            title: t("pendingTitle"),
            body: t("pendingBody"),
            submit: t("ratingSubmit"),
            submitting: t("ratingSubmitting"),
          }}
        />
      )}

      <section>
        <h2 className="text-sm font-medium mb-2">
          {t("visitsTitle")} ({visits.length})
        </h2>
        {visits.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("noVisits")}{" "}
            <Link href="/add" className="underline">
              {t("addFirst")}
            </Link>
          </p>
        ) : (
          <ul className="space-y-2">
            {visits.map((v) => (
              <li
                key={v.id}
                className="rounded-lg border bg-card p-3 flex items-center gap-3"
              >
                {v.photos[0]?.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={v.photos[0].url}
                    alt=""
                    className="w-12 h-12 rounded object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {v.place?.primaryName ?? v.rawName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    T{v.tier} · w{v.weight.toFixed(0)} ·{" "}
                    {new Date(v.visitedAt).toLocaleDateString()}
                    {v.rating != null && ` · ★${v.rating}`}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}
