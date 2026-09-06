"use client";

import { supabaseBrowser } from "@/lib/supabase/client";

const BUCKET = "avatars";

function extensionOf(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^(png|jpe?g|webp|gif)$/.test(fromName)) return fromName;
  if (file.type.includes("png")) return "png";
  if (file.type.includes("webp")) return "webp";
  if (file.type.includes("gif")) return "gif";
  return "jpg";
}

/**
 * アバター画像をSupabase Storageへ保存し、公開URLを返す。
 * userId があれば `<userId>/` 配下に、無ければ登録前の一時領域 `pending/` に置く。
 */
export async function uploadAvatar(file: File, userId?: string | null): Promise<string> {
  const sb = supabaseBrowser();
  const folder = userId ?? "pending";
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionOf(file)}`;

  const { error } = await sb.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
    cacheControl: "3600",
  });

  if (error) {
    throw new Error(
      error.message.includes("Bucket not found")
        ? "アバター用のストレージ(avatars)が未作成です。supabase/schema.sql を適用してください。"
        : `画像のアップロードに失敗しました: ${error.message}`,
    );
  }

  const {
    data: { publicUrl },
  } = sb.storage.from(BUCKET).getPublicUrl(path);

  return publicUrl;
}

const PENDING_KEY = "aikoho_pending_avatar";

/** メール確認待ちの間、アップロード済みURLを控えておく */
export function rememberPendingAvatar(url: string) {
  try {
    window.localStorage.setItem(PENDING_KEY, url);
  } catch {
    // プライベートモードなどでは保存できない。致命的ではない。
  }
}

export function takePendingAvatar(): string | null {
  try {
    const url = window.localStorage.getItem(PENDING_KEY);
    if (url) window.localStorage.removeItem(PENDING_KEY);
    return url;
  } catch {
    return null;
  }
}
