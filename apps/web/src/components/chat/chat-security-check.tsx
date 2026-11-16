"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

interface ChatSecurityCheckProps {
  siteKey: string;
  locale: "en" | "bn";
  onVerified: (token: string) => void;
  onError: () => void;
}

type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string;
    action: string;
    language: "en" | "bn";
    size: "flexible";
    callback: (token: string) => void;
    "expired-callback": () => void;
    "error-callback": () => void;
    "timeout-callback": () => void;
  }) => string;
  remove: (widgetId: string) => void;
};

export function ChatSecurityCheck({ siteKey, locale, onVerified, onError }: ChatSecurityCheckProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (!scriptReady || !containerRef.current) return;
    const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
    if (!api) {
      onError();
      return;
    }
    let active = true;
    const fail = () => {
      if (active) onError();
    };
    let widgetId: string;
    try {
      widgetId = api.render(containerRef.current, {
        sitekey: siteKey,
        action: "chat",
        language: locale,
        size: "flexible",
        callback: (token) => {
          if (active) onVerified(token);
        },
        "expired-callback": fail,
        "error-callback": fail,
        "timeout-callback": fail,
      });
    } catch {
      onError();
      return;
    }
    return () => {
      active = false;
      api.remove(widgetId);
    };
  }, [locale, onError, onVerified, scriptReady, siteKey]);

  return (
    <div className="shrink-0 space-y-2 border-t p-3">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={onError}
      />
      <p className="text-xs text-muted-foreground" role="status">
        {locale === "bn" ? "আপনার বার্তা পাঠাতে নিরাপত্তা যাচাই সম্পূর্ণ করুন।" : "Complete the security check to send your message."}
      </p>
      <div ref={containerRef} />
      <button type="button" onClick={onError} className="text-xs text-muted-foreground underline">
        {locale === "bn" ? "বাতিল করুন" : "Cancel"}
      </button>
    </div>
  );
}
