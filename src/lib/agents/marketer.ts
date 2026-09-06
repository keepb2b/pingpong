import { runAgent } from "@/lib/openrouter";
import { buildSubjectContext } from "@/lib/agents/context";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CHANNEL_LABEL, CHANNEL_LIMIT, type ChannelKey } from "@/lib/constants";

const SYSTEM = `あなたは日本企業の広報を成果につなげる「AIマーケター」です。
制作された内容を、媒体・読者・目的・文字数・文化に合わせて作り分けます。

厳守事項:
- 同じ文章を媒体間で使い回さない。冒頭の一文は媒体ごとに必ず変える。
- 文字数上限を必ず守る。
- 1投稿に1つのCTAだけを置く。CTAは「次に取ってほしい具体的な行動」で書く。
- Xは1行目で止める設計、Instagramは共感と保存価値、Facebookは背景と文脈、
  Googleビジネスは地域名と来店/予約導線を重視する。
- 事実の追加・脚色をしない。元の内容にない数値を書かない。
出力は指定されたJSON形式のみ。`;

export type ChannelVariant = {
  channel: ChannelKey;
  body: string;
  hashtags: string[];
  cta: string;
  best_time: string;
  reason: string;
  ab_variant?: string;
};

/** 1つのコンテンツを媒体別に最適化する。 */
export async function adaptToChannels(params: {
  subjectId: string;
  contentId: string;
  channels: ChannelKey[];
  ctaUrl?: string;
  abTest?: boolean;
}): Promise<ChannelVariant[]> {
  const ctx = await buildSubjectContext(params.subjectId);
  const sb = supabaseAdmin();

  const { data: content } = await sb
    .from("content_items")
    .select("title,body,summary,cta,type,goal,keywords")
    .eq("id", params.contentId)
    .single();

  if (!content) throw new Error("content not found");

  const limits = params.channels
    .map((c) => `- ${CHANNEL_LABEL[c]}: ${CHANNEL_LIMIT[c] || "制限なし"}文字`)
    .join("\n");

  const user = `${ctx.prompt}

# 元コンテンツ
種別: ${content.type}
タイトル: ${content.title}
要約: ${content.summary ?? ""}
CTA: ${content.cta ?? ""}
本文:
${String(content.body ?? "").slice(0, 6000)}

# 展開する媒体と文字数上限
${limits}

${params.ctaUrl ? `# CTAリンク\n${params.ctaUrl}\n(本文中に自然に配置する)` : ""}
${params.abTest ? "# A/Bテスト\n各媒体で訴求の異なるB案も作る (ab_variant)。" : ""}

# 指示
媒体ごとに最適化した投稿文を作る。文字数を必ず守る。投稿に最適な曜日・時間帯も提案する。

JSONのみを出力:
{"variants":[{
  "channel":"x","body":"投稿本文","hashtags":["#タグ"],"cta":"CTA文言",
  "best_time":"平日 12:00","reason":"この媒体でこう書いた理由","ab_variant":"B案の本文"
}]}`;

  const { result } = await runAgent<{ variants: ChannelVariant[] }>({
    agent: "marketer",
    task: "adapt_channels",
    system: SYSTEM,
    user,
    orgId: ctx.orgId,
    subjectId: params.subjectId,
    json: true,
    temperature: 0.7,
    maxTokens: 3500,
    fallback: () => ({
      variants: params.channels.map((c) => {
        const limit = CHANNEL_LIMIT[c] || 1000;
        const base = `${content.title}\n\n${content.summary ?? ""}`;
        return {
          channel: c,
          body: base.slice(0, Math.max(60, limit - 40)),
          hashtags: (content.keywords ?? []).slice(0, 3).map((k: string) => `#${k}`),
          cta: content.cta ?? "詳しくはこちら",
          best_time: "平日 12:00",
          reason: "既定の最適化(モデル未接続)",
        };
      }),
    }),
  });

  return (result?.variants ?? []).filter((v) => params.channels.includes(v.channel));
}

/** 顧客導線(CTA〜成約)の設計と改善提案。 */
export async function designFunnel(params: {
  subjectId: string;
  goal: string;
}): Promise<{
  stages: Array<{ stage: string; channel: string; asset: string; metric: string; target: number }>;
  gaps: string[];
  recommendations: Array<{ action: string; why: string; expected_lift: string }>;
}> {
  const ctx = await buildSubjectContext(params.subjectId);
  const sb = supabaseAdmin();

  const { data: conversions } = await sb
    .from("conversions")
    .select("type, channel")
    .eq("subject_id", params.subjectId)
    .gte("occurred_at", new Date(Date.now() - 30 * 864e5).toISOString());

  const counts: Record<string, number> = {};
  for (const c of conversions ?? []) counts[c.type] = (counts[c.type] ?? 0) + 1;

  const { result } = await runAgent<{
    stages: Array<{ stage: string; channel: string; asset: string; metric: string; target: number }>;
    gaps: string[];
    recommendations: Array<{ action: string; why: string; expected_lift: string }>;
  }>({
    agent: "marketer",
    task: "design_funnel",
    system: SYSTEM,
    user: `${ctx.prompt}

# 広報目的
${params.goal}

# 直近30日の実績 (種別: 件数)
${Object.entries(counts).map(([k, v]) => `- ${k}: ${v}`).join("\n") || "(なし)"}

# 指示
「投稿を見る→記事を読む→CTAをクリック→問い合わせ・予約→購入・成約」の顧客導線を設計し、
実績が落ちている箇所(離脱点)を特定して改善策を出す。

JSONのみ:
{"stages":[{"stage":"投稿を見る","channel":"x","asset":"SNS投稿","metric":"impressions","target":10000}],
 "gaps":["どの段階で落ちているか"],
 "recommendations":[{"action":"...","why":"...","expected_lift":"..."}]}`,
    orgId: ctx.orgId,
    subjectId: params.subjectId,
    json: true,
    temperature: 0.5,
    maxTokens: 2000,
    fallback: () => ({
      stages: [
        { stage: "投稿を見る", channel: "x", asset: "SNS投稿", metric: "impressions", target: 10000 },
        { stage: "記事を読む", channel: "site", asset: "記事", metric: "pageviews", target: 500 },
        { stage: "CTAをクリック", channel: "site", asset: "CTA", metric: "cta_click", target: 50 },
        { stage: "問い合わせ・予約", channel: "site", asset: "フォーム", metric: "inquiry", target: 10 },
        { stage: "購入・成約", channel: "site", asset: "商談", metric: "contract", target: 3 },
      ],
      gaps: ["計測データが不足しています"],
      recommendations: [
        { action: "投稿に専用リンクを設定する", why: "導線が計測できていないため", expected_lift: "改善余地の可視化" },
      ],
    }),
  });

  return (
    result ?? { stages: [], gaps: [], recommendations: [] }
  );
}

/** コメント・口コミへの返信案を作る。 */
export async function draftReply(params: {
  subjectId: string;
  mentionId: string;
}): Promise<{
  draft: string;
  sentiment: string;
  urgency: number;
  flare_risk: string;
  needs_human: boolean;
  reason: string;
}> {
  const ctx = await buildSubjectContext(params.subjectId);
  const sb = supabaseAdmin();

  const { data: mention } = await sb
    .from("mentions")
    .select("source,author,body,rating,url")
    .eq("id", params.mentionId)
    .single();

  if (!mention) throw new Error("mention not found");

  const { result } = await runAgent<{
    draft: string;
    sentiment: string;
    urgency: number;
    flare_risk: string;
    needs_human: boolean;
    reason: string;
  }>({
    agent: "marketer",
    task: "draft_reply",
    system: `${SYSTEM}

返信案の作成では次を守ります:
- 感情・緊急度・炎上リスクを判定する。
- 事実関係が確認できない指摘には、断定も否定もせず確認を約束する。
- 法的責任・重大なクレーム・事故・情報漏洩・炎上の可能性があれば needs_human=true。
- 謝罪が必要な場合は、何に対する謝罪かを明確にする。`,
    user: `${ctx.prompt}

# 対象のコメント/口コミ
媒体: ${mention.source}
投稿者: ${mention.author ?? "不明"}
評価: ${mention.rating ?? "なし"}
本文: ${mention.body}

# 指示
返信案を作り、感情/緊急度/炎上リスクを判定する。
JSONのみ:
{"draft":"返信案","sentiment":"positive|neutral|negative","urgency":1,
 "flare_risk":"none|low|medium|high|critical","needs_human":false,"reason":"判定理由"}`,
    orgId: ctx.orgId,
    subjectId: params.subjectId,
    json: true,
    temperature: 0.4,
    maxTokens: 1200,
    fallback: () => ({
      draft: "この度はご意見をいただきありがとうございます。内容を確認し、担当者よりご連絡いたします。",
      sentiment: (mention.rating ?? 3) >= 4 ? "positive" : (mention.rating ?? 3) <= 2 ? "negative" : "neutral",
      urgency: (mention.rating ?? 3) <= 2 ? 3 : 1,
      flare_risk: (mention.rating ?? 3) <= 2 ? "medium" : "none",
      needs_human: (mention.rating ?? 3) <= 2,
      reason: "モデル未接続のため既定判定",
    }),
  });

  return (
    result ?? {
      draft: "内容を確認のうえ、担当者よりご連絡いたします。",
      sentiment: "neutral",
      urgency: 1,
      flare_risk: "none",
      needs_human: true,
      reason: "生成に失敗しました",
    }
  );
}
