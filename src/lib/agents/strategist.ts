import { runAgent } from "@/lib/openrouter";
import { buildSubjectContext } from "@/lib/agents/context";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CHANNEL_LABEL, GOAL_LABEL } from "@/lib/constants";

const SYSTEM = `あなたは日本企業の広報戦略を設計する「AIストラテジスト」です。
投稿数を増やすことを目的にしません。企業が達成したい目的から逆算し、
「誰に・何を・どの媒体で・どの行動につなげるか」を決めます。

原則:
- KPIと顧客導線(認知→興味→比較→行動→成約)に接続しない施策は提案しない。
- 公式事実データベースにない数値を前提にした戦略を立てない。
- 競合と同じ切り口は避け、その企業にしか出せない情報資産を使う。
- 発信価値の高い材料がない日は「発信しない」判断も正しい選択として提示する。
出力は指定されたJSON形式のみ。`;

export type StrategyPlan = {
  title: string;
  summary: string;
  goals: Array<{ goal: string; why: string; kpi: string; target: number }>;
  themes: Array<{
    theme: string;
    angle: string;
    audience: string;
    channels: string[];
    content_types: string[];
    priority: number;
  }>;
  channel_plan: Record<string, { role: string; frequency: string; cta: string }>;
  calendar: Array<{ week: number; focus: string; deliverables: string[] }>;
  kpi_plan: Array<{ metric: string; current: number; target: number; how: string }>;
  risks: string[];
};

/** 月間/四半期の広報戦略を設計する。 */
export async function buildStrategy(params: {
  subjectId: string;
  period: string;
  horizon?: "month" | "quarter" | "year";
}): Promise<StrategyPlan> {
  const ctx = await buildSubjectContext(params.subjectId);
  const sb = supabaseAdmin();

  const [{ data: signals }, { data: intake }, { data: lastScore }] = await Promise.all([
    sb
      .from("market_signals")
      .select("kind,title,detail,importance")
      .eq("subject_id", params.subjectId)
      .order("detected_at", { ascending: false })
      .limit(15),
    sb
      .from("intake_items")
      .select("title,kind,summary:raw_text,newsworthiness")
      .eq("subject_id", params.subjectId)
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(20),
    sb
      .from("pr_scores")
      .select("*")
      .eq("subject_id", params.subjectId)
      .order("period", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const user = `${ctx.prompt}

# 市場・競合シグナル
${(signals ?? []).map((s) => `- [${s.kind}/重要度${s.importance}] ${s.title}: ${s.detail ?? ""}`).join("\n") || "(なし)"}

# 未活用の広報材料
${(intake ?? []).map((i) => `- ${i.title} (${i.kind} / ニュース性${i.newsworthiness})`).join("\n") || "(なし)"}

# 前回のAI広報スコア
${lastScore ? JSON.stringify(lastScore) : "(未算出)"}

# 指示
${params.period} の広報戦略を、広報目的から逆算して設計する。対象期間: ${params.horizon ?? "month"}。
弱いスコア項目を改善する施策を必ず含める。

JSONのみを出力:
{
  "title": "戦略のタイトル",
  "summary": "この期間で何を達成するかを3文で",
  "goals": [{"goal":"awareness|traffic|inquiry|booking_purchase|recruiting|seo_aeo|brand|media|reputation","why":"...","kpi":"指標名","target":100}],
  "themes": [{"theme":"発信テーマ","angle":"独自の切り口","audience":"対象顧客","channels":["x","instagram"],"content_types":["case_study"],"priority":1}],
  "channel_plan": {"x":{"role":"認知","frequency":"週3回","cta":"記事へ誘導"}},
  "calendar": [{"week":1,"focus":"...","deliverables":["..."]}],
  "kpi_plan": [{"metric":"問い合わせ数","current":0,"target":10,"how":"..."}],
  "risks": ["..."]
}`;

  const { result } = await runAgent<StrategyPlan>({
    agent: "strategist",
    task: "build_strategy",
    system: SYSTEM,
    user,
    orgId: ctx.orgId,
    subjectId: params.subjectId,
    json: true,
    temperature: 0.6,
    maxTokens: 4000,
    fallback: () => fallbackStrategy(ctx.subjectName, params.period, ctx.goals, ctx.channels),
  });

  return result ?? fallbackStrategy(ctx.subjectName, params.period, ctx.goals, ctx.channels);
}

function fallbackStrategy(
  name: string,
  period: string,
  goals: string[],
  channels: string[],
): StrategyPlan {
  const goal = goals[0] ?? "inquiry";
  return {
    title: `${period} ${name} 広報戦略`,
    summary: `${GOAL_LABEL[goal as keyof typeof GOAL_LABEL] ?? goal}を主目的に、実績と顧客の声を軸とした発信を行います。認知だけで終わらせず、記事とCTAで問い合わせ導線につなげます。効果は週次で検証し、翌週の配分を調整します。`,
    goals: [{ goal, why: "最優先の広報目的", kpi: "問い合わせ数", target: 10 }],
    themes: [
      {
        theme: "導入事例",
        angle: "現場の課題がどう解決したか",
        audience: "検討中の見込み顧客",
        channels: channels.slice(0, 3),
        content_types: ["case_study", "sns_post"],
        priority: 1,
      },
      {
        theme: "サービス活用のヒント",
        angle: "すぐ試せる実務ノウハウ",
        audience: "情報収集段階の担当者",
        channels: channels.slice(0, 2),
        content_types: ["seo_article", "faq"],
        priority: 2,
      },
    ],
    channel_plan: Object.fromEntries(
      channels.map((c) => [
        c,
        { role: "認知と誘導", frequency: "週2回", cta: "記事・問い合わせへ誘導" },
      ]),
    ),
    calendar: [
      { week: 1, focus: "導入事例の制作", deliverables: ["導入事例記事", "SNS投稿3件"] },
      { week: 2, focus: "SEO記事", deliverables: ["SEO記事1件", "FAQ更新"] },
      { week: 3, focus: "顧客の声", deliverables: ["お客様の声投稿", "GBP投稿"] },
      { week: 4, focus: "振り返りと改善", deliverables: ["月次レポート", "CTA改善"] },
    ],
    kpi_plan: [{ metric: "問い合わせ数", current: 0, target: 10, how: "事例記事からのCTA最適化" }],
    risks: ["広報材料の不足", "承認の遅延"],
  };
}

export type DailyDecision = {
  should_post: boolean;
  rationale: string;
  proposals: Array<{
    theme: string;
    reason: string;
    goal: string;
    audience: string;
    channels: string[];
    content_type: string;
    cta: string;
    intake_hint?: string;
    expected_effect: string;
    cautions: string;
    score: number;
    scheduled_for?: string;
  }>;
  alternative_work: string[];
};

/**
 * 「今日、何を発信すべきか」を判断する。
 * 発信価値が低い日は should_post=false とし、代わりに行う作業を返す。
 */
export async function decideToday(subjectId: string): Promise<DailyDecision> {
  const ctx = await buildSubjectContext(subjectId);
  const sb = supabaseAdmin();

  const since = new Date(Date.now() - 14 * 864e5).toISOString();

  const [{ data: intake }, { data: recentPosts }, { data: signals }, { data: strategy }] =
    await Promise.all([
      sb
        .from("intake_items")
        .select("id,title,kind,raw_text,structured,newsworthiness,disclosable,used_count")
        .eq("subject_id", subjectId)
        .eq("status", "new")
        .eq("disclosable", true)
        .order("newsworthiness", { ascending: false })
        .limit(15),
      sb
        .from("posts")
        .select("channel,body,published_at")
        .eq("subject_id", subjectId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(20),
      sb
        .from("market_signals")
        .select("kind,title,importance")
        .eq("subject_id", subjectId)
        .gte("detected_at", since)
        .order("importance", { ascending: false })
        .limit(10),
      sb
        .from("strategies")
        .select("title,summary,themes,channel_plan")
        .eq("subject_id", subjectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const today = new Date().toLocaleDateString("ja-JP", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  });

  const user = `${ctx.prompt}

# 本日
${today}

# 現在の戦略
${strategy ? JSON.stringify(strategy).slice(0, 3000) : "(未策定)"}

# 使える広報材料 (未使用)
${(intake ?? []).map((i) => `- id=${i.id} 「${i.title}」(${i.kind} / ニュース性${i.newsworthiness}) ${String(i.raw_text ?? "").slice(0, 200)}`).join("\n") || "(なし)"}

# 直近14日の投稿
${(recentPosts ?? []).map((p) => `- [${p.channel}] ${String(p.body).slice(0, 60)}`).join("\n") || "(なし)"}

# 市場シグナル
${(signals ?? []).map((s) => `- ${s.title} (重要度${s.importance})`).join("\n") || "(なし)"}

# 指示
本日発信すべきかを判断する。発信価値の高い材料がなければ should_post=false とし、
情報収集・過去記事の改善・顧客導線の見直しなど代替作業を alternative_work に入れる。
発信する場合は最大3件の提案を作る。各提案には必ず「なぜ今日これか」の理由を書く。
使う広報材料があれば intake_hint にその id を入れる。

JSONのみを出力:
{
  "should_post": true,
  "rationale": "判断理由",
  "proposals": [{
    "theme":"発信テーマ","reason":"なぜ今日これを発信するか","goal":"inquiry",
    "audience":"対象顧客","channels":["x","instagram"],"content_type":"case_study",
    "cta":"誘導したい行動","intake_hint":"uuid or null",
    "expected_effect":"期待される効果","cautions":"注意点","score":80,
    "scheduled_for":"2026-01-01T10:00:00+09:00"
  }],
  "alternative_work": ["..."]
}`;

  const { result } = await runAgent<DailyDecision>({
    agent: "strategist",
    task: "decide_today",
    system: SYSTEM,
    user,
    orgId: ctx.orgId,
    subjectId,
    json: true,
    temperature: 0.7,
    maxTokens: 2500,
    fallback: () => fallbackDecision(intake ?? [], ctx.channels, ctx.goals),
  });

  return result ?? fallbackDecision(intake ?? [], ctx.channels, ctx.goals);
}

function fallbackDecision(
  intake: Array<{ id: string; title: string; newsworthiness: number }>,
  channels: string[],
  goals: string[],
): DailyDecision {
  const usable = intake.filter((i) => i.newsworthiness >= 40);
  if (!usable.length) {
    return {
      should_post: false,
      rationale:
        "本日は発信価値の高い新しい広報材料がありません。無理に投稿せず、情報収集と既存記事の改善を優先します。",
      proposals: [],
      alternative_work: [
        "AI秘書によるヒアリングで新しい広報材料を収集",
        "過去記事のSEO・AEO改善",
        "顧客導線(CTA)の見直し",
        "公式事実データベースの再確認",
      ],
    };
  }
  return {
    should_post: true,
    rationale: "未活用の広報材料があり、発信価値が見込めます。",
    proposals: usable.slice(0, 2).map((i, idx) => ({
      theme: i.title,
      reason: "収集済みの広報材料のうちニュース性が高いため",
      goal: goals[0] ?? "inquiry",
      audience: "検討中の見込み顧客",
      channels: channels.slice(0, 2),
      content_type: idx === 0 ? "case_study" : "sns_post",
      cta: "詳細ページへ誘導",
      intake_hint: i.id,
      expected_effect: "検討層の信頼獲得と問い合わせ増加",
      cautions: "固有名詞の公開可否を確認すること",
      score: i.newsworthiness,
    })),
    alternative_work: [],
  };
}

/** 媒体ごとの最適投稿頻度を提案する (AIに任せる設定時)。 */
export async function recommendCadence(subjectId: string): Promise<
  Array<{ channel: string; posts_per_week: number; why: string }>
> {
  const ctx = await buildSubjectContext(subjectId);

  const { result } = await runAgent<{
    cadence: Array<{ channel: string; posts_per_week: number; why: string }>;
  }>({
    agent: "strategist",
    task: "recommend_cadence",
    system: SYSTEM,
    user: `${ctx.prompt}

# 指示
広報目的・KPI・保有する素材の量・過去の成果・季節性・競合・承認の負担を踏まえ、
媒体ごとの最適な投稿頻度を提案する。素材が少ない場合は頻度を下げることも正しい判断。
JSONのみ: {"cadence":[{"channel":"x","posts_per_week":3,"why":"..."}]}`,
    orgId: ctx.orgId,
    subjectId,
    json: true,
    fast: true,
    temperature: 0.5,
    maxTokens: 800,
    fallback: () => ({
      cadence: ctx.channels.map((c) => ({
        channel: c,
        posts_per_week: c === "x" ? 3 : 2,
        why: `${CHANNEL_LABEL[c as keyof typeof CHANNEL_LABEL] ?? c}の標準的な到達頻度`,
      })),
    }),
  });

  return result?.cadence ?? [];
}
