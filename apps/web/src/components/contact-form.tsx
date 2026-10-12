"use client";

import Script from "next/script";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

type Service = { id: string; name: string };

declare global {
  interface Window {
    turnstile?: { reset: () => void };
  }
}

export function ContactForm({ services, siteKey }: { services: Service[]; siteKey: string }) {
  const locale = useLocale() === "bn" ? "bn" : "en";
  const t = useTranslations("Contact");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorCode, setErrorCode] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setState("sending");
    setErrorCode("");
    const query = new URLSearchParams(window.location.search);

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: values.get("name"),
          email: values.get("email"),
          phone: values.get("phone"),
          company: values.get("company"),
          country: values.get("country"),
          serviceId: values.get("service_id"),
          message: values.get("message"),
          consent: values.get("consent") === "on",
          website: values.get("website"),
          turnstileToken: values.get("cf-turnstile-response"),
          locale,
          utm: Object.fromEntries(
            ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]
              .map((key) => [key, query.get(key) ?? ""]),
          ),
        }),
      });
      const result = await response.json() as { ok?: boolean; code?: string };
      if (!response.ok || !result.ok) {
        setErrorCode(result.code ?? "save_failed");
        setState("error");
        window.turnstile?.reset();
        return;
      }
      form.reset();
      window.turnstile?.reset();
      setState("sent");
    } catch {
      setErrorCode("network_error");
      setState("error");
      window.turnstile?.reset();
    }
  }

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      <form className="contact-form" onSubmit={submit}>
        <label><span>{t("fields.name")}</span><input name="name" maxLength={120} required autoComplete="name" /></label>
        <label><span>{t("fields.company")}</span><input name="company" maxLength={120} autoComplete="organization" /></label>
        <label><span>{t("fields.email")}</span><input name="email" type="email" maxLength={320} autoComplete="email" /></label>
        <label><span>{t("fields.phone")}</span><input name="phone" type="tel" maxLength={40} autoComplete="tel" /></label>
        <p className="contact-hint">{t("contactHint")}</p>
        <label><span>{t("fields.country")}</span><input name="country" maxLength={80} autoComplete="country-name" /></label>
        <label><span>{t("fields.service")}</span><select name="service_id" defaultValue=""><option value="">{t("fields.chooseService")}</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
        <label className="contact-wide"><span>{t("fields.message")}</span><textarea name="message" minLength={10} maxLength={5000} rows={7} required /></label>
        <label className="contact-honeypot" aria-hidden="true"><span>Website</span><input name="website" tabIndex={-1} autoComplete="off" /></label>
        <label className="contact-consent"><input name="consent" type="checkbox" required /><span>{t("consent")}</span></label>
        {siteKey ? <div className="contact-turnstile"><div className="cf-turnstile" data-sitekey={siteKey} data-action="contact" data-language={locale} /></div> : <p className="contact-alert contact-alert-error" role="alert">{t("errors.not_configured")}</p>}
        {state === "sent" ? <p className="contact-alert contact-alert-success" role="status">{t("success")}</p> : null}
        {state === "error" ? <p className="contact-alert contact-alert-error" role="alert">{t(`errors.${errorCode}`)}</p> : null}
        <button type="submit" disabled={state === "sending" || !siteKey}>{state === "sending" ? t("sending") : t("submit")}</button>
      </form>
    </>
  );
}

