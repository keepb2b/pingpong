"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** LINEなど別画面で承認したあと、ダッシュボードに戻ったときに件数を取り直す。 */
export function RefreshOnFocus() {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => router.refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [router]);

  return null;
}
