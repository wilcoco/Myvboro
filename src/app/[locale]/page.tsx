import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();

  return (
    <main className="min-h-dvh flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight text-lg">
          {t("Brand.name")}
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/map" className="hover:text-foreground">
            {t("Nav.map")}
          </Link>
          <Link href="/signin" className="hover:text-foreground">
            {t("Nav.signin")}
          </Link>
        </nav>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight max-w-2xl">
          {t("Landing.title")}
        </h1>
        <p className="mt-4 text-muted-foreground max-w-xl">
          {t("Landing.subtitle")}
        </p>
        <Link
          href="/map"
          className="mt-8 inline-flex items-center rounded-full bg-primary px-6 py-3 text-primary-foreground font-medium hover:opacity-90 transition"
        >
          {t("Landing.openMap")}
        </Link>
      </section>

      <footer className="px-6 py-4 text-xs text-muted-foreground">
        {t("Brand.tagline")}
      </footer>
    </main>
  );
}
