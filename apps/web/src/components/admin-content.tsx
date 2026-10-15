import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

function inputValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? value : "";
}

export function ContentHeader({ eyebrow, title, description, backLabel, backHref = "/admin/content" }: {
  eyebrow: string; title: string; description: string; backLabel?: string; backHref?: string;
}) {
  return (
    <header className="content-header">
      <div>
        <p className="admin-kicker">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {backLabel ? <Link className="content-secondary-button" href={backHref}>{backLabel}</Link> : null}
    </header>
  );
}

export function ActionMessage({ saved, error }: { saved: string | null; error: string | null }) {
  if (!saved && !error) return null;
  return <p className={`content-message ${error ? "content-message-error" : "content-message-success"}`} role={error ? "alert" : "status"}>{error ?? saved}</p>;
}

export function EditorPanel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="content-editor"><h2>{title}</h2>{children}</section>;
}

export function Field({ label, name, defaultValue, type = "text", required = false, min, step, maxLength, placeholder, readOnly = false }: {
  label: string; name: string; defaultValue?: unknown; type?: string; required?: boolean;
  min?: string | number; step?: string | number; maxLength?: number; placeholder?: string; readOnly?: boolean;
}) {
  const valueProps = type === "file" ? {} : { defaultValue: inputValue(defaultValue) };
  return <label className="content-field"><span>{label}</span><input name={name} type={type} {...valueProps} required={required} min={min} step={step} maxLength={maxLength} placeholder={placeholder} readOnly={readOnly} /></label>;
}

export function TextareaField({ label, name, defaultValue, required = false, rows = 4, placeholder, maxLength }: {
  label: string; name: string; defaultValue?: unknown; required?: boolean; rows?: number; placeholder?: string; maxLength?: number;
}) {
  return <label className="content-field content-field-wide"><span>{label}</span><textarea name={name} defaultValue={inputValue(defaultValue)} required={required} rows={rows} placeholder={placeholder} maxLength={maxLength} /></label>;
}

export function SelectField({ label, name, defaultValue, children }: {
  label: string; name: string; defaultValue?: unknown; children: ReactNode;
}) {
  return <label className="content-field"><span>{label}</span><select name={name} defaultValue={inputValue(defaultValue)}>{children}</select></label>;
}

export function CheckboxField({ label, name, defaultChecked = false, hint }: {
  label: string; name: string; defaultChecked?: boolean; hint?: string;
}) {
  return <label className="content-checkbox"><input name={name} type="checkbox" defaultChecked={defaultChecked} /><span><strong>{label}</strong>{hint ? <small>{hint}</small> : null}</span></label>;
}

export function FormActions({ saveLabel, cancelLabel, cancelHref }: { saveLabel: string; cancelLabel: string; cancelHref: string }) {
  return <div className="content-form-actions"><button className="content-primary-button" type="submit">{saveLabel}</button><Link className="content-secondary-button" href={cancelHref}>{cancelLabel}</Link></div>;
}

export function StatusBadge({ active, activeLabel, inactiveLabel, warning = false }: {
  active: boolean; activeLabel: string; inactiveLabel: string; warning?: boolean;
}) {
  return <span className={`content-status ${active ? (warning ? "content-status-warning" : "content-status-active") : ""}`}>{active ? activeLabel : inactiveLabel}</span>;
}
