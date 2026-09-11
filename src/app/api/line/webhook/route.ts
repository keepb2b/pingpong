import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  verifyLineSignature,
  replyMessage,
  pushMessage,
  textMessage,
  getProfile,
  getMessageContent,
  proposalFlex,
} from "@/lib/line";
import { secretaryInterview } from "@/lib/agents/secretary";
import { approveContent } from "@/lib/agents/orchestrator";
import { appUrl } from "@/lib/tracking";
import { CHANNEL_LABEL } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** ブラウザで URL が生きているか確認する用。LINE 本体は POST のみ。 */
export async function GET() {
  console.log("[line] webhook GET (health check)");
  return NextResponse.json({
    ok: true,
    webhook: "/api/line/webhook",
    hint: "This URL is reachable. LINE buttons send POST here; they will not show in this GET.",
  });
}

type LineEvent = {
  type: string;
  mode?: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { id: string; type: string; text?: string; fileName?: string };
  postback?: { data: string };
};

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-line-signature");
  let body: { events?: LineEvent[] } = {};
  try {
    body = raw ? (JSON.parse(raw) as { events?: LineEvent[] }) : {};
  } catch {
    console.error("[line] webhook body is not JSON");
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const events = body.events ?? [];
  console.log("[line] webhook POST", {
    hasSignature: Boolean(signature),
    bytes: raw.length,
    eventCount: events.length,
    types: events.map((e) => e.type),
    postbacks: events
      .filter((e) => e.type === "postback")
      .map((e) => e.postback?.data ?? null),
  });

  if (!verifyLineSignature(raw, signature)) {
    console.error("[line] invalid signature — check LINE_CHANNEL_SECRET matches Messaging API channel");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  await Promise.all(
    events.map((event) =>
      handleEvent(event).catch(async (err) => {
        console.error("[line] event failed", event.type, err);
        const fallback = [textMessage("申し訳ありません。処理中に問題が発生しました。時間をおいて再度お試しください。")];
        if (event.replyToken) {
          await replyMessage(event.replyToken, fallback).catch(() => undefined);
        } else if (event.source?.userId) {
          await pushMessage(event.source.userId, fallback).catch(() => undefined);
        }
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}

async function handleEvent(event: LineEvent) {
  if (event.mode === "standby") return;
  const userId = event.source?.userId;
  if (!userId) return;

  switch (event.type) {
    case "follow":
      return handleFollow(event, userId);
    case "unfollow":
      return handleUnfollow(userId);
    case "message":
      return handleMessage(event, userId);
    case "postback":
      return handlePostback(event, userId);
    default:
      return;
  }
}

// ------------------------------------------------------------- 友だち追加 --
async function handleFollow(event: LineEvent, userId: string) {
  if (!event.replyToken) return;
  const account = await findAccount(userId);

  if (account) {
    await replyMessage(event.replyToken, [
      textMessage(
        "AI広報部です。引き続きよろしくお願いいたします。\n本日の広報材料がありましたらお送りください。",
      ),
    ]);
    return;
  }

  await replyMessage(event.replyToken, [
    textMessage(
      "AI広報部です。ご登録ありがとうございます。\n\n管理画面の「設定 → LINE連携」で発行された連携コード(6文字)をこのトークに送信してください。",
    ),
  ]);
}

async function handleUnfollow(userId: string) {
  const sb = supabaseAdmin();
  await sb.from("line_accounts").delete().eq("line_user_id", userId);
}

// --------------------------------------------------------------- メッセージ
async function handleMessage(event: LineEvent, userId: string) {
  const sb = supabaseAdmin();
  const replyToken = event.replyToken;
  if (!replyToken || !event.message) return;

  const account = await findAccount(userId);

  // 未連携 → 連携コードの受付
  if (!account) {
    const code = (event.message.text ?? "").trim();
    if (event.message.type === "text" && /^[A-Za-z0-9]{4,12}$/.test(code)) {
      return linkAccount(code, userId, replyToken);
    }
    await replyMessage(replyToken, [
      textMessage("先に連携が必要です。管理画面で発行した連携コードを送信してください。"),
    ]);
    return;
  }

  const subjectId = account.active_subject_id ?? (await primarySubject(account.org_id));
  if (!subjectId) {
    await replyMessage(replyToken, [
      textMessage("広報対象が登録されていません。管理画面から登録してください。"),
    ]);
    return;
  }

  // コマンド処理
  if (event.message.type === "text") {
    const text = (event.message.text ?? "").trim();
    const handled = await handleCommand(
      text,
      account.org_id,
      subjectId,
      replyToken,
      account.user_id,
      userId,
    );
    if (handled) return;
  }

  const conversation = await getOrCreateConversation(account.org_id, subjectId, userId);

  // 添付 (写真・動画・資料・音声) の保存
  let attachmentNote = "";
  const attachments: Array<{ kind: string; url?: string }> = [];

  if (["image", "video", "file", "audio"].includes(event.message.type)) {
    const saved = await saveAttachment({
      orgId: account.org_id,
      subjectId,
      messageId: event.message.id,
      kind: event.message.type,
      fileName: event.message.fileName,
    });
    if (saved) {
      attachments.push({ kind: event.message.type, url: saved.url });
      attachmentNote =
        event.message.type === "audio"
          ? "(音声を受け取りました)"
          : `(${event.message.type === "image" ? "写真" : event.message.type === "video" ? "動画" : "資料"}を受け取りました)`;
    }
  }

  const userText = event.message.text ?? (attachmentNote || "(添付のみ)");

  await sb.from("messages").insert({
    org_id: account.org_id,
    conversation_id: conversation.id,
    role: "user",
    content: userText,
    attachments,
  });

  const { data: history } = await sb
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .limit(24);

  const { data: settings } = await sb
    .from("dialogue_settings")
    .select("max_questions_per_session")
    .eq("subject_id", subjectId)
    .maybeSingle();

  const turn = await secretaryInterview({
    subjectId,
    history: (history ?? []).slice(0, -1),
    latest: userText,
    attachments,
    askedCount: conversation.question_index,
    maxQuestions: Math.min(settings?.max_questions_per_session ?? 6, 6),
  });

  await sb.from("messages").insert({
    org_id: account.org_id,
    conversation_id: conversation.id,
    role: "assistant",
    agent: "secretary",
    content: turn.reply,
    meta: { extracted: turn.extracted, complete: turn.complete },
  });

  // 聞き取れた内容を広報材料として保存
  if (turn.extracted?.title || turn.complete) {
    await upsertIntake({
      orgId: account.org_id,
      subjectId,
      conversationId: conversation.id,
      extracted: turn.extracted,
      rawText: userText,
      assetUrls: attachments.map((a) => a.url).filter(Boolean) as string[],
    });
  }

  // 学習候補を記録 (ユーザーが後から確認・修正・忘却できる)
  for (const l of turn.learnings ?? []) {
    if (!l?.statement) continue;
    await sb.from("learnings").insert({
      org_id: account.org_id,
      subject_id: subjectId,
      category: l.category ?? "preference",
      statement: l.statement,
      evidence: userText.slice(0, 500),
      status: "pending",
    });
  }

  await sb
    .from("conversations")
    .update({
      question_index: turn.complete ? 0 : conversation.question_index + 1,
      pending_question: turn.complete ? null : turn.reply,
      status: turn.complete ? "closed" : "open",
      last_message_at: new Date().toISOString(),
    })
    .eq("id", conversation.id);

  await replyMessage(replyToken, [textMessage(turn.reply)]);
}

// ------------------------------------------------------------ コマンド ----
async function handleCommand(
  text: string,
  orgId: string,
  subjectId: string,
  replyToken: string,
  userId?: string | null,
  lineUserId?: string,
): Promise<boolean> {
  const sb = supabaseAdmin();

  const decision = parseContentDecision(text);
  if (decision) {
    await applyLineContentAction({
      orgId,
      subjectId,
      userId: userId ?? null,
      lineUserId,
      replyToken,
      action: decision.action,
      contentId: decision.contentId,
    });
    return true;
  }

  if (/^(ヘルプ|help|使い方)$/i.test(text)) {
    await replyMessage(replyToken, [
      textMessage(
        [
          "AI広報部の使い方",
          "",
          "・出来事をそのまま送るだけで、AI秘書が必要な情報を聞き取ります",
          "・写真、動画、資料もそのまま送れます",
          "",
          "コマンド",
          "「提案」承認待ちの広報案を表示",
          "「予定」投稿予定を表示",
          "「レポート」最新の月次レポート",
          "「スコア」AI広報スコア",
          "「停止」ヒアリングを一時停止",
          "「再開」ヒアリングを再開",
        ].join("\n"),
      ),
    ]);
    return true;
  }

  if (/^(提案|承認)$/.test(text)) {
    const { data: pending } = await sb
      .from("content_items")
      .select("id,title,summary,type,risk,goal")
      .eq("subject_id", subjectId)
      .eq("status", "pending_approval")
      .order("created_at", { ascending: false })
      .limit(3);

    if (!pending?.length) {
      await replyMessage(replyToken, [textMessage("現在、承認待ちの広報案はありません。")]);
      return true;
    }

    await replyMessage(
      replyToken,
      pending.map((c) =>
        proposalFlex(
          {
            id: c.id,
            theme: c.title,
            reason: "承認待ちの広報案です",
            goal: c.goal ?? "—",
            audience: "—",
            channels: [],
            cta: "—",
            expectedEffect: "—",
            cautions: c.risk !== "none" ? `リスク: ${c.risk}` : "",
            bodyPreview: c.summary ?? "",
          },
          appUrl(),
        ),
      ),
    );
    return true;
  }

  if (/^(予定|スケジュール)$/.test(text)) {
    const { data: posts } = await sb
      .from("posts")
      .select("channel, scheduled_for, body, status")
      .eq("subject_id", subjectId)
      .eq("status", "scheduled")
      .order("scheduled_for")
      .limit(8);

    if (!posts?.length) {
      await replyMessage(replyToken, [textMessage("投稿予定はありません。")]);
      return true;
    }

    await replyMessage(replyToken, [
      textMessage(
        "投稿予定\n\n" +
        posts
          .map(
            (p) =>
              `${new Date(p.scheduled_for!).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} ${CHANNEL_LABEL[p.channel as keyof typeof CHANNEL_LABEL] ?? p.channel}\n${String(p.body).slice(0, 50)}`,
          )
          .join("\n\n"),
      ),
    ]);
    return true;
  }

  if (/^(レポート|月次)$/.test(text)) {
    const { data: report } = await sb
      .from("monthly_reports")
      .select("period, summary")
      .eq("subject_id", subjectId)
      .order("period", { ascending: false })
      .limit(1)
      .maybeSingle();

    await replyMessage(replyToken, [
      textMessage(
        report
          ? `${report.period} 月次AI広報会議\n\n${report.summary ?? ""}\n\n詳細: ${appUrl("/dashboard/reports")}`
          : "まだレポートがありません。月末に作成されます。",
      ),
    ]);
    return true;
  }

  if (/^(スコア)$/.test(text)) {
    const { data: score } = await sb
      .from("pr_scores")
      .select("*")
      .eq("subject_id", subjectId)
      .order("period", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!score) {
      await replyMessage(replyToken, [textMessage("スコアはまだ算出されていません。")]);
      return true;
    }

    const improvements = (score.improvements ?? []) as Array<{ action?: string }>;
    await replyMessage(replyToken, [
      textMessage(
        `${score.period} AI広報スコア: ${score.total}点\n\n` +
        `広報基盤 ${score.foundation} / 発信継続性 ${score.consistency}\n` +
        `品質 ${score.quality} / ブランド整合 ${score.brand_fit}\n` +
        `SEO・AEO ${score.seo_aeo} / SNS到達 ${score.sns_reach}\n` +
        `顧客導線 ${score.funnel} / CV・売上 ${score.cv_revenue}\n` +
        `口コミ ${score.reputation} / リスク管理 ${score.risk_mgmt}\n\n` +
        (improvements.length ? `改善提案:\n${improvements.slice(0, 3).map((i) => `・${i.action}`).join("\n")}` : ""),
      ),
    ]);
    return true;
  }

  if (/^(停止|一時停止)$/.test(text)) {
    await sb.from("dialogue_settings").update({ frequency: "paused" }).eq("subject_id", subjectId);
    await replyMessage(replyToken, [
      textMessage("ヒアリングを一時停止しました。「再開」と送信すると再開します。"),
    ]);
    return true;
  }

  if (/^(再開)$/.test(text)) {
    await sb
      .from("dialogue_settings")
      .update({ frequency: "daily", paused_until: null })
      .eq("subject_id", subjectId);
    await replyMessage(replyToken, [textMessage("ヒアリングを再開しました。")]);
    return true;
  }

  return false;
}

// ---------------------------------------------------------- ポストバック --
async function handlePostback(event: LineEvent, userId: string) {
  const replyToken = event.replyToken ?? null;
  if (!event.postback) return;

  const parsed = parsePostbackPayload(event.postback.data);
  const action = parsed.action;
  const id = parsed.id;
  console.log("[line] handlePostback", { data: event.postback.data, action, id });

  const account = await findAccount(userId);

  if (!account) {
    await deliverLine({ replyToken, lineUserId: userId }, [textMessage("先にLINE連携が必要です。")]);
    return;
  }

  const subjectId = account.active_subject_id ?? (await primarySubject(account.org_id));
  if (action === "list_pending" && subjectId) {
    await handleCommand("提案", account.org_id, subjectId, replyToken ?? "", account.user_id, userId);
    return;
  }
  if (action === "list_scheduled" && subjectId) {
    await handleCommand("予定", account.org_id, subjectId, replyToken ?? "", account.user_id, userId);
    return;
  }

  if (!["approve", "revise", "hold", "reject"].includes(action ?? "")) {
    await deliverLine({ replyToken, lineUserId: userId }, [textMessage("不明な操作です。")]);
    return;
  }

  await deliverLine({ replyToken, lineUserId: userId }, [textMessage("受け付けました。反映しています…")]);

  await applyLineContentAction({
    orgId: account.org_id,
    subjectId: subjectId ?? "",
    userId: account.user_id,
    lineUserId: userId,
    replyToken: null,
    action: action as "approve" | "revise" | "hold" | "reject",
    contentId: id,
  });
}

function parsePostbackPayload(data: string | undefined): {
  action: string | null;
  id: string | null;
} {
  if (!data) return { action: null, id: null };
  try {
    const json = JSON.parse(data) as { action?: string; id?: string };
    if (json && typeof json === "object" && (json.action || json.id)) {
      return { action: json.action ?? null, id: json.id ?? null };
    }
  } catch {
    // querystring or "approve:uuid"
  }
  const params = new URLSearchParams(data);
  if (params.get("action")) {
    return { action: params.get("action"), id: params.get("id") };
  }
  const compact = data.match(/^(approve|revise|hold|reject)[:|=]([0-9a-f-]{36})$/i);
  if (compact) return { action: compact[1].toLowerCase(), id: compact[2] };
  return { action: null, id: null };
}

async function deliverLine(
  dest: { replyToken?: string | null; lineUserId?: string | null },
  messages: ReturnType<typeof textMessage>[],
) {
  if (dest.replyToken) {
    try {
      await replyMessage(dest.replyToken, messages);
      return;
    } catch (err) {
      console.error("[line] reply failed, falling back to push", err);
    }
  }
  if (dest.lineUserId) {
    await pushMessage(dest.lineUserId, messages);
  }
}

function parseContentDecision(text: string): {
  action: "approve" | "revise" | "hold" | "reject";
  contentId: string | null;
} | null {
  const m = text.match(
    /^(承認します|修正したいです|保留します|投稿しません|承認|修正|保留|投稿しない)\s*[:：]\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
  );
  const m2 =
    m ??
    text.match(
      /^(承認します|修正したいです|保留します|投稿しません)\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/i,
    );
  if (!m2) return null;
  const label = m2[1];
  const action: "approve" | "revise" | "hold" | "reject" =
    /修正/.test(label) ? "revise" : /保留/.test(label) ? "hold" : /投稿しない|投稿しません/.test(label) ? "reject" : "approve";
  return { action, contentId: m2[2] ?? null };
}

async function applyLineContentAction(params: {
  orgId: string;
  subjectId: string;
  userId: string | null;
  lineUserId?: string;
  replyToken: string | null;
  action: "approve" | "revise" | "hold" | "reject";
  contentId: string | null;
}) {
  const sb = supabaseAdmin();
  let id = params.contentId;
  if (!id && params.subjectId) {
    const { data: latest } = await sb
      .from("content_items")
      .select("id")
      .eq("org_id", params.orgId)
      .eq("subject_id", params.subjectId)
      .eq("status", "pending_approval")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    id = latest?.id ?? null;
  }
  if (!id) {
    await deliverLine(
      { replyToken: params.replyToken, lineUserId: params.lineUserId },
      [textMessage("対象の広報案が見つかりませんでした。「提案」と送ると一覧を出せます。")],
    );
    return;
  }

  const result = await approveContent({
    contentId: id,
    action: params.action,
    userId: params.userId,
    via: "line",
    comment: "LINEのボタンから操作",
  });

  const messages: Record<string, string> = {
    approve: `承認しました。${result.scheduledPosts}件の投稿を予約しました。`,
    revise: "修正を承りました。修正のご要望をこのトークに送信してください。",
    hold: "保留にしました。ダッシュボードからいつでも再開できます。",
    reject: "投稿しない設定にしました。今後の提案に反映します。",
  };

  if (params.action === "revise" && params.subjectId && params.lineUserId) {
    const conv = await getOrCreateConversation(params.orgId, params.subjectId, params.lineUserId);
    await sb
      .from("conversations")
      .update({ topic: `revise:${id}`, status: "open" })
      .eq("id", conv.id);
  }

  if (params.action === "reject" || params.action === "hold") {
    const { data: content } = await sb
      .from("content_items")
      .select("subject_id, title, type")
      .eq("id", id)
      .maybeSingle();
    if (content) {
      await sb.from("learnings").insert({
        org_id: params.orgId,
        subject_id: content.subject_id,
        category: "rule",
        statement: `「${content.title}」(${content.type})は${params.action === "reject" ? "投稿しない" : "保留"}と判断された`,
        evidence: "LINEでのユーザー操作",
        status: "pending",
      });
    }
  }

  await deliverLine(
    { replyToken: params.replyToken, lineUserId: params.lineUserId },
    [textMessage(messages[params.action])],
  );
}

// ------------------------------------------------------------- ヘルパー ---
async function findAccount(lineUserId: string) {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("line_accounts")
    .select("id, org_id, user_id, active_subject_id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  return data;
}

async function primarySubject(orgId: string): Promise<string | null> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("subjects")
    .select("id")
    .eq("org_id", orgId)
    .eq("active", true)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function linkAccount(code: string, lineUserId: string, replyToken: string) {
  const sb = supabaseAdmin();

  const { data: link } = await sb
    .from("link_codes")
    .select("id, org_id, expires_at, used_at, created_by")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!link || link.used_at || new Date(link.expires_at) < new Date()) {
    await replyMessage(replyToken, [
      textMessage("連携コードが無効か、有効期限が切れています。管理画面で再発行してください。"),
    ]);
    return;
  }

  const profile = await getProfile(lineUserId).catch(
    () => ({}) as { displayName?: string; pictureUrl?: string },
  );
  const subjectId = await primarySubject(link.org_id);

  await sb.from("line_accounts").upsert(
    {
      org_id: link.org_id,
      line_user_id: lineUserId,
      display_name: profile.displayName ?? null,
      picture_url: profile.pictureUrl ?? null,
      user_id: link.created_by,
      active_subject_id: subjectId,
    },
    { onConflict: "line_user_id" },
  );

  await sb
    .from("link_codes")
    .update({ used_at: new Date().toISOString(), used_by_line_user_id: lineUserId })
    .eq("id", link.id);

  if (link.created_by) {
    await sb.from("profiles").update({ line_user_id: lineUserId }).eq("id", link.created_by);
  }

  await replyMessage(replyToken, [
    textMessage(
      "連携が完了しました。\n\nこれから、AI秘書が広報に使える情報をお伺いします。\n出来事や成果を思いついたときに、そのままこのトークへ送ってください。写真や資料もお送りいただけます。",
    ),
  ]);
}

async function getOrCreateConversation(orgId: string, subjectId: string, lineUserId: string) {
  const sb = supabaseAdmin();

  const { data: existing } = await sb
    .from("conversations")
    .select("id, question_index, topic")
    .eq("line_user_id", lineUserId)
    .eq("subject_id", subjectId)
    .eq("status", "open")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data: created } = await sb
    .from("conversations")
    .insert({
      org_id: orgId,
      subject_id: subjectId,
      line_user_id: lineUserId,
      channel: "line",
      status: "open",
    })
    .select("id, question_index, topic")
    .single();

  if (!created) throw new Error("failed to create conversation");
  return created;
}

async function saveAttachment(params: {
  orgId: string;
  subjectId: string;
  messageId: string;
  kind: string;
  fileName?: string;
}): Promise<{ url: string } | null> {
  const sb = supabaseAdmin();
  const content = await getMessageContent(params.messageId);
  if (!content) return null;

  const ext =
    params.fileName?.split(".").pop() ??
    (content.contentType.includes("png")
      ? "png"
      : content.contentType.includes("mp4")
        ? "mp4"
        : content.contentType.includes("m4a") || content.contentType.includes("aac")
          ? "m4a"
          : "jpg");

  const path = `${params.orgId}/${params.subjectId}/${Date.now()}-${params.messageId}.${ext}`;

  const { error } = await sb.storage.from("pr-media").upload(path, content.buffer, {
    contentType: content.contentType,
    upsert: false,
  });
  if (error) return null;

  const {
    data: { publicUrl },
  } = sb.storage.from("pr-media").getPublicUrl(path);

  await sb.from("media_assets").insert({
    org_id: params.orgId,
    subject_id: params.subjectId,
    kind: params.kind,
    storage_path: path,
    url: publicUrl,
    mime_type: content.contentType,
    bytes: content.buffer.byteLength,
    source: "line",
  });

  return { url: publicUrl };
}

async function upsertIntake(params: {
  orgId: string;
  subjectId: string;
  conversationId: string;
  extracted: {
    title?: string;
    kind?: string;
    summary?: string;
    facts?: Array<{ key: string; value: string; needs_confirmation?: boolean }>;
    disclosable?: boolean;
    newsworthiness?: number;
    missing?: string[];
  };
  rawText: string;
  assetUrls: string[];
}) {
  const sb = supabaseAdmin();

  const { data: existing } = await sb
    .from("intake_items")
    .select("id, raw_text, structured")
    .eq("conversation_id", params.conversationId)
    .maybeSingle();

  const structured = {
    ...(existing?.structured ?? {}),
    facts: params.extracted.facts ?? [],
    missing: params.extracted.missing ?? [],
    assets: params.assetUrls,
  };

  const validKinds = [
    "event",
    "achievement",
    "new_service",
    "customer_voice",
    "photo",
    "document",
    "number",
    "other",
  ];
  const kind = validKinds.includes(params.extracted.kind ?? "") ? params.extracted.kind : "event";

  if (existing) {
    await sb
      .from("intake_items")
      .update({
        title: params.extracted.title ?? undefined,
        raw_text: `${existing.raw_text ?? ""}\n${params.rawText}`.trim().slice(0, 8000),
        structured,
        newsworthiness: params.extracted.newsworthiness ?? undefined,
        disclosable: params.extracted.disclosable ?? true,
      })
      .eq("id", existing.id);
    return;
  }

  await sb.from("intake_items").insert({
    org_id: params.orgId,
    subject_id: params.subjectId,
    conversation_id: params.conversationId,
    kind,
    title: params.extracted.title ?? params.rawText.slice(0, 40),
    raw_text: params.rawText,
    structured,
    newsworthiness: params.extracted.newsworthiness ?? 50,
    disclosable: params.extracted.disclosable ?? true,
    status: "new",
  });
}
