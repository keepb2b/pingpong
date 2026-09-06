"use client";

import { useState } from "react";
import Link from "next/link";
import { SUBJECT_TYPE_LABEL } from "@/lib/constants";

type Subject = { id: string; name: string; type: string; is_primary: boolean };

/**
 * 広報対象の切り替え。
 * 対象は「企業・サービス・商品・ブランド・店舗・個人」を追加できる。
 */
export function SubjectSwitcher({
  subjects,
  activeId,
}: {
  subjects: Subject[];
  activeId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const active = subjects.find((s) => s.id === activeId) ?? subjects[0];

  if (!active) {
    return (
      <Link
        href="/dashboard/settings"
        className="block px-3 py-2 rounded-[4px] border border-dashed border-[var(--border)] text-xs muted hover:text-[var(--text)] text-center"
      >
        広報対象を登録する
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-[4px] border border-[var(--border)] hover:bg-[var(--surface-3)] transition-colors text-left"
      >
        <span className="h-6 w-6 shrink-0 rounded-[3px] bg-brand-600 text-white text-[11px] font-bold grid place-items-center">
          {active.name.slice(0, 1)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium truncate">{active.name}</span>
          <span className="block text-[10px] muted">
            {SUBJECT_TYPE_LABEL[active.type] ?? active.type}
          </span>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="muted shrink-0">
          <path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 card z-50 overflow-hidden animate-[rise_0.16s_ease-out]">
            {subjects.map((s) => (
              <Link
                key={s.id}
                href={`/dashboard?subject=${s.id}`}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-[var(--surface-3)] ${
                  s.id === active.id ? "bg-brand-50 dark:bg-brand-900/25" : ""
                }`}
              >
                <span className="h-5 w-5 shrink-0 rounded-[3px] bg-[var(--surface-3)] text-[10px] font-bold grid place-items-center">
                  {s.name.slice(0, 1)}
                </span>
                <span className="truncate">{s.name}</span>
                {s.is_primary && <span className="ml-auto text-[10px] muted">主</span>}
              </Link>
            ))}
            <Link
              href="/dashboard/settings#subjects"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-[13px] text-brand-600 hover:bg-[var(--surface-3)] border-t border-[var(--border)]"
            >
              + 広報対象を追加
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
