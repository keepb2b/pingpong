"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/components/ui";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  kind: string;
  created_at: string;
  read_at: string | null;
};

const KIND_COLOR: Record<string, string> = {
  approval: "var(--color-secretary)",
  risk: "var(--color-bad)",
  crisis: "var(--color-bad)",
  report: "var(--color-analyst)",
  signal: "var(--color-strategist)",
  billing: "var(--color-marketer)",
  error: "var(--color-bad)",
  info: "var(--color-ink-400)",
};

export function NotificationBell({ notifications }: { notifications: Notification[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const unread = notifications.filter((n) => !n.read_at).length;

  async function markAll() {
    await callApi("/api/workflow", { action: "read_all_notifications" });
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 muted hover:text-[var(--text)] rounded-[3px] hover:bg-[var(--surface-3)]"
        aria-label={`通知 ${unread}件`}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
          <path
            d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M10 18.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[var(--surface)]">
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-[22rem] max-w-[calc(100vw-2rem)] card z-50 overflow-hidden animate-[rise_0.18s_ease-out]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <span className="text-sm font-semibold">通知</span>
              {unread > 0 && (
                <button onClick={markAll} className="text-[11px] text-brand-600 hover:underline">
                  すべて既読
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto scroll-thin">
              {notifications.length === 0 ? (
                <p className="muted text-xs text-center py-10">通知はありません</p>
              ) : (
                notifications.map((n) => {
                  const inner = (
                    <div
                      className={`px-4 py-3 border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-3)] transition-colors ${
                        n.read_at ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ background: KIND_COLOR[n.kind] ?? KIND_COLOR.info }}
                        />
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium leading-snug">{n.title}</p>
                          {n.body && (
                            <p className="muted text-[11px] mt-0.5 leading-relaxed line-clamp-3 whitespace-pre-wrap">
                              {n.body}
                            </p>
                          )}
                          <p className="muted text-[10px] mt-1 tabular-nums">
                            {new Date(n.created_at).toLocaleString("ja-JP", {
                              month: "numeric",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );

                  return n.link ? (
                    <Link key={n.id} href={toRelative(n.link)} onClick={() => setOpen(false)}>
                      {inner}
                    </Link>
                  ) : (
                    <div key={n.id}>{inner}</div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** 通知に保存された絶対URLを、アプリ内リンクへ戻す。 */
function toRelative(link: string): string {
  try {
    return new URL(link).pathname;
  } catch {
    return link.startsWith("/") ? link : `/${link}`;
  }
}
