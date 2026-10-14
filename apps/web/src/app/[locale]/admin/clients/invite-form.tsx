"use client";

import { useActionState, useState } from "react";
import { createClientInvite, type InviteActionState } from "./actions";

const initialState: InviteActionState = { status: "idle" };

type Labels = {
  create: string;
  creating: string;
  copy: string;
  copied: string;
  copyFailed: string;
  oneTimeHint: string;
  expires: string;
  errors: Record<NonNullable<InviteActionState["error"]>, string>;
};

export function InviteForm({
  locale,
  clientId,
  email,
  labels,
}: {
  locale: string;
  clientId: string;
  email: string;
  labels: Labels;
}) {
  const [state, action, pending] = useActionState(createClientInvite, initialState);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copyLink() {
    if (!state.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(state.inviteUrl);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  return (
    <div className="client-invite-create">
      <form action={action}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="email" value={email} />
        <button className="content-primary-button" type="submit" disabled={pending}>
          {pending ? labels.creating : labels.create}
        </button>
      </form>

      {state.status === "error" && state.error ? (
        <p className="content-message content-message-error" role="alert">
          {labels.errors[state.error]}
        </p>
      ) : null}

      {state.status === "success" && state.inviteUrl ? (
        <div className="client-invite-result" role="status">
          <strong>{labels.oneTimeHint}</strong>
          <div>
            <input aria-label={labels.oneTimeHint} readOnly value={state.inviteUrl} />
            <button className="content-secondary-button" type="button" onClick={copyLink}>
              {copyStatus === "copied" ? labels.copied : labels.copy}
            </button>
          </div>
          {copyStatus === "failed" ? <small role="alert">{labels.copyFailed}</small> : null}
          {state.expiresAt ? (
            <small>{labels.expires.replace("{date}", new Date(state.expiresAt).toLocaleString(locale))}</small>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
