"use client";

import Script from "next/script";
import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type CredentialResponse = { credential?: string };

type GoogleAccounts = {
  id: {
    initialize(config: {
      client_id: string;
      callback: (response: CredentialResponse) => void;
      nonce: string;
      use_fedcm_for_prompt?: boolean;
    }): void;
    renderButton(
      parent: HTMLElement,
      options: {
        type: "standard";
        theme: "outline";
        size: "large";
        text: "continue_with";
        shape: "rectangular";
        width: number;
        locale: string;
      },
    ): void;
  };
};

declare global {
  interface Window {
    google?: { accounts: GoogleAccounts };
  }
}

function randomNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

type Props = {
  clientId: string;
  locale: string;
  next: string;
  errorMessage: string;
};

export function GoogleSignIn({ clientId, locale, next, errorMessage }: Props) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const rawNonce = useRef("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleCredential = useCallback(async (response: CredentialResponse) => {
    if (!response.credential || !rawNonce.current) {
      setError(errorMessage);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: response.credential,
        nonce: rawNonce.current,
      });
      if (signInError) throw signInError;

      const destination = new URL("/auth/complete", window.location.origin);
      destination.searchParams.set("next", next);
      window.location.assign(destination.toString());
    } catch {
      setBusy(false);
      setError(errorMessage);
    }
  }, [errorMessage, next]);

  const initializeGoogle = useCallback(async () => {
    if (initialized.current || !buttonRef.current || !window.google) return;

    try {
      const nonce = randomNonce();
      rawNonce.current = nonce;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
        nonce: await sha256Hex(nonce),
        use_fedcm_for_prompt: true,
      });
      buttonRef.current.replaceChildren();
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: Math.min(360, Math.max(200, buttonRef.current.clientWidth)),
        locale,
      });
      initialized.current = true;
    } catch {
      setError(errorMessage);
    }
  }, [clientId, errorMessage, handleCredential, locale]);

  return (
    <div className="google-sign-in">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => void initializeGoogle()}
        onError={() => setError(errorMessage)}
      />
      <div
        ref={buttonRef}
        className={busy ? "google-sign-in-button google-sign-in-busy" : "google-sign-in-button"}
        aria-busy={busy}
      />
      {error ? <p className="auth-message auth-error" role="alert">{error}</p> : null}
    </div>
  );
}
