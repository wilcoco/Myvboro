import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

export default async function CheckEmailPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{t("checkEmail")}</h1>
      <p className="mt-3 text-muted-foreground max-w-sm">{t("checkEmailBody")}</p>
      <Link href="/" className="mt-8 text-sm underline">
        myvboro
      </Link>
    </main>
  );
}
