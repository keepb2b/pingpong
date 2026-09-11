"use client";

import { useEffect } from "react";
import Link from "next/link";

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
    <main className="min-h-dvh flex items-center justify-center px-5">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-bold">サーバーでエラーが発生しました</h1>
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
    </main>
  );
}
