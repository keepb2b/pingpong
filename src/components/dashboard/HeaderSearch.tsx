"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

export function HeaderSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      className="relative flex-1 max-w-xl"
      onSubmit={(e) => {
        e.preventDefault();
        const next = q.trim();
        router.push(next ? `/dashboard/content?q=${encodeURIComponent(next)}` : "/dashboard/content");
      }}
    >
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
        size={16}
        strokeWidth={1.75}
        aria-hidden
      />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="キーワードで検索（投稿・分析・資料など）"
        className="field-input h-10 pl-9 pr-3 text-[13px] bg-[var(--surface-2)] border-[var(--border)]"
        aria-label="コンテンツを検索"
      />
    </form>
  );
}
