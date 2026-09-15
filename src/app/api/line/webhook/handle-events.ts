import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  replyMessage,
  textMessage,
  quickReply,
  getProfile,
  getMessageContent,
  proposalFlex,
} from "@/lib/line";
import { secretaryInterview } from "@/lib/agents/secretary";
import { approveContent, notify, produceFromIntake } from "@/lib/agents/orchestrator";
import { appUrl } from "@/lib/tracking";
import { CHANNEL_LABEL } from "@/lib/constants";

export type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { type?: string; userId?: string; groupId?: string; roomId?: string };
  message?: { id: string; type: string; text?: string; fileName?: string };
  postback?: { data: string };
};

export async function processLineEvents(events: LineEvent[]) {
  // LINE can put multiple messages from one user in one webhook. Process them
  // in order so a short follow-up is not mistaken for a separate interview.
  for (const event of events) {
    await handleEvent(event).catch(async (err) => {
      console.error("[line] event failed", err);
      if (event.replyToken) {
        await replyMessage(event.replyToken, [
          textMessage("申し訳ありません。処理中に問題が発生しました。時間をおいて再度お試しください。"),
        ]).catch(() => undefined);
      }
    });
  }
}

function eventUserId(event: LineEvent): string | undefined {
  return event.source?.userId;
}

function isGroupOrRoom(event: LineEvent): boolean {
  return event.source?.type === "group" || event.source?.type === "room" || Boolean(event.source?.groupId || event.source?.roomId);
}

async function handleEvent(event: LineEvent) {
  const userId = eventUserId(event);

  if (event.type === "postback") {
    if (!userId) {
      if (event.replyToken) {
        await replyMessage(event.replyToken, [
          textMessage(
            isGroupOrRoom(event)
              ? "承認・修正はグループではなく、公式アカウントとの1対1トークから操作してください。"
              : "操作を受け付けられませんでした。公式アカウントを友だち追加し、1対1トークからボタンを押してください。",
          ),
        ]);
      }
      return;
    }
    return handlePostback(event, userId);
  }

  if (!userId) {
    if (event.replyToken && event.type === "message") {
      await replyMessage(event.replyToken, [
        textMessage("このBotは1対1トーク専用です。公式アカウントとの個人トークでお送りください。"),
      ]);
    }
    return;
  }

  switch (event.type) {
    case "follow":
      return handleFollow(event, userId);
    case "unfollow":
      return handleUnfollow(userId);
    case "message":
      return handleMessage(event, userId);
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
    const handled = await handleCommand(text, account.org_id, subjectId, replyToken);
    if (handled) return;
  }

  // A redelivered message must not start another interview or production run.
  const { data: received, error: receivedError } = await sb
    .from("messages")
    .select("id")
    .eq("org_id", account.org_id)
    .contains("meta", { line_message_id: event.message.id })
    .limit(1)
    .maybeSingle();
  if (receivedError) throw receivedError;
  if (received) return;

  const userText = event.message.text?.trim() ?? "";
  if (event.message.type === "text" && isAcknowledgement(userText)) {
    const { data: latestAssistant } = await sb
      .from("messages")
      .select("content")
      .eq("org_id", account.org_id)
      .eq("role", "assistant")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastReply = latestAssistant?.content ?? "";
    const reply = /広報案を作成|承認カード|完成したら/.test(lastReply)
      ? "どういたしまして。広報案が完成したら、このトークに承認カードをお届けします。"
      : "どういたしまして。広報に使いたい出来事や追加情報があれば、いつでもお送りください。";
    await replyMessage(replyToken, [textMessage(reply)]);
    return;
  }

  const conversation = await getOrCreateConversation(account.org_id, subjectId, userId);

  // A revision instruction belongs to the already-created proposal. It must
  // never be treated as the start of another promotion interview.
  if (conversation.topic?.startsWith("revise:")) {
    const contentId = conversation.topic.slice("revise:".length);
    await sb.from("messages").insert({
      org_id: account.org_id,
      conversation_id: conversation.id,
      role: "user",
      content: event.message.text ?? "(添付された修正指示)",
      meta: { line_message_id: event.message.id, revise_content_id: contentId },
    });
    await replyMessage(replyToken, [
      textMessage("修正内容を承りました。広報案に反映して、改めてご確認いただけるよう準備します。"),
    ]);
    return;
  }

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

  const materialText = event.message.text ?? (attachmentNote || "(添付のみ)");

  const { error: messageError } = await sb.from("messages").insert({
    org_id: account.org_id,
    conversation_id: conversation.id,
    role: "user",
    content: materialText,
    attachments,
    meta: { line_message_id: event.message.id },
  });
  if (messageError) throw messageError;

  const { data: history, error: historyError } = await sb
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(24);
  if (historyError) throw historyError;

  const { data: settings } = await sb
    .from("dialogue_settings")
    .select("max_questions_per_session")
    .eq("subject_id", subjectId)
    .maybeSingle();

  const turn = await secretaryInterview({
    subjectId,
    history: (history ?? []).reverse().slice(0, -1),
    latest: materialText,
    attachments,
    askedCount: conversation.question_index,
    maxQuestions: Math.min(settings?.max_questions_per_session ?? 6, 6),
  });

  const reply = turn.complete
    ? "ありがとうございます。いただいた内容をもとに広報案を作成します。完成したら、このLINEに広報案と承認カードを自動でお届けします。"
    : turn.reply;

  // Save every turn, including early details and attachments without a title.
  const intakeItemId = await upsertIntake({
    orgId: account.org_id,
    subjectId,
    conversationId: conversation.id,
    extracted: turn.extracted ?? {},
    rawText: materialText,
    assetUrls: attachments.map((a) => a.url).filter(Boolean) as string[],
  });

  const { error: assistantError } = await sb.from("messages").insert({
    org_id: account.org_id,
    conversation_id: conversation.id,
    role: "assistant",
    agent: "secretary",
    content: reply,
    meta: { extracted: turn.extracted, complete: turn.complete },
  });
  if (assistantError) throw assistantError;

  // 学習候補を記録 (ユーザーが後から確認・修正・忘却できる)
  for (const l of turn.learnings ?? []) {
    if (!l?.statement) continue;
    await sb.from("learnings").insert({
      org_id: account.org_id,
      subject_id: subjectId,
      category: l.category ?? "preference",
      statement: l.statement,
      evidence: materialText.slice(0, 500),
      status: "pending",
    });
  }

  const { data: updated, error: conversationError } = await sb
    .from("conversations")
    .update({
      question_index: turn.complete ? 0 : conversation.question_index + 1,
      pending_question: turn.complete ? null : turn.reply,
      status: turn.complete ? "closed" : "open",
      last_message_at: new Date().toISOString(),
    })
    .eq("id", conversation.id)
    .eq("status", "open")
    .select("id")
    .maybeSingle();
  if (conversationError) throw conversationError;
  if (!updated) return;

  if (!turn.complete) {
    await replyMessage(replyToken, [textMessage(reply)]);
    return;
  }

  // Reply first. Completion uses a push; LINE reply tokens are single-use.
  await replyMessage(replyToken, [textMessage(reply)]).catch((error) => {
    console.error("[line] production acknowledgement failed", error);
  });

  try {
    // This is awaited inside the webhook's after() task so the runtime stays alive.
    await produceFromIntake({ intakeItemId, orgId: account.org_id, subjectId, lineUserId: userId });
  } catch (error) {
    console.error("[line] promotion production failed", error);
    await notify({
      orgId: account.org_id,
      subjectId,
      kind: "error",
      agent: "secretary",
      title: "広報案の作成を完了できませんでした",
      body: "いただいた内容は保存されています。時間をおいて、改めて広報材料をお送りください。",
      toLine: true,
      lineUserId: userId,
    }).catch((notificationError) => {
      console.error("[line] production failure notification failed", notificationError);
    });
  }
}

/**
 * Messages such as "ありがとうございます" are conversation acknowledgements,
 * not promotion material. Keep the whitelist narrow: messages with a request,
 * date, number, attachment, or any substantial extra wording still go through
 * the normal interview so useful new information is never discarded.
 */
function isAcknowledgement(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .replace(/[！!。．、,\s]/g, "")
    .replace(/[😊🙏✨👍☺️]/g, "");
  if (!normalized || normalized.length > 32) return false;
  return /^(ありがとう(?:ございます|ございました)?|どうも|了解(?:です|しました)?|承知(?:しました|です)?|ok|okay|thanks|thankyou|thx|助かります|よろしく(?:お願いします|です)?)$/.test(normalized);
}

// ------------------------------------------------------------ コマンド ----
async function handleCommand(
  text: string,
  orgId: string,
  subjectId: string,
  replyToken: string,
): Promise<boolean> {
  const sb = supabaseAdmin();

  if (/^(ヘルプ|help|使い方)$/i.test(text)) {
    await replyMessage(replyToken, [
      textMessage(
        [
          "AI広報部の使い方",
          "",
          "・出来事をそのまま送るだけで、AI秘書が必要な情報を聞き取ります",
          "・写真、動画、資料もそのまま送れます",
          "・聞き取りが終わると広報案を作成し、完成後にこのトークへ承認カードを自動でお届けします",
          "",
          "コマンド",
          "「提案」以前の承認待ちの広報案を再表示",
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
    await replyPendingCards(replyToken, subjectId);
    return true;
  }

  if (/^(予定|スケジュール)$/.test(text)) {
    await replyScheduled(replyToken, subjectId);
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
  const sb = supabaseAdmin();
  const replyToken = event.replyToken;
  if (!replyToken || !event.postback) return;

  const params = new URLSearchParams(event.postback.data);
  const action = params.get("action");
  const id = params.get("id");

  const account = await findAccount(userId);
  if (!account) {
    await replyMessage(replyToken, [
      textMessage("LINE連携が完了していません。管理画面の連携コードを1対1トークに送信してください。"),
    ]);
    return;
  }

  const subjectId = account.active_subject_id ?? (await primarySubject(account.org_id));

  if (action === "list_pending") {
    if (!subjectId) {
      await replyMessage(replyToken, [textMessage("広報対象がありません。")]);
      return;
    }
    await replyPendingCards(replyToken, subjectId);
    return;
  }

  if (action === "list_scheduled") {
    if (!subjectId) {
      await replyMessage(replyToken, [textMessage("広報対象がありません。")]);
      return;
    }
    await replyScheduled(replyToken, subjectId);
    return;
  }

  if (action === "detail") {
    if (!id) {
      await replyMessage(replyToken, [textMessage("対象の広報案が見つかりません。")]);
      return;
    }
    await replyMessage(replyToken, [
      textMessage(`詳細はダッシュボードで確認できます。\n${appUrl(`/dashboard/content/${id}`)}`),
    ]);
    return;
  }

  if (!id) {
    await replyMessage(replyToken, [textMessage("操作を受け付けられませんでした。")]);
    return;
  }

  if (!["approve", "revise", "hold", "reject"].includes(action ?? "")) {
    await replyMessage(replyToken, [textMessage("不明な操作です。1対1トークのカードから操作してください。")]);
    return;
  }

  const result = await approveContent({
    contentId: id,
    action: action as "approve" | "revise" | "hold" | "reject",
    userId: account.user_id,
    via: "line",
  });

  const messages: Record<string, string> = {
    approve: `承認しました。${result.scheduledPosts}件の投稿を予約しました。`,
    revise: "修正を承りました。修正のご要望をこのトークに送信してください。",
    hold: "保留にしました。ダッシュボードからいつでも再開できます。",
    reject: "投稿しない設定にしました。今後の提案に反映します。",
  };

  if (action === "revise") {
    // 修正指示を受けるため会話を開いておく
    const subjectId = account.active_subject_id ?? (await primarySubject(account.org_id));
    if (subjectId) {
      const conv = await getOrCreateConversation(account.org_id, subjectId, userId);
      await sb
        .from("conversations")
        .update({ topic: `revise:${id}`, status: "open" })
        .eq("id", conv.id);
    }
  }

  // 却下・保留の理由は学習材料になる
  if (action === "reject" || action === "hold") {
    const { data: content } = await sb
      .from("content_items")
      .select("subject_id, title, type")
      .eq("id", id)
      .maybeSingle();
    if (content) {
      await sb.from("learnings").insert({
        org_id: account.org_id,
        subject_id: content.subject_id,
        category: "rule",
        statement: `「${content.title}」(${content.type})は${action === "reject" ? "投稿しない" : "保留"}と判断された`,
        evidence: "LINEでのユーザー操作",
        status: "pending",
      });
    }
  }

  await replyMessage(replyToken, [
    quickReply(messages[action!], [
      { label: "承認待ちを見る", data: "action=list_pending" },
      { label: "投稿予定を見る", data: "action=list_scheduled" },
    ]),
  ]);
}

// ------------------------------------------------------------- ヘルパー ---
async function replyPendingCards(replyToken: string, subjectId: string) {
  const sb = supabaseAdmin();
  const { data: pending } = await sb
    .from("content_items")
    .select("id,title,summary,type,risk,goal")
    .eq("subject_id", subjectId)
    .eq("status", "pending_approval")
    .order("created_at", { ascending: false })
    .limit(3);

  if (!pending?.length) {
    await replyMessage(replyToken, [textMessage("現在、承認待ちの広報案はありません。")]);
    return;
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
}

async function replyScheduled(replyToken: string, subjectId: string) {
  const sb = supabaseAdmin();
  const { data: posts } = await sb
    .from("posts")
    .select("channel, scheduled_for, body, status")
    .eq("subject_id", subjectId)
    .eq("status", "scheduled")
    .order("scheduled_for")
    .limit(8);

  if (!posts?.length) {
    await replyMessage(replyToken, [textMessage("投稿予定はありません。")]);
    return;
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
}

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
}): Promise<string> {
  const sb = supabaseAdmin();

  const { data: existing, error: readError } = await sb
    .from("intake_items")
    .select("id, raw_text, structured, disclosable")
    .eq("conversation_id", params.conversationId)
    .maybeSingle();
  if (readError) throw readError;

  const previous = existing?.structured ?? {};
  const facts = new Map<string, { key: string; value: string; needs_confirmation?: boolean }>();
  for (const fact of [...(previous.facts ?? []), ...(params.extracted.facts ?? [])]) {
    if (fact?.key) facts.set(fact.key, fact);
  }

  const structured = {
    ...previous,
    summary: params.extracted.summary ?? previous.summary,
    facts: [...facts.values()],
    missing: params.extracted.missing ?? previous.missing ?? [],
    assets: [...new Set([...(previous.assets ?? []), ...params.assetUrls])],
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
    const { error } = await sb
      .from("intake_items")
      .update({
        title: params.extracted.title ?? undefined,
        raw_text: `${existing.raw_text ?? ""}\n${params.rawText}`.trim().slice(0, 8000),
        structured,
        newsworthiness: params.extracted.newsworthiness ?? undefined,
        disclosable: params.extracted.disclosable ?? existing.disclosable,
      })
      .eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data: created, error } = await sb.from("intake_items").insert({
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
  }).select("id").single();
  if (error) throw error;
  if (!created) throw new Error("failed to save intake");
  return created.id;
}
