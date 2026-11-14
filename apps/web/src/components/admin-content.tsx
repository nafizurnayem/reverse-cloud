import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

function inputValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? value : "";
}

export function ContentHeader({ eyebrow, title, description, backLabel, backHref = "/admin/content" }: {
  eyebrow?: string; title: string; description?: string; backLabel?: string; backHref?: string;
}) {
  return (
    <header className="content-header">
      <div>
        {eyebrow ? <p className="admin-kicker">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {backLabel ? <Link className="content-secondary-button content-dashboard-btn" href={backHref}>{backLabel}</Link> : null}
    </header>
  );
}

export function ActionMessage({ saved, error }: { saved: string | null; error: string | null }) {
  if (!saved && !error) return null;
  return <p className={`content-message ${error ? "content-message-error" : "content-message-success"}`} role={error ? "alert" : "status"}>{error ?? saved}</p>;
}

export function EditorPanel({
  title,
  children,
  defaultOpen = false,
  description,
  badge,
  className = "",
  openLabel = "Open form",
  closeLabel = "Close form",
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  description?: ReactNode;
  badge?: ReactNode;
  className?: string;
  openLabel?: string;
  closeLabel?: string;
}) {
  return (
    <details
      className={`content-editor content-editor-collapsible ${className}`.trim()}
      open={defaultOpen ? true : undefined}
    >
      <summary className="content-editor-summary">
        <div className="content-editor-summary-left">
          <span className="content-editor-icon-badge" aria-hidden="true">
            <span className="content-editor-icon-symbol" />
          </span>
          <div className="content-editor-title-wrap">
            <h2>{title}</h2>
            {description ? <p className="content-editor-desc">{description}</p> : null}
          </div>
          {badge ? <span className="content-editor-badge">{badge}</span> : null}
        </div>
        <div className="content-editor-summary-right">
          <span className="content-editor-toggle-btn">
            <span className="content-editor-label-closed">{openLabel}</span>
            <span className="content-editor-label-open">{closeLabel}</span>
            <svg
              className="content-editor-chevron"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
      </summary>
      <div className="content-editor-body">
        {children}
      </div>
    </details>
  );
}

export function Field({ label, name, defaultValue, type = "text", required = false, min, step, maxLength, placeholder, readOnly = false }: {
  label: string; name: string; defaultValue?: unknown; type?: string; required?: boolean;
  min?: string | number; step?: string | number; maxLength?: number; placeholder?: string; readOnly?: boolean;
}) {
  const val = inputValue(defaultValue);
  const valueProps = type === "file" ? {} : { defaultValue: val, key: String(val) };
  return <label className="content-field"><span>{label}</span><input name={name} type={type} {...valueProps} required={required} min={min} step={step} maxLength={maxLength} placeholder={placeholder} readOnly={readOnly} /></label>;
}

export function TextareaField({ label, name, defaultValue, required = false, rows = 4, placeholder, maxLength }: {
  label: string; name: string; defaultValue?: unknown; required?: boolean; rows?: number; placeholder?: string; maxLength?: number;
}) {
  const val = inputValue(defaultValue);
  return <label className="content-field content-field-wide"><span>{label}</span><textarea key={String(val)} name={name} defaultValue={val} required={required} rows={rows} placeholder={placeholder} maxLength={maxLength} /></label>;
}

export function SelectField({ label, name, defaultValue, children }: {
  label: string; name: string; defaultValue?: unknown; children: ReactNode;
}) {
  const val = inputValue(defaultValue);
  return <label className="content-field"><span>{label}</span><select key={String(val)} name={name} defaultValue={val}>{children}</select></label>;
}

export function CheckboxField({ label, name, defaultChecked = false, hint }: {
  label: string; name: string; defaultChecked?: boolean; hint?: string;
}) {
  return <label className="content-checkbox"><input name={name} type="checkbox" defaultChecked={defaultChecked} /><span><strong>{label}</strong>{hint ? <small>{hint}</small> : null}</span></label>;
}

export function FormActions({ saveLabel, cancelLabel, cancelHref }: { saveLabel: string; cancelLabel: string; cancelHref: string }) {
  return <div className="content-form-actions"><button className="content-primary-button" type="submit">{saveLabel}</button><Link className="content-secondary-button" href={cancelHref}>{cancelLabel}</Link></div>;
}

export function StatusBadge({ active, activeLabel, inactiveLabel, warning = false, danger = false }: {
  active: boolean; activeLabel: string; inactiveLabel: string; warning?: boolean; danger?: boolean;
}) {
  const variant = danger
    ? "content-status-danger"
    : warning
      ? "content-status-warning"
      : active
        ? "content-status-active"
        : "";
  return <span className={`content-status ${variant}`.trim()}>{active ? activeLabel : inactiveLabel}</span>;
}
