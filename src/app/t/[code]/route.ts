import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { withUtm, newVisitorId, recordTouch } from "@/lib/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 専用リンクの中継。
 * ここを通すことで「どの投稿を見て → どの記事を読み → 何をしたか」が線でつながる。
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const sb = supabaseAdmin();

  const { data: link } = await sb
    .from("tracking_links")
    .select("id, org_id, subject_id, content_id, post_id, channel, target_url, utm")
    .eq("code", code)
    .maybeSingle();

  if (!link) {
    return NextResponse.redirect(new URL("/", request.url), 302);
  }

  const url = new URL(request.url);
  const cookieHeader = request.headers.get("cookie") ?? "";
  const existing = cookieHeader.match(/(?:^|;\s*)aikoho_vid=([^;]+)/)?.[1];
  const visitorId = existing ?? newVisitorId();

  // 記録は遷移をブロックしない
  const record = (async () => {
    await sb.from("link_events").insert({
      org_id: link.org_id,
      link_id: link.id,
      visitor_id: visitorId,
      referrer: request.headers.get("referer"),
      user_agent: request.headers.get("user-agent"),
      country: request.headers.get("x-vercel-ip-country"),
    });
    await sb.rpc("increment_link_click", { p_code: code });
    await recordTouch({
      orgId: link.org_id,
      visitorId,
      contentId: link.content_id,
      postId: link.post_id,
      channel: link.channel,
    });
    await sb.from("conversions").insert({
      org_id: link.org_id,
      subject_id: link.subject_id,
      type: "cta_click",
      visitor_id: visitorId,
      link_id: link.id,
      content_id: link.content_id,
      post_id: link.post_id,
      channel: link.channel,
    });
  })();

  try {
    await record;
  } catch {
    // 計測失敗でユーザーの遷移を止めない
  }

  const target = withUtm(link.target_url, {
    ...(link.utm as Record<string, unknown>),
    aik_vid: visitorId,
  });

  const response = NextResponse.redirect(target, 302);
  if (!existing) {
    response.cookies.set("aikoho_vid", visitorId, {
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 180,
      path: "/",
      secure: url.protocol === "https:",
    });
  }
  return response;
}
