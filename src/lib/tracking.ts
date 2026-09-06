import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ChannelKey } from "@/lib/constants";

const ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789";

export function shortCode(len = 7): string {
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function appUrl(path = ""): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

/**
 * 投稿・記事ごとの専用リンクを発行する。
 * 「表示→閲覧→CTAクリック→問い合わせ→成約」を1本の線で追えるようにする。
 */
export async function createTrackingLink(params: {
  orgId: string;
  subjectId: string;
  targetUrl: string;
  contentId?: string | null;
  postId?: string | null;
  channel?: ChannelKey;
  campaign?: string;
}): Promise<{ id: string; code: string; url: string }> {
  const sb = supabaseAdmin();

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = shortCode();
    const { data, error } = await sb
      .from("tracking_links")
      .insert({
        org_id: params.orgId,
        subject_id: params.subjectId,
        content_id: params.contentId ?? null,
        post_id: params.postId ?? null,
        code,
        target_url: params.targetUrl,
        channel: params.channel ?? null,
        utm: {
          utm_source: params.channel ?? "ai-koho",
          utm_medium: "pr",
          utm_campaign: params.campaign ?? "ai-koho",
          utm_content: params.contentId ?? undefined,
        },
      })
      .select("id, code")
      .single();

    if (!error && data) {
      return { id: data.id, code: data.code, url: appUrl(`/t/${data.code}`) };
    }
    // 23505 = unique violation on `code`; retry with a fresh code
    if (error && error.code !== "23505") throw error;
  }
  throw new Error("failed to allocate tracking code");
}

/** UTM を付与した最終遷移先を作る。 */
export function withUtm(target: string, utm: Record<string, unknown>): string {
  try {
    const url = new URL(target);
    for (const [k, v] of Object.entries(utm)) {
      if (v && !url.searchParams.has(k)) url.searchParams.set(k, String(v));
    }
    return url.toString();
  } catch {
    return target;
  }
}

/** 訪問者IDの発行 (Cookieに保存し、接触履歴と成果を突き合わせる) */
export function newVisitorId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

/**
 * 接触を記録する。最初の接触は first、成果直前は last として扱えるよう、
 * 既存履歴の有無で position を決める。
 */
export async function recordTouch(params: {
  orgId: string;
  visitorId: string;
  contentId?: string | null;
  postId?: string | null;
  channel?: ChannelKey | null;
}) {
  const sb = supabaseAdmin();
  const { count } = await sb
    .from("touchpoints")
    .select("id", { count: "exact", head: true })
    .eq("visitor_id", params.visitorId);

  await sb.from("touchpoints").insert({
    org_id: params.orgId,
    visitor_id: params.visitorId,
    content_id: params.contentId ?? null,
    post_id: params.postId ?? null,
    channel: params.channel ?? null,
    position: (count ?? 0) === 0 ? "first" : "mid",
  });
}

/** 成果発生時に、直前の接触を last に昇格させる。 */
export async function markLastTouch(visitorId: string) {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("touchpoints")
    .select("id")
    .eq("visitor_id", visitorId)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data) {
    await sb.from("touchpoints").update({ position: "last" }).eq("id", data.id);
  }
}
