import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { loginPath, type Locale } from "@/lib/auth/routes";
import { acceptInvitePath, validInviteToken } from "@/lib/invites/routes";
import { createClient } from "@/lib/supabase/server";
import { acceptClientInvite } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[]; error?: string | string[] }>;
};

export default async function AcceptInvitePage({ params, searchParams }: Props) {
  const { locale: localeValue } = await params;
  if (!hasLocale(routing.locales, localeValue)) notFound();
  const locale: Locale = localeValue;
  const query = await searchParams;
  const token = validInviteToken(query.token);
  const failed = query.error === "invalid_or_expired_invite" || !token;
  const t = await getTranslations({ locale, namespace: "Invite" });

  let user: { email?: string } | null = null;
  try {
    const supabase = await createClient();
    const result = await supabase.auth.getUser();
    if (!result.error) user = result.data.user;
  } catch {
    // A missing session is handled as signed out below.
  }

  const next = token ? acceptInvitePath(locale, token) : `/${locale}/accept-invite`;
  if (!failed && !user) redirect(loginPath(locale, next));

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="invite-heading">
        <p className="eyebrow">{t("brand")}</p>
        <h1 id="invite-heading">{failed ? t("invalidTitle") : t("title")}</h1>

        {failed ? (
          <>
            <p className="auth-message auth-error" role="alert">{t("invalidDescription")}</p>
            <div className="auth-actions">
              <Link className="auth-button auth-button-secondary" href={`/${locale}`}>
                {t("returnHome")}
              </Link>
            </div>
          </>
        ) : user ? (
          <>
            <p className="description">{t("signedInAs", { email: user.email ?? t("unknownEmail") })}</p>
            <p className="description">{t("confirmDescription")}</p>
            <div className="auth-actions">
              <form action={acceptClientInvite.bind(null, locale, token ?? "")}>
                <button className="auth-button" type="submit">{t("accept")}</button>
              </form>
              <Link className="auth-button auth-button-secondary" href={`/${locale}`}>
                {t("cancel")}
              </Link>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
