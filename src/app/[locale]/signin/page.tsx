import { setRequestLocale, getTranslations } from "next-intl/server";
import { signIn } from "@/auth";
import { Link } from "@/i18n/routing";

export default async function SignInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6">
      <Link href="/" className="absolute top-4 left-4 text-sm text-muted-foreground hover:text-foreground">
        ← myvboro
      </Link>

      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-center">
          {t("signInTitle")}
        </h1>

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-md border bg-card px-4 py-3 text-sm font-medium hover:bg-accent transition"
          >
            {t("withGoogle")}
          </button>
        </form>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          <span>{t("or")}</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form
          action={async (formData) => {
            "use server";
            await signIn("resend", { email: formData.get("email"), redirectTo: "/" });
          }}
          className="space-y-3"
        >
          <input
            type="email"
            name="email"
            required
            placeholder={t("emailPlaceholder")}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
          >
            {t("sendMagicLink")}
          </button>
        </form>
      </div>
    </main>
  );
}
