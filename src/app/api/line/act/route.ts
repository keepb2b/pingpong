import { NextResponse } from "next/server";
import { approveContent } from "@/lib/agents/orchestrator";
import { verifyLineActionToken } from "@/lib/line";
import { appUrl } from "@/lib/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = ["approve", "revise", "hold", "reject"] as const;
type Act = (typeof ACTIONS)[number];

const COPY: Record<Act, { title: string; body: string }> = {
  approve: { title: "承認しました", body: "投稿を予約しました。ダッシュボードの「投稿予定」から確認できます。" },
  revise: { title: "修正を受け付けました", body: "ダッシュボードのコンテンツ画面から本文を直すか、LINEに修正内容を送ってください。" },
  hold: { title: "保留にしました", body: "ダッシュボードからいつでも再開できます。" },
  reject: { title: "投稿しない設定にしました", body: "今後の提案に反映します。" },
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") as Act | null;
  const id = url.searchParams.get("id") ?? "";
  const exp = url.searchParams.get("exp") ?? "";
  const sig = url.searchParams.get("sig") ?? "";

  if (!action || !ACTIONS.includes(action) || !id) {
    return html("操作が無効です", "リンクが正しくありません。", 400);
  }
  if (!verifyLineActionToken(action, id, exp, sig)) {
    return html("リンクの有効期限切れ", "新しい広報カードのボタンからやり直してください。", 403);
  }

  try {
    const result = await approveContent({
      contentId: id,
      action,
      via: "line",
      comment: "LINEのボタンから操作",
    });
    const msg = COPY[action];
    const extra = action === "approve" ? `（予約 ${result.scheduledPosts} 件）` : "";
    return html(msg.title, `${msg.body}${extra}`, 200, appUrl(`/dashboard/content/${id}`));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[line/act]", message);
    return html("処理できませんでした", message, 500);
  }
}

function html(title: string, body: string, status: number, next?: string) {
  const link = next
    ? `<p style="margin-top:24px"><a href="${next}" style="color:#4f46e5">ダッシュボードで詳細を見る</a></p>`
    : "";
  return new NextResponse(
    `<!doctype html><html lang="ja"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head>
<body style="font-family:sans-serif;padding:32px 20px;max-width:28rem;margin:0 auto;line-height:1.6">
<h1 style="font-size:1.25rem">${title}</h1>
<p>${body}</p>
${link}
</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
