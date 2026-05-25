import { setRequestLocale, getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { Link } from "@/i18n/routing";
import MapCanvas from "@/components/MapCanvas";

export default async function MapPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const session = await auth();
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  return (
    <main className="h-dvh w-dvw flex flex-col">
      <header className="px-4 py-3 flex items-center justify-between border-b">
        <Link href="/" className="font-semibold tracking-tight">
          {t("Brand.name")}
        </Link>
        <h1 className="text-sm text-muted-foreground">{t("Map.title")}</h1>
        <Link
          href={session?.user ? "/profile" : "/signin"}
          className="text-sm hover:underline"
        >
          {session?.user ? t("Nav.profile") : t("Nav.signin")}
        </Link>
      </header>
      <div className="flex-1 relative">
        <MapCanvas
          mapboxToken={mapboxToken}
          isAuthed={Boolean(session?.user?.id)}
          labels={{
            locateMe: t("Map.locateMe"),
            locating: t("Map.locating"),
            permissionDenied: t("Map.permissionDenied"),
            loading: t("Map.loading"),
            addVisit: t("Map.addVisit"),
            sheet: {
              loading: t("Sheet.loading"),
              visits: t("Sheet.visits"),
              queueUp: t("Sheet.queueUp"),
              queued: t("Sheet.queued"),
              loginToQueue: t("Sheet.loginToQueue"),
              noVisits: t("Sheet.noVisits"),
              close: t("Sheet.close"),
              suspected: t("Sheet.suspected"),
            },
          }}
        />
      </div>
    </main>
  );
}
