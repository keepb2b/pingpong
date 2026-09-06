"use client";

import { createBrowserClient } from "@supabase/ssr";

let cached: ReturnType<typeof createBrowserClient> | null = null;

export function supabaseBrowser() {
  if (!cached) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      // NEXT_PUBLIC_* はビルド時に埋め込まれるため、デプロイ先で未設定だと
      // ここが undefined になる。原因が分かるメッセージを出す。
      throw new Error(
        "Supabaseの環境変数が未設定です (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)。" +
          "Vercel の Environment Variables に追加し、再デプロイしてください。",
      );
    }
    cached = createBrowserClient(url, anonKey);
  }
  return cached;
}
