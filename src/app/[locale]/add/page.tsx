import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Link } from "@/i18n/routing";
import AddVisitForm from "@/components/AddVisitForm";

export default async function AddPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/signin`);

  const t = await getTranslations("Add");

  return (
    <main className="min-h-dvh flex flex-col">
      <header className="px-4 py-3 flex items-center justify-between border-b">
        <Link href="/" className="font-semibold tracking-tight">
          myvboro
        </Link>
        <h1 className="text-sm text-muted-foreground">{t("title")}</h1>
        <Link href="/map" className="text-sm hover:underline">
          {t("backToMap")}
        </Link>
      </header>

      <div className="flex-1 px-4 py-6">
        <AddVisitForm
          labels={{
            locating: t("locating"),
            getLocation: t("getLocation"),
            locationOk: t("locationOk"),
            permissionDenied: t("permissionDenied"),
            storefront: t("storefront"),
            menu: t("menu"),
            food: t("food"),
            takePhoto: t("takePhoto"),
            choosePhoto: t("choosePhoto"),
            placeName: t("placeName"),
            placeNamePlaceholder: t("placeNamePlaceholder"),
            categoryPlaceholder: t("categoryPlaceholder"),
            nearbyMatches: t("nearbyMatches"),
            createNew: t("createNew"),
            comment: t("comment"),
            commentPlaceholder: t("commentPlaceholder"),
            rating: t("rating"),
            submit: t("submit"),
            submitting: t("submitting"),
            uploadFailed: t("uploadFailed"),
            saved: t("saved"),
            tierHint: t("tierHint"),
            rateRecommenderTitle: t("rateRecommenderTitle"),
            rateRecommenderBody: t("rateRecommenderBody"),
            rateRecommenderSubmit: t("rateRecommenderSubmit"),
            rateRecommenderSkip: t("rateRecommenderSkip"),
          }}
        />
      </div>
    </main>
  );
}
