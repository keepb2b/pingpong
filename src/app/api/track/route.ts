import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { markLastTouch, recordTouch } from "@/lib/tracking";
import { CONVERSION_LABEL } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * 顧客サイトから成果を送るための計測エンドポイント。
 * 問い合わせ・予約・購入・成約までを、接触した投稿と紐づけて記録する。
 *
 * 例:
 *   fetch("https://<app>/api/track", {
 *     method: "POST",
 *     body: JSON.stringify({ subject_id, type: "inquiry", visitor_id, amount })
 *   })
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      subject_id?: string;
      type?: string;
      visitor_id?: string;
      amount?: number;
      meta?: Record<string, unknown>;
    };

    if (!body.subject_id || !body.type) {
      return NextResponse.json(
        { ok: false, error: "subject_id と type は必須です" },
        { status: 400, headers: CORS },
      );
    }

    if (!(body.type in CONVERSION_LABEL)) {
      return NextResponse.json(
        { ok: false, error: `不明な成果種別: ${body.type}` },
        { status: 400, headers: CORS },
      );
    }

    const sb = supabaseAdmin();
    const { data: subject } = await sb
      .from("subjects")
      .select("id, org_id")
      .eq("id", body.subject_id)
      .maybeSingle();

    if (!subject) {
      return NextResponse.json(
        { ok: false, error: "対象が見つかりません" },
        { status: 404, headers: CORS },
      );
    }

    const cookieHeader = request.headers.get("cookie") ?? "";
    const visitorId =
      body.visitor_id ?? cookieHeader.match(/(?:^|;\s*)aikoho_vid=([^;]+)/)?.[1] ?? null;

    // 直前の接触を「最後に行動を起こした媒体」として確定させる
    let lastTouch: { content_id: string | null; post_id: string | null; channel: string | null } | null =
      null;

    if (visitorId) {
      const { data } = await sb
        .from("touchpoints")
        .select("content_id, post_id, channel")
        .eq("visitor_id", visitorId)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      lastTouch = data;
      await markLastTouch(visitorId);
    }

    await sb.from("conversions").insert({
      org_id: subject.org_id,
      subject_id: subject.id,
      type: body.type,
      visitor_id: visitorId,
      content_id: lastTouch?.content_id ?? null,
      post_id: lastTouch?.post_id ?? null,
      channel: lastTouch?.channel ?? null,
      amount: body.amount ?? null,
      meta: body.meta ?? {},
    });

    if (visitorId && !lastTouch) {
      await recordTouch({ orgId: subject.org_id, visitorId });
    }

    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "failed" },
      { status: 500, headers: CORS },
    );
  }
}
