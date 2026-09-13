"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PublicShell } from "@/components/dashboard/PublicShell";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app]", error.message, error.digest);
  }, [error]);

  return (
    <PublicShell><main className="min-h-dvh flex items-center justify-center px-5 bg-[var(--surface-2)]">
      <div className="card max-w-md w-full p-6 sm:p-8 text-center">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink-900">
          サーバーでエラーが発生しました
        </h1>
        <p className="muted text-sm mt-2 leading-relaxed">
          広報活動の処理が終わった直後に画面を再読み込みすると、一時的に表示できないことがあります。
        </p>
        {error.digest && (
          <p className="muted text-[11px] mt-3 tabular-nums">Digest: {error.digest}</p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn btn-primary h-9 px-4 text-[13px]" onClick={() => reset()}>
            再読み込み
          </button>
          <Link href="/" className="btn btn-secondary h-9 px-4 text-[13px]">
            トップへ
          </Link>
        </div>
      </div>
    </main></PublicShell>
  );
}
