"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard]", error.message, error.digest);
  }, [error]);

  return (
    <div className="max-w-lg mx-auto py-16 px-4">
      <div className="card p-6 sm:p-8 text-center">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink-900">
          画面の読み込みに失敗しました
        </h1>
        <p className="muted text-sm mt-2 leading-relaxed">
          今日の広報活動の処理自体は完了している場合があります。再読み込みするか、ホームからやり直してください。
        </p>
        {error.digest && (
          <p className="muted text-[11px] mt-3 tabular-nums">Digest: {error.digest}</p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn btn-primary h-9 px-4 text-[13px]" onClick={() => reset()}>
            再読み込み
          </button>
          <Link href="/dashboard" className="btn btn-secondary h-9 px-4 text-[13px]">
            ホームへ
          </Link>
        </div>
      </div>
    </div>
  );
}
