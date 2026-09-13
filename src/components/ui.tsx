"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Eye, EyeOff, Camera, User } from "lucide-react";
import type { BadgeTone } from "@/lib/badge-tone";
import { humanizeError, readJsonSafe } from "@/lib/user-error";

export type { BadgeTone } from "@/lib/badge-tone";
export { riskTone, statusTone } from "@/lib/badge-tone";

/* ============================================================== Button ====
   文字の可読性を最優先。地色と文字色の組み合わせは globals.css で固定し、
   ここでは形状とアニメーション (押下時の波紋) のみを担当する。
   ========================================================================= */
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
  icon?: ReactNode;
};

const BTN_VARIANT: Record<string, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
  success: "btn-success",
};

const BTN_SIZE: Record<string, string> = {
  sm: "h-7 px-2.5 text-[12px]",
  md: "h-9 px-4 text-[13px]",
  lg: "h-11 px-6 text-[15px]",
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
  icon,
}: ButtonProps) {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const isBusy = loading || busy;

  /** クリック位置から波紋を出す */
  function ripple(e: React.MouseEvent<HTMLButtonElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const span = document.createElement("span");
    const size = Math.max(rect.width, rect.height);
    span.className = "ripple";
    span.style.width = span.style.height = `${size}px`;
    span.style.left = `${e.clientX - rect.left - size / 2}px`;
    span.style.top = `${e.clientY - rect.top - size / 2}px`;
    el.appendChild(span);
    setTimeout(() => span.remove(), 520);
  }

  return (
    <button
      ref={ref}
      type={type}
      title={title}
      disabled={disabled || isBusy}
      onClick={async (e) => {
        if (disabled || isBusy) return;
        ripple(e);
        if (!onClick) return;
        setBusy(true);
        try {
          await onClick();
        } finally {
          setBusy(false);
        }
      }}
      className={`btn ${BTN_VARIANT[variant]} ${BTN_SIZE[size]} ${className}`}
    >
      {isBusy ? (
        <span className="inline-flex items-center gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1 w-1 rounded-full bg-current"
              style={{ animation: "dot-blink 1.1s ease-in-out infinite", animationDelay: `${i * 0.14}s` }}
            />
          ))}
        </span>
      ) : (
        icon
      )}
      <span>{children}</span>
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
  return <div className={`card ui-card ${padded ? "ui-card-padded p-4 sm:p-5" : ""} ${className}`}>{children}</div>;
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
    <div className="card-header flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3 mb-4 sm:mb-5">
      <div className="flex items-start gap-2.5 min-w-0">
        {icon && (
          <span className="shrink-0 mt-0.5 h-8 w-8 rounded-lg bg-brand-50 text-brand-700 grid place-items-center">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
          {subtitle && <p className="muted text-[13px] mt-1 leading-relaxed">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0 sm:pt-0.5">{action}</div>}
    </div>
  );
}

/* =============================================================== Badge ==== */
const BADGE_TONES = {
  neutral: "bg-[var(--surface-3)] text-[var(--text-muted)] border-[var(--border-strong)]",
  brand: "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-900/40 dark:text-brand-100 dark:border-brand-700",
  good: "bg-[#e8f3ed] text-[#155c3c] border-[#a9d4c0] dark:bg-[#12331f] dark:text-[#8fd8b3] dark:border-[#2c5b41]",
  warn: "bg-[#fdf3e3] text-[#7d4a10] border-[#e6c68f] dark:bg-[#3a2b12] dark:text-[#e8bd77] dark:border-[#6b5223]",
  bad: "bg-[#fdeaed] text-[#96091f] border-[#e8a7b2] dark:bg-[#3d1119] dark:text-[#f0a1ae] dark:border-[#6e2531]",
  info: "bg-[#e9f0f8] text-[#144a80] border-[#a9c6e4] dark:bg-[#132537] dark:text-[#9cc6ee] dark:border-[#2a4b6e]",
} as const;

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
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold leading-tight whitespace-nowrap ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/* ============================================================ StatTile ==== */
export function StatTile({
  label,
  value,
  unit,
  delta,
  hint,
  accent,
  icon,
  spark,
  showComparison = false,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: number;
  hint?: string;
  accent?: string;
  icon?: ReactNode;
  spark?: number[];
  showComparison?: boolean;
}) {
  const color = accent ?? "var(--color-brand-600)";
  const series = spark && spark.length > 1 && spark.some((n) => n > 0) ? spark : null;

  return (
    <div className="stat-tile card p-4 sm:p-5 relative overflow-hidden min-h-[108px] sm:min-h-[120px]">
      <div className={`flex items-start gap-3 ${series ? "pr-[4.5rem] sm:pr-[5.5rem]" : ""}`}>
        {icon && (
          <span
            className="h-10 w-10 sm:h-11 sm:w-11 rounded-full grid place-items-center shrink-0"
            style={{ background: `color-mix(in srgb, ${color} 14%, white)`, color }}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="muted text-[12px] sm:text-[13px] font-medium leading-tight">{label}</p>
          <p
            className="mt-1.5 text-[20px] sm:text-[26px] font-bold tabular-nums tracking-tight leading-none"
            style={{ color }}
          >
            {value}
            {unit && <span className="text-[13px] font-medium muted ml-1">{unit}</span>}
          </p>
          <div className="mt-2 sm:mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 min-h-[16px]">
            {showComparison && (typeof delta !== "number" || !Number.isFinite(delta)) && (
              <span className="muted text-[12px]">前月比 <span className="text-amber-500">—</span></span>
            )}
            {typeof delta === "number" && Number.isFinite(delta) && (
              <span
                className={`text-[12px] font-semibold tabular-nums ${delta >= 0 ? "text-[#1d7a4a]" : "text-[#c8102e]"}`}
              >
                {delta >= 0 ? "前月比 +" : "前月比 "}
                {delta}%
              </span>
            )}
            {hint && <span className="muted text-[12px] leading-tight">{hint}</span>}
          </div>
        </div>
      </div>
      {series && (
        <div className="absolute right-2 sm:right-3 top-4 sm:top-5 pointer-events-none scale-75 sm:scale-100 origin-top-right" aria-hidden>
          <MiniSpark points={series} color={color} />
        </div>
      )}
    </div>
  );
}

function MiniSpark({ points, color }: { points: number[]; color: string }) {
  const max = Math.max(...points, 1);
  const w = 108;
  const h = 40;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - (p / max) * (h - 8) - 4;
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={area} fill={color} opacity="0.12" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* =============================================================== Field ====
   日本のフォームの慣習に合わせ、ラベル右に「必須 / 任意」のバッジを出す。
   ========================================================================= */
export function Field({
  label,
  hint,
  children,
  required,
  optional,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-[13px] font-semibold">
        {label}
        {required && <span className="badge-required">必須</span>}
        {optional && <span className="badge-optional">任意</span>}
      </span>
      {hint && <span className="muted text-[11.5px] block mt-1 leading-relaxed">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`field-input ${className}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return <textarea {...rest} className={`field-input min-h-[92px] resize-y ${className}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", children, ...rest } = props;
  return (
    <select {...rest} className={`field-input cursor-pointer pr-8 ${className}`}>
      {children}
    </select>
  );
}

/** 目のアイコンで表示・非表示を切り替えられるパスワード欄 */
export function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete = "current-password",
  id,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  id?: string;
  invalid?: boolean;
}) {
  const [shown, setShown] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={shown ? "text" : "password"}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`field-input pr-11 ${invalid ? "border-[#c8102e]" : ""}`}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "パスワードを隠す" : "パスワードを表示"}
        aria-pressed={shown}
        title={shown ? "パスワードを隠す" : "パスワードを表示"}
        className="absolute right-0 top-0 h-full px-3 flex items-center muted hover:text-[var(--text)] transition-colors"
      >
        {shown ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
      </button>
    </div>
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
      className="flex items-start gap-2.5 w-full text-left"
    >
      <span
        className={`mt-0.5 relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-150
          ${checked ? "bg-brand-600 border-brand-700" : "bg-[var(--surface-3)] border-[var(--border-strong)]"}`}
      >
        <span
          className={`absolute top-[2px] h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-150
            ${checked ? "translate-x-[19px]" : "translate-x-[2px]"}`}
        />
      </span>
      <span className="min-w-0">
        <span className="text-[13px] font-medium block leading-snug">{label}</span>
        {hint && <span className="muted text-[11.5px] block mt-0.5 leading-relaxed">{hint}</span>}
      </span>
    </button>
  );
}

/* ============================================================== Avatar ==== */
export function Avatar({
  src,
  name,
  size = 32,
  className = "",
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const initial = (name ?? "").trim().slice(0, 1) || null;

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-3)] ${className}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name ? `${name}のアバター` : "アバター"} className="h-full w-full object-cover" />
      ) : initial ? (
        <span
          className="font-bold text-brand-700 dark:text-brand-100 leading-none"
          style={{ fontSize: Math.round(size * 0.42) }}
        >
          {initial}
        </span>
      ) : (
        <span className="muted">
          <User size={Math.round(size * 0.58)} strokeWidth={1.75} />
        </span>
      )}
    </span>
  );
}

/**
 * アバターの選択とアップロード。
 * onSelect には「選んだ画像」を渡す。実際の保存先は呼び出し側が決める。
 */
export function AvatarPicker({
  value,
  name,
  onSelect,
  size = 84,
  disabled,
}: {
  value?: string | null;
  name?: string | null;
  onSelect: (file: File | null, previewUrl: string | null) => void;
  size?: number;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function pick(file: File | null) {
    setError(null);
    if (!file) {
      onSelect(null, null);
      return;
    }
    if (!/^image\/(png|jpe?g|jpg|webp|gif)$/i.test(file.type) && file.type !== "") {
      const extOk = /\.(png|jpe?g|webp|gif)$/i.test(file.name);
      if (!extOk) {
        setError("PNG / JPEG / WebP / GIF の画像を選んでください。");
        return;
      }
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("ファイルサイズは5MBまでです。");
      return;
    }
    onSelect(file, URL.createObjectURL(file));
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <span className="relative" style={{ width: size, height: size }}>
          <Avatar src={value} name={name} size={size} />
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            aria-label="アバター画像を選択"
            className="absolute -right-1.5 -bottom-1.5 h-7 w-7 rounded-lg bg-brand-600 text-white border border-brand-700
              grid place-items-center hover:bg-brand-500 transition-colors disabled:opacity-50"
          >
            <Camera size={14} strokeWidth={1.75} />
          </button>
        </span>

        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={disabled}>
              画像を選択
            </Button>
            {value && (
              <Button size="sm" variant="ghost" onClick={() => pick(null)} disabled={disabled}>
                削除
              </Button>
            )}
          </div>
          <p className="muted text-[11.5px] mt-1.5 leading-relaxed">
            PNG / JPEG / WebP・5MBまで。正方形の画像を推奨します。
          </p>
          {error && <p className="text-[11.5px] text-[#c8102e] mt-1">{error}</p>}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

/* ================================================================ Tabs ==== */
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ key: string; label: string; count?: number; icon?: ReactNode }>;
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex overflow-x-auto scroll-thin border-b border-[var(--border-strong)]">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`relative inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap
              border-t border-x -mb-px transition-colors
              ${
                on
                  ? "bg-[var(--surface)] border-[var(--border-strong)] border-b-[var(--surface)] text-brand-700 dark:text-brand-100"
                  : "bg-[var(--surface-3)] border-transparent muted hover:text-[var(--text)]"
              }`}
          >
            {t.icon}
            {t.label}
            {typeof t.count === "number" && (
              <span className="text-[11px] tabular-nums opacity-75">({t.count})</span>
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/50"
      onMouseDown={(e) => e.target === ref.current && onClose()}
      ref={ref}
    >
      <div
        className={`card w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[88vh] overflow-y-auto scroll-thin
          animate-[rise_0.2s_cubic-bezier(0.22,1,0.36,1)] rounded-t-2xl sm:rounded-xl`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-5 py-3.5 bg-[var(--surface)] border-b border-[var(--border)]">
          <h2 className="font-semibold text-[15px]">{title}</h2>
          <button
            onClick={onClose}
            className="muted hover:text-[var(--text)] p-1 rounded-lg hover:bg-[var(--surface-3)] transition-colors"
            aria-label="閉じる"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
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
  className = "",
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`empty-state text-center py-10 px-4 sm:px-6 rounded-xl ${className || "bg-[var(--surface-2)]"}`}>
      {icon && <div className="mx-auto mb-2.5 muted w-fit">{icon}</div>}
      <p className="font-semibold text-[13px]">{title}</p>
      {body && <p className="muted text-[12px] mt-1.5 max-w-md mx-auto leading-relaxed">{body}</p>}
      {action && <div className="mt-3.5">{action}</div>}
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
    <div
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none"
      role="status"
      aria-live="polite"
    >
      {items.map((i) => (
        <div
          key={i.id}
          className={`animate-[rise_0.2s_cubic-bezier(0.22,1,0.36,1)] px-4 py-2.5 rounded-lg text-[13px] font-medium
            shadow-lg max-w-[90vw] text-white border-l-4
            ${i.tone === "ok" ? "bg-ink-800 border-l-[#1d6f4a]" : "bg-ink-800 border-l-[#c8102e]"}`}
        >
          {i.text}
        </div>
      ))}
    </div>
  );
}

/* ============================================================== helpers === */
export async function callApi<T = unknown>(
  path: string,
  body: Record<string, unknown> | FormData,
): Promise<T | null> {
  try {
    const isForm = typeof FormData !== "undefined" && body instanceof FormData;
    const res = await fetch(path, {
      method: "POST",
      headers: isForm ? undefined : { "Content-Type": "application/json" },
      body: isForm ? body : JSON.stringify(body),
    });
    const parsed = await readJsonSafe<{ ok?: boolean; error?: string; data?: T }>(res);
    if (!parsed.ok) {
      toast(parsed.error, "err");
      return null;
    }
    const json = parsed.data;
    if (!res.ok || !json.ok) {
      toast(humanizeError(json.error ?? "処理に失敗しました"), "err");
      return null;
    }
    return json.data as T;
  } catch (err) {
    toast(humanizeError(err), "err");
    return null;
  }
}

export function ProgressBar({
  value,
  max = 100,
  color,
  height = 8,
}: {
  value: number;
  max?: number;
  color?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className="w-full overflow-hidden bg-[var(--surface-3)] border border-[var(--border)] rounded-md"
      style={{ height }}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={max}
    >
      <div
        className="h-full transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%`, background: color ?? "var(--color-brand-600)" }}
      />
    </div>
  );
}

/** パンくず (日本のサイトの定番) */
export function Breadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav className="breadcrumb mb-3" aria-label="パンくず">
      {items.map((it, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-1.5 opacity-60">›</span>}
          {it.href ? <a href={it.href}>{it.label}</a> : <span className="text-[var(--text)]">{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}
