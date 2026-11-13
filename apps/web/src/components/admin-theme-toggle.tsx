"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";

function subscribeTheme(callback: () => void) {
  window.addEventListener("storage", callback);
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  mql.addEventListener("change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    mql.removeEventListener("change", callback);
  };
}

function getThemeSnapshot(): "light" | "dark" {
  try {
    const saved = localStorage.getItem("rc_admin_theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

function getServerSnapshot(): "light" | "dark" {
  return "light";
}

export function AdminThemeToggle({
  variant = "default",
  labelLight = "Light mode",
  labelDark = "Dark mode",
  toggleLabel = "Toggle theme",
}: {
  variant?: "default" | "compact";
  labelLight?: string;
  labelDark?: string;
  toggleLabel?: string;
}) {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerSnapshot);

  useEffect(() => {
    const shell = document.getElementById("admin-shell");
    if (shell) {
      shell.setAttribute("data-theme", theme);
    }
  }, [theme]);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("rc_admin_theme", next);
    } catch {
      // storage unavailable
    }
    const shell = document.getElementById("admin-shell");
    if (shell) {
      shell.setAttribute("data-theme", next);
    }
    window.dispatchEvent(new Event("storage"));
  };

  const isDark = theme === "dark";
  const currentLabel = isDark ? labelDark : labelLight;

  return (
    <button
      type="button"
      onClick={toggle}
      className={`admin-theme-toggle admin-theme-toggle--${variant} ${isDark ? "is-dark" : "is-light"}`}
      aria-label={toggleLabel}
      title={`${toggleLabel} (${currentLabel})`}
    >
      <span className="admin-theme-toggle-icon" aria-hidden="true">
        {isDark ? <Moon size={15} strokeWidth={2} /> : <Sun size={15} strokeWidth={2} />}
      </span>
      {variant === "default" && (
        <span className="admin-theme-toggle-label">{currentLabel}</span>
      )}
      {variant === "default" && (
        <span className="admin-theme-toggle-switch" aria-hidden="true">
          <span className="admin-theme-toggle-knob" />
        </span>
      )}
    </button>
  );
}
