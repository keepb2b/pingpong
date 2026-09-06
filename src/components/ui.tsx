"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/* ============================================================== Button ==== */
type ButtonProps = {
  children: ReactNode;
  onClick?: () => void | Promise<void>;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
  className?: string;
  title?: string;
};

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  type = "button",
  className = "",
  title,
}: ButtonProps) {
  const [busy, setBusy] = useState(false);
  const isBusy = loading || busy;

  const variants: Record<string, string> = {
    primary:
      "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm shadow-brand-600/20",
    secondary:
      "bg-[var(--surface-3)] text-[var(--text)] hover:bg-[var(--surface-2)] border border-[var(--border)]",
    ghost: "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-3)]",
    danger: "bg-red-600 text-white hover:bg-red-700",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
  };
  const sizes: Record<string, string> = {
    sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
    md: "h-10 px-4 text-sm rounded-xl gap-2",
    lg: "h-12 px-6 text-base rounded-xl gap-2",
  };

  return (
    <button
      type={type}
      title={title}
      disabled={disabled || isBusy}
      onClick={async () => {
        if (!onClick) return;
        setBusy(true);
        try {
          await onClick();
        } finally {
          setBusy(false);
        }
      }}
      className={`inline-flex items-center justify-center font-medium transition-all duration-150
        disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]
        ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {isBusy && (
        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  );
}

/* ================================================================ Card ==== */
export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div className={`card ${padded ? "p-5" : ""} ${className}`}>{children}</div>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-start gap-3 min-w-0">
        {icon}
        <div className="min-w-0">
          <h3 className="font-semibold text-[15px] leading-tight">{title}</h3>
          {subtitle && <p className="muted text-xs mt-1 leading-relaxed">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* =============================================================== Badge ==== */
const BADGE_TONES = {
  neutral: "bg-[var(--surface-3)] text-[var(--text-muted)]",
  brand: "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200",
  good: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  warn: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  bad: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  info: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function riskTone(risk: string): BadgeTone {
  return risk === "critical" || risk === "high"
    ? "bad"
    : risk === "medium"
      ? "warn"
      : risk === "low"
        ? "info"
        : "good";
}

export function statusTone(status: string): BadgeTone {
  if (["published", "approved"].includes(status)) return "good";
  if (["pending_approval", "fact_check", "scheduled", "proposed"].includes(status)) return "warn";
  if (["rejected", "failed"].includes(status)) return "bad";
  return "neutral";
}

/* ============================================================ StatTile ==== */
export function StatTile({
  label,
  value,
  unit,
  delta,
  hint,
  accent,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: number;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="card p-4 relative overflow-hidden">
      {accent && (
        <span
          className="absolute left-0 top-0 h-full w-[3px]"
          style={{ background: accent }}
          aria-hidden
        />
      )}
      <p className="muted text-xs font-medium">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">
        {value}
        {unit && <span className="text-sm font-medium muted ml-1">{unit}</span>}
      </p>
      <div className="mt-1 flex items-center gap-2">
        {typeof delta === "number" && (
          <span
            className={`text-xs font-medium tabular-nums ${delta >= 0 ? "text-emerald-600" : "text-red-600"}`}
          >
            {delta >= 0 ? "+" : ""}
            {delta}%
          </span>
        )}
        {hint && <span className="muted text-[11px]">{hint}</span>}
      </div>
    </div>
  );
}

/* =============================================================== Field ==== */
export function Field({
  label,
  hint,
  children,
  required,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium flex items-center gap-1.5">
        {label}
        {required && <span className="text-red-500">*</span>}
      </span>
      {hint && <span className="muted text-[11px] block mt-0.5 leading-relaxed">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const INPUT_CLASS =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none transition-shadow placeholder:text-[var(--text-muted)] focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT_CLASS} ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${INPUT_CLASS} min-h-[96px] resize-y leading-relaxed ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${INPUT_CLASS} cursor-pointer ${props.className ?? ""}`}>
      {props.children}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-start gap-3 w-full text-left group"
    >
      <span
        className={`mt-0.5 relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200
          ${checked ? "bg-brand-600" : "bg-[var(--surface-3)] border border-[var(--border)]"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200
            ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`}
        />
      </span>
      <span className="min-w-0">
        <span className="text-sm font-medium block">{label}</span>
        {hint && <span className="muted text-xs block mt-0.5 leading-relaxed">{hint}</span>}
      </span>
    </button>
  );
}

/* ================================================================ Tabs ==== */
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ key: string; label: string; count?: number }>;
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto scroll-thin border-b border-[var(--border)] -mb-px">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`relative px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors
              ${on ? "text-brand-600" : "muted hover:text-[var(--text)]"}`}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span className="ml-1.5 text-[11px] tabular-nums opacity-70">{t.count}</span>
            )}
            {on && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* =============================================================== Modal ==== */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/45 backdrop-blur-sm"
      onMouseDown={(e) => e.target === ref.current && onClose()}
      ref={ref}
    >
      <div
        className={`card w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[88vh] overflow-y-auto scroll-thin
          animate-[rise_0.22s_cubic-bezier(0.22,1,0.36,1)] rounded-b-none sm:rounded-2xl`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-5 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="muted hover:text-[var(--text)] p-1" aria-label="閉じる">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ========================================================== EmptyState ==== */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-12 px-6">
      {icon && <div className="mx-auto mb-3 opacity-40 w-fit">{icon}</div>}
      <p className="font-medium text-sm">{title}</p>
      {body && <p className="muted text-xs mt-1.5 max-w-sm mx-auto leading-relaxed">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* =============================================================== Toast ==== */
type ToastItem = { id: number; text: string; tone: "ok" | "err" };
let pushToast: ((t: Omit<ToastItem, "id">) => void) | null = null;

export function toast(text: string, tone: "ok" | "err" = "ok") {
  pushToast?.({ text, tone });
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    pushToast = (t) => {
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev, { ...t, id }]);
      setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 4200);
    };
    return () => {
      pushToast = null;
    };
  }, []);

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none">
      {items.map((i) => (
        <div
          key={i.id}
          className={`animate-[rise_0.24s_cubic-bezier(0.22,1,0.36,1)] px-4 py-2.5 rounded-xl text-sm shadow-lg
            max-w-[90vw] text-white ${i.tone === "ok" ? "bg-ink-800" : "bg-red-600"}`}
        >
          {i.text}
        </div>
      ))}
    </div>
  );
}

/* ============================================================== helpers === */
/** APIを呼び、エラーをトーストで通知する共通ラッパー。 */
export async function callApi<T = unknown>(
  path: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      toast(json.error ?? "処理に失敗しました", "err");
      return null;
    }
    return json.data as T;
  } catch (err) {
    toast(err instanceof Error ? err.message : "通信に失敗しました", "err");
    return null;
  }
}

export function ProgressBar({
  value,
  max = 100,
  color,
  height = 6,
}: {
  value: number;
  max?: number;
  color?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className="w-full rounded-full overflow-hidden bg-[var(--surface-3)]"
      style={{ height }}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={max}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${pct}%`, background: color ?? "var(--color-brand-500)" }}
      />
    </div>
  );
}
