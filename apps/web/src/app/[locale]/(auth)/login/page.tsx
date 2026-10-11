import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { safePostLoginPath } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import { signInWithGoogle, signOut } from "../actions";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
    logged_out?: string | string[];
  }>;
};

const errorKeys = new Set([
  "oauth_denied",
  "oauth_start_failed",
  "oauth_callback_failed",
  "invalid_callback",
  "sign_out_failed",
]);

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const query = await searchParams;
  const next = safePostLoginPath(query.next, locale);
  const error = typeof query.error === "string" && errorKeys.has(query.error)
    ? query.error
    : null;
  const loggedOut = query.logged_out === "1";
  const t = await getTranslations({ locale, namespace: "Login" });

  let user: { email?: string } | null = null;
  try {
    const supabase = await createClient();
    const result = await supabase.auth.getUser();
    if (!result.error) user = result.data.user;
  } catch {
    // Missing or temporarily unavailable auth config is shown as sign-in failure.
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-heading">
        <p className="eyebrow">{t("brand")}</p>
        <h1 id="login-heading">{user ? t("signedInTitle") : t("title")}</h1>

        {error ? <p className="auth-message auth-error" role="alert">{t(`errors.${error}`)}</p> : null}
        {loggedOut ? <p className="auth-message auth-success" role="status">{t("loggedOut")}</p> : null}

        {user ? (
          <>
            <p className="description">{t("signedInAs", { email: user.email ?? t("unknownEmail") })}</p>
            <div className="auth-actions">
              <Link className="auth-button" href={next}>{t("continue")}</Link>
              <form action={signOut.bind(null, locale)}>
                <button className="auth-button auth-button-secondary" type="submit">{t("signOut")}</button>
              </form>
            </div>
          </>
        ) : (
          <>
            <p className="description">{t("description")}</p>
            <form action={signInWithGoogle.bind(null, locale, next)}>
              <button className="auth-button" type="submit">{t("google")}</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
