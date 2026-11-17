"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import Script from "next/script";
import { AlertCircle, ArrowRight, CheckCircle2, Send } from "lucide-react";

declare global {
  interface Window {
    turnstile?: { reset: () => void };
  }
}

interface FallbackStateProps {
  locale?: "en" | "bn";
  initialMessage?: string;
  onSuccess?: () => void;
  siteKey?: string;
}

export function FallbackState({
  locale = "en",
  initialMessage = "",
  onSuccess,
  siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
}: FallbackStateProps) {
  const isBn = locale === "bn";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(initialMessage);
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const values = new FormData(form);
    setState("sending");
    setErrorMessage("");

    const turnstileToken =
      (values.get("cf-turnstile-response") as string) ||
      (typeof window !== "undefined" && (window as unknown as { turnstileToken?: string }).turnstileToken) ||
      "";

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          message,
          consent,
          locale,
          turnstileToken,
          utm: { utm_source: "chat_fallback" },
        }),
      });

      const data = (await res.json()) as { ok?: boolean; code?: string };
      if (!res.ok || !data.ok) {
        setState("error");
        setErrorMessage(
          isBn
            ? "বার্তা পাঠাতে ব্যর্থ হয়েছে। অনুগ্রহ করে সম্পূর্ণ যোগাযোগ পৃষ্ঠা ব্যবহার করুন।"
            : "Failed to send message. Please use our main contact page."
        );
        window.turnstile?.reset();
        return;
      }

      setState("sent");
      window.turnstile?.reset();
      onSuccess?.();
    } catch {
      setState("error");
      setErrorMessage(
        isBn
          ? "নেটওয়ার্ক ত্রুটি। অনুগ্রহ করে সরাসরি যোগাযোগ করুন।"
          : "Network error. Please use our contact page directly."
      );
      window.turnstile?.reset();
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 text-center my-2 space-y-2">
        <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto" />
        <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
          {isBn ? "বার্তা সফলভাবে পাঠানো হয়েছে!" : "Message Sent Successfully!"}
        </h4>
        <p className="text-[11px] text-muted-foreground">
          {isBn
            ? "আমাদের প্রকৌশলী দল দ্রুত আপনার সাথে যোগাযোগ করবে।"
            : "Our engineering team will get back to you shortly."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-4 shadow-sm my-2 space-y-3">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
      />
      <div className="flex items-start gap-2.5">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400">
            {isBn ? "চ্যাট সাময়িকভাবে অনুপলব্ধ" : "Chat Currently Unavailable"}
          </h4>
          <p className="text-[11px] text-amber-700/90 dark:text-amber-400/80 leading-relaxed mt-0.5">
            {isBn
              ? "সরাসরি আমাদের দলের সাথে যোগাযোগ করতে নিচের ফর্মটি ব্যবহার করুন:"
              : "Reach our solutions team directly using this quick inquiry form:"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2 pt-1">
        <div>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isBn ? "আপনার নাম" : "Your Name"}
            className="w-full rounded-md border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={isBn ? "আপনার ইমেইল" : "Your Email"}
            className="w-full rounded-md border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <textarea
            required
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={isBn ? "আপনার প্রজেক্টের বিস্তারিত..." : "Project details or question..."}
            className="w-full rounded-md border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        <label className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
          <input
            type="checkbox"
            required
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            className="mt-0.5"
          />
          <span>
            {isBn
              ? "আমার অনুরোধের উত্তর দিতে আমার তথ্য ব্যবহারে সম্মতি দিচ্ছি। "
              : "I consent to the use of my details to answer this enquiry. "}
            <Link
              href="/privacy"
              className="font-semibold text-primary hover:underline"
            >
              {isBn ? "গোপনীয়তা নীতি" : "Privacy Policy"}
            </Link>
          </span>
        </label>

        {siteKey ? (
          <div className="booking-turnstile py-1">
            <div
              className="cf-turnstile"
              data-sitekey={siteKey}
              data-action="contact"
              data-language={locale}
              data-size="flexible"
            />
          </div>
        ) : null}

        {state === "error" && (
          <p className="text-[11px] text-destructive font-medium">{errorMessage}</p>
        )}

        <div className="flex items-center justify-between pt-1">
          <Link
            href="/contact"
            className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
          >
            <span>{isBn ? "পূর্ণাঙ্গ যোগাযোগ পৃষ্ঠা" : "Full Contact Page"}</span>
            <ArrowRight className="h-3 w-3" />
          </Link>

          <button
            type="submit"
            disabled={state === "sending"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Send className="h-3 w-3" />
            <span>
              {state === "sending"
                ? isBn
                  ? "পাঠানো হচ্ছে..."
                  : "Sending..."
                : isBn
                ? "পাঠান"
                : "Send"}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
