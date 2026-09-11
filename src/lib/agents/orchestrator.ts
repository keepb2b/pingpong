import { supabaseAdmin } from "@/lib/supabase/admin";
import { decideToday, buildStrategy } from "@/lib/agents/strategist";
import { writeContent } from "@/lib/agents/writer";
import { adaptToChannels } from "@/lib/agents/marketer";
import { factCheck, explainScore, monthlyReview } from "@/lib/agents/analyst";
import { generateCreative } from "@/lib/agents/creator";
import { computeScore, periodRange } from "@/lib/scoring";
import { createTrackingLink, appUrl } from "@/lib/tracking";
import { publishToChannel } from "@/lib/publishers";
import {
  isLineConfigured,
  pushMessage,
  proposalFlex,
  reportFlex,
  textMessage,
} from "@/lib/line";
import {
  CHANNELS,
  CHANNEL_LABEL,
  CONTENT_TYPES,
  GOALS,
  GOAL_LABEL,
  SCORE_DIMENSIONS,
  type ChannelKey,
  type ContentTypeKey,
  type GoalKey,
} from "@/lib/constants";

const RISK_ORDER = ["none", "low", "medium", "high", "critical"];

// ---------------------------------------------------------------- 通知 -----
export async function notify(params: {
  orgId: string;
  subjectId?: string | null;
  kind?: string;
  title: string;
  body?: string;
  link?: string;
  agent?: string;
  toLine?: boolean;
  lineMessage?: Record<string, unknown>;
}) {
  const sb = supabaseAdmin();
  let sent = false;

  if (params.toLine && isLineConfigured()) {
    const { data: accounts } = await sb
      .from("line_accounts")
      .select("line_user_id")
      .eq("org_id", params.orgId);

    for (const a of accounts ?? []) {
      try {
        await pushMessage(a.line_user_id, [
          params.lineMessage ?? textMessage(`【${params.title}】\n${params.body ?? ""}`),
        ]);
        sent = true;
      } catch {
        // 個別の送信失敗は通知全体を止めない
      }
    }
  }

  await sb.from("notifications").insert({
    org_id: params.orgId,
    subject_id: params.subjectId ?? null,
    kind: params.kind ?? "info",
    title: params.title,
    body: params.body ?? null,
    link: params.link ?? null,
    agent: params.agent ?? null,
    sent_to_line: sent,
  });
}

async function audit(params: {
  orgId: string;
  action: string;
  entity?: string;
  entityId?: string;
  actor?: string | null;
  actorKind?: string;
  detail?: Record<string, unknown>;
}) {
  await supabaseAdmin()
    .from("audit_logs")
    .insert({
      org_id: params.orgId,
      actor: params.actor ?? null,
      actor_kind: params.actorKind ?? "ai",
      action: params.action,
      entity: params.entity ?? null,
      entity_id: params.entityId ?? null,
      detail: params.detail ?? {},
    });
}

// ------------------------------------------------------------ 日次循環 -----
/**
 * 毎日の広報活動。
 * 危機広報モード中は一切発信せず、発信価値が低い日は提案を作らない。
 */
export async function runDailyCycle(subjectId: string): Promise<{
  posted: boolean;
  rationale: string;
  proposalIds: string[];
  alternativeWork: string[];
  skipped?: string;
}> {
  const sb = supabaseAdmin();

  const { data: subject } = await sb
    .from("subjects")
    .select("id, org_id, name, active")
    .eq("id", subjectId)
    .single();

  if (!subject?.active) {
    return { posted: false, rationale: "対象が停止中です", proposalIds: [], alternativeWork: [], skipped: "inactive" };
  }

  // 危機広報モードの確認 — 緊急時に通常の宣伝投稿を出さない
  const { data: crisis } = await sb
    .from("crisis_incidents")
    .select("id,title")
    .eq("subject_id", subjectId)
    .in("status", ["open", "containing"])
    .eq("posts_paused", true)
    .limit(1)
    .maybeSingle();

  if (crisis) {
    return {
      posted: false,
      rationale: `危機広報モード(${crisis.title})のため通常の発信を停止しています。`,
      proposalIds: [],
      alternativeWork: ["事実関係の確認", "公式声明の準備", "問い合わせ対応"],
      skipped: "crisis",
    };
  }

  const decision = await decideToday(subjectId);

  if (!decision.should_post || !decision.proposals?.length) {
    await notify({
      orgId: subject.org_id,
      subjectId,
      kind: "info",
      agent: "strategist",
      title: "本日は発信を見送ります",
      body: `${decision.rationale}\n\n代わりに実施すること:\n${(decision.alternative_work ?? []).map((w) => `・${w}`).join("\n")}`,
    });
    return {
      posted: false,
      rationale: decision.rationale,
      proposalIds: [],
      alternativeWork: decision.alternative_work ?? [],
    };
  }

  const proposalIds: string[] = [];

  for (const p of decision.proposals.slice(0, 3)) {
    const intakeId = isUuid(p.intake_hint) ? p.intake_hint : null;

    const { data: proposal } = await sb
      .from("proposals")
      .insert({
        org_id: subject.org_id,
        subject_id: subjectId,
        intake_item_id: intakeId,
        theme: String(p.theme ?? "本日の発信").slice(0, 500) || "本日の発信",
        reason: String(p.reason ?? "戦略判断").slice(0, 2000) || "戦略判断",
        goal: coerceGoal(p.goal),
        audience: p.audience,
        channels: coerceChannels(p.channels),
        cta: p.cta,
        scheduled_for: p.scheduled_for ?? null,
        expected_effect: p.expected_effect,
        cautions: p.cautions,
        score: p.score ?? 50,
        status: "proposed",
      })
      .select("id")
      .single();

    if (!proposal) continue;
    proposalIds.push(proposal.id);

    // 提案からコンテンツ制作 → リスク確認 → 承認待ちまで一気に進める
    try {
      await produceFromProposal({
        proposalId: proposal.id,
        contentType: coerceContentType(p.content_type),
      });
    } catch (err) {
      await notify({
        orgId: subject.org_id,
        subjectId,
        kind: "error",
        title: "コンテンツ制作に失敗しました",
        body:
          err instanceof Error
            ? err.message
            : String(err),
      });
    }
  }

  await audit({
    orgId: subject.org_id,
    action: "daily_cycle",
    entity: "subject",
    entityId: subjectId,
    detail: { proposals: proposalIds.length, rationale: decision.rationale },
  });

  return {
    posted: true,
    rationale: decision.rationale,
    proposalIds,
    alternativeWork: decision.alternative_work ?? [],
  };
}

function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

const CONTENT_TYPE_KEYS = new Set(CONTENT_TYPES.map((t) => t.key));
const GOAL_KEYS = new Set(GOALS.map((g) => g.key));
const CHANNEL_KEYS = new Set(CHANNELS.map((c) => c.key));

export function coerceContentType(value: unknown): ContentTypeKey {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (CONTENT_TYPE_KEYS.has(raw as ContentTypeKey)) return raw as ContentTypeKey;
  if (/instagram|twitter|x\b|sns|social/.test(raw)) return "sns_post";
  if (/case|事例/.test(raw)) return "case_study";
  if (/press|リリース/.test(raw)) return "press_release";
  if (/seo|article|blog|記事/.test(raw)) return "seo_article";
  if (/faq/.test(raw)) return "faq";
  if (/gbp|google/.test(raw)) return "gbp_post";
  if (/news/.test(raw)) return "news";
  return "sns_post";
}

function coerceGoal(value: unknown): GoalKey | null {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (GOAL_KEYS.has(raw as GoalKey)) return raw as GoalKey;
  if (/inquir|問合|問い合わせ/.test(raw)) return "inquiry";
  if (/aware|認知/.test(raw)) return "awareness";
  if (/book|purchase|予約|購入/.test(raw)) return "booking_purchase";
  return null;
}

function coerceChannels(value: unknown): ChannelKey[] {
  const list = Array.isArray(value) ? value : [];
  const out = list
    .map((c) => String(c).trim().toLowerCase())
    .filter((c): c is ChannelKey => CHANNEL_KEYS.has(c as ChannelKey));
  return out.length ? out : (["x"] as ChannelKey[]);
}

function asTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).trim()).filter(Boolean).slice(0, 30);
}

// -------------------------------------------------- 提案 → 制作 → 検査 ----
/**
 * AIライターが本文を書き、AIマーケターが媒体別に最適化し、
 * AIクリエイターが画像を作り、AIアナリストがファクトチェックする。
 */
export async function produceFromProposal(params: {
  proposalId: string;
  contentType?: ContentTypeKey;
}): Promise<{ contentId: string; risk: string; blocked: boolean }> {
  const sb = supabaseAdmin();

  const { data: proposal } = await sb
    .from("proposals")
    .select("*")
    .eq("id", params.proposalId)
    .single();

  if (!proposal) throw new Error("proposal not found");

  const type = coerceContentType(params.contentType ?? "sns_post");
  const goal = coerceGoal(proposal.goal);

  // 1) AIライター
  const written = await writeContent({
    subjectId: proposal.subject_id,
    type,
    theme: proposal.theme || "本日の発信",
    audience: proposal.audience ?? undefined,
    goal: goal ?? undefined,
    cta: proposal.cta ?? undefined,
    intakeItemId: proposal.intake_item_id,
  });

  const title = String(written.title || proposal.theme || "無題").trim() || "無題";
  const { data: content, error: insertError } = await sb
    .from("content_items")
    .insert({
      org_id: proposal.org_id,
      subject_id: proposal.subject_id,
      proposal_id: proposal.id,
      type,
      title,
      body: String(written.body ?? ""),
      summary: written.summary ? String(written.summary) : null,
      keywords: asTextArray(written.keywords),
      cta: written.cta ? String(written.cta) : null,
      goal,
      status: "fact_check",
      created_by: "writer",
    })
    .select("id")
    .single();

  if (insertError || !content) {
    console.error("[content_items insert]", {
      message: insertError?.message,
      code: insertError?.code,
      details: insertError?.details,
      hint: insertError?.hint,
      type,
      goal,
      title,
    });
    throw new Error(insertError?.message ?? "failed to create content");
  }

  // 2) 計測用の専用リンク
  const { data: subject } = await sb
    .from("subjects")
    .select("website")
    .eq("id", proposal.subject_id)
    .maybeSingle();

  let ctaUrl: string | undefined;
  try {
    const link = await createTrackingLink({
      orgId: proposal.org_id,
      subjectId: proposal.subject_id,
      contentId: content.id,
      targetUrl: subject?.website || appUrl("/"),
      campaign: proposal.theme,
    });
    ctaUrl = link.url;
    await sb.from("content_items").update({ cta_url: ctaUrl }).eq("id", content.id);
  } catch {
    // 計測リンクが作れなくても制作は続行する
  }

  // 3) AIマーケター — 媒体別最適化
  const channels = (proposal.channels ?? []) as ChannelKey[];
  if (channels.length) {
    try {
      const variants = await adaptToChannels({
        subjectId: proposal.subject_id,
        contentId: content.id,
        channels,
        ctaUrl,
        abTest: true,
      });

      for (const v of variants) {
        await sb.from("content_variants").insert({
          org_id: proposal.org_id,
          content_id: content.id,
          channel: v.channel,
          body: v.body,
          hashtags: v.hashtags ?? [],
          cta: v.cta,
          char_count: v.body?.length ?? 0,
          optimized_for: v.reason,
          ab_group: "A",
        });
        if (v.ab_variant) {
          await sb.from("content_variants").insert({
            org_id: proposal.org_id,
            content_id: content.id,
            channel: v.channel,
            body: v.ab_variant,
            hashtags: v.hashtags ?? [],
            cta: v.cta,
            char_count: v.ab_variant.length,
            optimized_for: "A/Bテスト B案",
            ab_group: "B",
          });
        }
      }
    } catch {
      // 媒体別最適化の失敗は制作全体を止めない
    }
  }

  // 4) AIクリエイター — ビジュアル
  try {
    const visualChannel = channels.find((c) => ["instagram", "x", "facebook", "gbp"].includes(c));
    const creative = await generateCreative({
      subjectId: proposal.subject_id,
      contentId: content.id,
      channel: visualChannel,
      kind: "sns_image",
    });
    await sb.from("creatives").insert({
      org_id: proposal.org_id,
      subject_id: proposal.subject_id,
      content_id: content.id,
      kind: "sns_image",
      channel: visualChannel ?? null,
      width: creative.width,
      height: creative.height,
      prompt: creative.spec.reason,
      svg: creative.svg,
      palette: creative.spec.palette,
      status: "draft",
    });
  } catch {
    // 画像がなくてもテキスト投稿は成立する
  }

  // 5) AIアナリスト — ファクトチェックとリスク判定
  const check = await factCheck({ subjectId: proposal.subject_id, contentId: content.id });

  await sb.from("risk_checks").insert({
    org_id: proposal.org_id,
    content_id: content.id,
    overall: check.overall,
    passed: check.passed,
    findings: check.findings,
    unverified_claims: check.unverified_claims,
    blocked: check.blocked,
    checked_by: "analyst",
  });

  const nextStatus = check.blocked ? "on_hold" : "pending_approval";
  await sb
    .from("content_items")
    .update({ status: nextStatus, risk: check.overall })
    .eq("id", content.id);

  await sb.from("proposals").update({ status: "produced" }).eq("id", proposal.id);

  if (proposal.intake_item_id) {
    const { data: item } = await sb
      .from("intake_items")
      .select("used_count")
      .eq("id", proposal.intake_item_id)
      .maybeSingle();
    await sb
      .from("intake_items")
      .update({ status: "used", used_count: (item?.used_count ?? 0) + 1 })
      .eq("id", proposal.intake_item_id);
  }

  // 6) 承認依頼 (自動投稿が許可されていれば承認をスキップ)
  const auto = await canAutoPublish(proposal.subject_id, channels, check.overall);

  if (check.blocked) {
    await notify({
      orgId: proposal.org_id,
      subjectId: proposal.subject_id,
      kind: "risk",
      agent: "analyst",
      title: "重大なリスクを検出したため投稿を停止しました",
      body: `${written.title}\n\n${check.summary}\n\n${check.findings.slice(0, 3).map((f) => `・${f.problem}`).join("\n")}`,
      link: appUrl(`/dashboard/content/${content.id}`),
      toLine: true,
    });
  } else if (auto) {
    await approveContent({
      contentId: content.id,
      action: "approve",
      via: "auto",
      comment: "自動投稿設定により承認",
    });
  } else {
    await notify({
      orgId: proposal.org_id,
      subjectId: proposal.subject_id,
      kind: "approval",
      agent: "secretary",
      title: "広報案のご確認をお願いします",
      link: appUrl(`/dashboard/content/${content.id}`),
      toLine: true,
      lineMessage: proposalFlex(
        {
          id: content.id,
          theme: written.title,
          reason: proposal.reason,
          goal: GOAL_LABEL[proposal.goal as keyof typeof GOAL_LABEL] ?? proposal.goal ?? "—",
          audience: proposal.audience ?? "—",
          channels: channels.map((c) => CHANNEL_LABEL[c] ?? c),
          cta: written.cta ?? proposal.cta ?? "—",
          scheduledFor: proposal.scheduled_for
            ? new Date(proposal.scheduled_for).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
            : undefined,
          expectedEffect: proposal.expected_effect ?? "—",
          cautions: [proposal.cautions, check.findings.length ? `${check.findings.length}件の確認事項` : ""]
            .filter(Boolean)
            .join(" / "),
          bodyPreview: written.summary || String(written.body ?? "").slice(0, 200),
          risk: check.overall !== "none" ? check.overall : undefined,
        },
        appUrl(),
      ),
    });
  }

  return { contentId: content.id, risk: check.overall, blocked: check.blocked };
}

/** 媒体ごとの自動投稿許可とリスク上限を照合する。 */
async function canAutoPublish(
  subjectId: string,
  channels: ChannelKey[],
  risk: string,
): Promise<boolean> {
  if (!channels.length) return false;
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("channels")
    .select("type, auto_publish, auto_publish_max_risk")
    .eq("subject_id", subjectId)
    .in("type", channels);

  if (!data?.length) return false;
  // すべての対象媒体で自動投稿が許可され、リスクが上限以下の場合のみ
  return data.every(
    (c) =>
      c.auto_publish &&
      RISK_ORDER.indexOf(risk) <= RISK_ORDER.indexOf(c.auto_publish_max_risk ?? "low"),
  );
}

// ------------------------------------------------------------- 承認 -------
export async function approveContent(params: {
  contentId: string;
  action: "approve" | "revise" | "hold" | "reject";
  userId?: string | null;
  comment?: string;
  via?: string;
}): Promise<{ status: string; scheduledPosts: number }> {
  const sb = supabaseAdmin();

  const { data: content } = await sb
    .from("content_items")
    .select("id, org_id, subject_id, title, body, cta, cta_url, type, proposal_id, status")
    .eq("id", params.contentId)
    .single();

  if (!content) throw new Error("content not found");

  await sb.from("approvals").insert({
    org_id: content.org_id,
    content_id: content.id,
    action: params.action,
    comment: params.comment ?? null,
    acted_by: params.userId ?? null,
    acted_via: params.via ?? "dashboard",
    acted_at: new Date().toISOString(),
  });

  const statusMap = {
    approve: "approved",
    revise: "draft",
    hold: "on_hold",
    reject: "rejected",
  } as const;

  const status = statusMap[params.action];
  await sb.from("content_items").update({ status }).eq("id", content.id);

  if (content.proposal_id) {
    await sb
      .from("proposals")
      .update({
        status: params.action === "approve" ? "approved" : params.action,
        decided_at: new Date().toISOString(),
        decided_by: params.userId ?? null,
      })
      .eq("id", content.proposal_id);
  }

  await audit({
    orgId: content.org_id,
    action: `content_${params.action}`,
    entity: "content_items",
    entityId: content.id,
    actor: params.userId ?? null,
    actorKind: params.via === "auto" ? "ai" : "user",
    detail: { comment: params.comment },
  });

  if (params.action !== "approve") return { status, scheduledPosts: 0 };

  const scheduled = await schedulePosts(content.id);
  return { status, scheduledPosts: scheduled };
}

/** 承認済みコンテンツを媒体別に投稿予約する。 */
export async function schedulePosts(contentId: string): Promise<number> {
  const sb = supabaseAdmin();

  const { data: content } = await sb
    .from("content_items")
    .select("id, org_id, subject_id, title, body, proposal_id")
    .eq("id", contentId)
    .single();
  if (!content) return 0;

  const [{ data: variants }, { data: proposal }, { data: creative }] = await Promise.all([
    sb.from("content_variants").select("*").eq("content_id", contentId).eq("ab_group", "A"),
    content.proposal_id
      ? sb.from("proposals").select("scheduled_for, channels").eq("id", content.proposal_id).maybeSingle()
      : Promise.resolve({ data: null }),
    sb.from("creatives").select("url, svg").eq("content_id", contentId).limit(1).maybeSingle(),
  ]);

  const when = proposal?.scheduled_for ? new Date(proposal.scheduled_for) : new Date(Date.now() + 60_000);
  const assetUrls = creative?.url ? [creative.url] : [];

  let count = 0;
  for (const v of variants ?? []) {
    const { data: channelRow } = await sb
      .from("channels")
      .select("id")
      .eq("subject_id", content.subject_id)
      .eq("type", v.channel)
      .maybeSingle();

    const { data: post } = await sb
      .from("posts")
      .insert({
        org_id: content.org_id,
        subject_id: content.subject_id,
        content_id: content.id,
        variant_id: v.id,
        channel_id: channelRow?.id ?? null,
        channel: v.channel,
        body: v.body,
        asset_urls: assetUrls,
        scheduled_for: when.toISOString(),
        status: "scheduled",
      })
      .select("id")
      .single();

    if (post) {
      count++;
      // 媒体別に専用リンクを分けて、どの媒体が成果に効いたかを判別できるようにする
      try {
        const { data: subject } = await sb
          .from("subjects")
          .select("website")
          .eq("id", content.subject_id)
          .maybeSingle();
        await createTrackingLink({
          orgId: content.org_id,
          subjectId: content.subject_id,
          contentId: content.id,
          postId: post.id,
          channel: v.channel as ChannelKey,
          targetUrl: subject?.website || appUrl("/"),
        });
      } catch {
        // 計測リンクの失敗で投稿予約は取り消さない
      }
    }
  }

  await sb.from("content_items").update({ status: "scheduled" }).eq("id", contentId);
  return count;
}

/** 予約時刻を過ぎた投稿を実際に配信する。 */
export async function publishDuePosts(limit = 25): Promise<{
  published: number;
  failed: number;
  results: Array<{ id: string; channel: string; ok: boolean; error?: string }>;
}> {
  const sb = supabaseAdmin();

  const { data: due } = await sb
    .from("posts")
    .select("id, org_id, subject_id, channel, channel_id, body, asset_urls, content_id")
    .eq("status", "scheduled")
    .lte("scheduled_for", new Date().toISOString())
    .limit(limit);

  const results: Array<{ id: string; channel: string; ok: boolean; error?: string }> = [];
  let published = 0;
  let failed = 0;

  for (const post of due ?? []) {
    // 危機広報モード中の媒体は配信しない
    const { data: crisis } = await sb
      .from("crisis_incidents")
      .select("id")
      .eq("subject_id", post.subject_id)
      .in("status", ["open", "containing"])
      .eq("posts_paused", true)
      .limit(1)
      .maybeSingle();

    if (crisis) {
      await sb
        .from("posts")
        .update({ status: "on_hold", error: "危機広報モードのため配信を保留しました" })
        .eq("id", post.id);
      results.push({ id: post.id, channel: post.channel, ok: false, error: "危機広報モード" });
      continue;
    }

    let credentials: Record<string, string> = {};
    if (post.channel_id) {
      const { data: ch } = await sb
        .from("channels")
        .select("credentials")
        .eq("id", post.channel_id)
        .maybeSingle();
      credentials = (ch?.credentials ?? {}) as Record<string, string>;
    }

    const { data: content } = post.content_id
      ? await sb.from("content_items").select("title").eq("id", post.content_id).maybeSingle()
      : { data: null };

    const res = await publishToChannel({
      channel: post.channel as ChannelKey,
      body: post.body,
      title: content?.title,
      assetUrls: post.asset_urls ?? [],
      credentials,
    });

    if (res.ok) {
      published++;
      await sb
        .from("posts")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          external_id: res.externalId ?? null,
          external_url: res.externalUrl ?? null,
          error: null,
        })
        .eq("id", post.id);
      if (post.content_id) {
        await sb.from("content_items").update({ status: "published" }).eq("id", post.content_id);
      }
    } else {
      failed++;
      await sb.from("posts").update({ status: "failed", error: res.error ?? "unknown" }).eq("id", post.id);
    }

    results.push({ id: post.id, channel: post.channel, ok: res.ok, error: res.error });
  }

  return { published, failed, results };
}

// ------------------------------------------------------- 月次AI広報会議 ---
export async function runMonthlyReview(
  subjectId: string,
  period: string,
): Promise<{ scoreTotal: number; reportId: string | null }> {
  const sb = supabaseAdmin();

  const { data: subject } = await sb
    .from("subjects")
    .select("org_id, name")
    .eq("id", subjectId)
    .single();
  if (!subject) throw new Error("subject not found");

  // 1) スコア算出 (決定的) → 根拠と改善策を言語化
  const score = await computeScore(subjectId, period);
  const explained = await explainScore({
    subjectId,
    period,
    scores: score.scores,
    evidence: score.evidence,
  });

  await sb.from("pr_scores").upsert(
    {
      org_id: subject.org_id,
      subject_id: subjectId,
      period,
      total: score.total,
      ...score.scores,
      rationale: explained.rationale,
      improvements: explained.improvements,
    },
    { onConflict: "subject_id,period" },
  );

  // 2) 月次レポート
  const { from, to } = periodRange(period);
  const [{ data: posts }, { data: content }, { data: conversions }, { data: signals }, { data: learnings }] =
    await Promise.all([
      sb
        .from("posts")
        .select("channel,status,published_at")
        .eq("subject_id", subjectId)
        .gte("created_at", from.toISOString())
        .lt("created_at", to.toISOString()),
      sb
        .from("content_items")
        .select("id,title,type,status")
        .eq("subject_id", subjectId)
        .gte("created_at", from.toISOString())
        .lt("created_at", to.toISOString()),
      sb
        .from("conversions")
        .select("type,amount,channel")
        .eq("subject_id", subjectId)
        .gte("occurred_at", from.toISOString())
        .lt("occurred_at", to.toISOString()),
      sb
        .from("market_signals")
        .select("kind,title,importance")
        .eq("subject_id", subjectId)
        .gte("detected_at", from.toISOString())
        .lt("detected_at", to.toISOString()),
      sb
        .from("learnings")
        .select("statement,status")
        .eq("subject_id", subjectId)
        .gte("created_at", from.toISOString())
        .lt("created_at", to.toISOString()),
    ]);

  const report = await monthlyReview({
    subjectId,
    period,
    data: {
      score: score.scores,
      total: score.total,
      evidence: score.evidence,
      posts,
      content,
      conversions,
      signals,
      learnings,
      improvements: explained.improvements,
    },
  });

  const { data: saved } = await sb
    .from("monthly_reports")
    .upsert(
      {
        org_id: subject.org_id,
        subject_id: subjectId,
        period,
        summary: (report.summary as string) ?? null,
        activities: report.activities ?? [],
        kpi_status: report.kpi_status ?? [],
        top_content: report.top_content ?? [],
        wins: report.wins ?? [],
        losses: report.losses ?? [],
        funnel_issues: report.funnel_issues ?? [],
        market_changes: report.market_changes ?? [],
        learnings: report.learnings ?? [],
        next_strategy: report.next_strategy ?? {},
        recommended_campaigns: report.recommended_campaigns ?? [],
        needed_materials: report.needed_materials ?? [],
        expected_impact: (report.expected_impact as string) ?? null,
        status: "draft",
      },
      { onConflict: "subject_id,period" },
    )
    .select("id")
    .single();

  // 3) 翌月の戦略を用意しておく
  try {
    const next = nextPeriod(period);
    const plan = await buildStrategy({ subjectId, period: next });
    await sb.from("strategies").insert({
      org_id: subject.org_id,
      subject_id: subjectId,
      period: next,
      title: plan.title,
      summary: plan.summary,
      goals: plan.goals ?? [],
      themes: plan.themes ?? [],
      channel_plan: plan.channel_plan ?? {},
      calendar: plan.calendar ?? [],
      kpi_plan: plan.kpi_plan ?? [],
      status: "draft",
    });
  } catch {
    // 戦略生成の失敗でレポート自体は無効にしない
  }

  const weakest = SCORE_DIMENSIONS.map((d) => ({ label: d.label, value: score.scores[d.key] }))
    .sort((a, b) => a.value - b.value)
    .slice(0, 3);

  await notify({
    orgId: subject.org_id,
    subjectId,
    kind: "report",
    agent: "analyst",
    title: `${period} 月次AI広報会議`,
    body: (report.summary as string) ?? "",
    link: appUrl(`/dashboard/reports`),
    toLine: true,
    lineMessage: reportFlex({
      period,
      total: score.total,
      highlights: [
        ...(explained.improvements ?? []).slice(0, 2).map((i) => i.action),
        ...weakest.map((w) => `${w.label}: ${w.value}点`),
      ],
      url: appUrl("/dashboard/reports"),
    }),
  });

  return { scoreTotal: score.total, reportId: saved?.id ?? null };
}

export function nextPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
