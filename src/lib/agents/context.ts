import { supabaseAdmin } from "@/lib/supabase/admin";
import { CHANNEL_LABEL, GOAL_LABEL } from "@/lib/constants";

export type SubjectContext = {
  orgId: string;
  subjectId: string;
  subjectName: string;
  prompt: string;
  facts: Array<{ id: string; key: string; value: string; category: string; status: string }>;
  bannedWords: string[];
  bannedExpressions: string[];
  channels: string[];
  goals: string[];
};

/**
 * Assembles everything the AI広報部 knows about one 広報対象 into a single
 * prompt block: カルテ / 公式事実 / ブランド人格 / ターゲット / 競合 /
 * 目的・KPI / 学習内容 / 直近の成果.
 */
export async function buildSubjectContext(
  subjectId: string,
): Promise<SubjectContext> {
  const sb = supabaseAdmin();

  const { data: subject } = await sb
    .from("subjects")
    .select("id, org_id, name, type, description, website")
    .eq("id", subjectId)
    .single();

  if (!subject) throw new Error(`subject ${subjectId} not found`);

  const [
    karte,
    voice,
    personas,
    competitors,
    facts,
    objectives,
    kpis,
    learnings,
    channels,
    recentContent,
    topPerformers,
  ] = await Promise.all([
    sb.from("karte_sections").select("key,label,content,data").eq("subject_id", subjectId),
    sb.from("brand_voice").select("*").eq("subject_id", subjectId).maybeSingle(),
    sb.from("personas").select("name,segment,role,pains,gains,channels").eq("subject_id", subjectId),
    sb.from("competitors").select("name,positioning,strengths,weaknesses").eq("subject_id", subjectId),
    sb
      .from("official_facts")
      .select("id,category,key,value,status,visibility,verified_at,expires_at")
      .eq("subject_id", subjectId)
      .order("category"),
    sb.from("pr_objectives").select("goal,priority,description").eq("subject_id", subjectId).eq("active", true).order("priority"),
    sb.from("kpis").select("name,metric,target_value,current_value,unit,period").eq("subject_id", subjectId),
    sb
      .from("learnings")
      .select("statement,category,status,corrected_to")
      .eq("subject_id", subjectId)
      .in("status", ["confirmed", "long_term", "corrected"]),
    sb.from("channels").select("type,frequency_mode,frequency_count,auto_publish,connected").eq("subject_id", subjectId),
    sb
      .from("content_items")
      .select("title,type,status,created_at")
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: false })
      .limit(12),
    sb
      .from("metrics_daily")
      .select("content_id,channel,impressions,engagements,clicks,pageviews")
      .eq("subject_id", subjectId)
      .order("day", { ascending: false })
      .limit(40),
  ]);

  const lines: string[] = [];

  lines.push(`# 広報対象`);
  lines.push(`名称: ${subject.name}`);
  lines.push(`種別: ${subject.type}`);
  if (subject.description) lines.push(`概要: ${subject.description}`);
  if (subject.website) lines.push(`Web: ${subject.website}`);

  if (karte.data?.length) {
    lines.push(`\n# AI広報カルテ`);
    for (const k of karte.data) {
      const extra =
        k.data && Object.keys(k.data as object).length
          ? ` / 補足: ${JSON.stringify(k.data)}`
          : "";
      if (k.content || extra) lines.push(`- ${k.label}: ${k.content ?? ""}${extra}`);
    }
  }

  const v = voice.data;
  if (v) {
    lines.push(`\n# ブランド人格・文章トーン`);
    if (v.persona) lines.push(`人格: ${v.persona}`);
    if (v.tone?.length) lines.push(`トーン: ${v.tone.join(" / ")}`);
    if (v.first_person) lines.push(`一人称: ${v.first_person}`);
    if (v.sentence_ending) lines.push(`語尾: ${v.sentence_ending}`);
    if (v.preferred_words?.length) lines.push(`推奨表現: ${v.preferred_words.join(", ")}`);
    if (v.banned_words?.length) lines.push(`禁止ワード: ${v.banned_words.join(", ")}`);
    if (v.banned_expressions?.length)
      lines.push(`禁止表現: ${v.banned_expressions.join(", ")}`);
    lines.push(`絵文字方針: ${v.emoji_policy}`);
    if (v.sample_text) lines.push(`文体サンプル: ${v.sample_text}`);
  }

  if (personas.data?.length) {
    lines.push(`\n# ターゲット`);
    for (const p of personas.data) {
      lines.push(
        `- ${p.name}(${p.segment ?? ""}${p.role ? " / " + p.role : ""}) 課題: ${(p.pains ?? []).join("、")} / 求める価値: ${(p.gains ?? []).join("、")}`,
      );
    }
  }

  if (competitors.data?.length) {
    lines.push(`\n# 競合`);
    for (const c of competitors.data) {
      lines.push(
        `- ${c.name}: ${c.positioning ?? ""} 強み: ${(c.strengths ?? []).join("、")} 弱み: ${(c.weaknesses ?? []).join("、")}`,
      );
    }
  }

  const publicFacts = (facts.data ?? []).filter((f) => f.visibility === "public");
  if (publicFacts.length) {
    lines.push(`\n# 公式事実データベース (この数値・事実のみ断定してよい)`);
    for (const f of publicFacts) {
      const expired = f.expires_at && new Date(f.expires_at) < new Date();
      lines.push(
        `- [${f.category}] ${f.key} = ${f.value} (${f.status}${expired ? " / 期限切れ・要再確認" : ""})`,
      );
    }
  }
  const internalFacts = (facts.data ?? []).filter((f) => f.visibility === "internal");
  if (internalFacts.length) {
    lines.push(`\n# 社内限定情報 (絶対に外部発信に含めない)`);
    for (const f of internalFacts) lines.push(`- ${f.key}`);
  }

  if (objectives.data?.length) {
    lines.push(`\n# 広報目的 (優先順)`);
    for (const o of objectives.data) {
      lines.push(
        `${o.priority}. ${GOAL_LABEL[o.goal as keyof typeof GOAL_LABEL] ?? o.goal}${o.description ? " — " + o.description : ""}`,
      );
    }
  }

  if (kpis.data?.length) {
    lines.push(`\n# KPI進捗`);
    for (const k of kpis.data) {
      const pct = k.target_value ? Math.round((k.current_value / k.target_value) * 100) : 0;
      lines.push(`- ${k.name}: ${k.current_value}/${k.target_value}${k.unit ?? ""} (${pct}%)`);
    }
  }

  if (channels.data?.length) {
    lines.push(`\n# 媒体と投稿頻度設定`);
    for (const c of channels.data) {
      const count = c.frequency_count ? `${c.frequency_count}回` : "";
      lines.push(
        `- ${CHANNEL_LABEL[c.type as keyof typeof CHANNEL_LABEL] ?? c.type}: ${c.frequency_mode}${count} 自動投稿=${c.auto_publish ? "許可" : "不可"} 連携=${c.connected ? "済" : "未"}`,
      );
    }
  }

  if (learnings.data?.length) {
    lines.push(`\n# AIが学習した内容 (ユーザー承認済み)`);
    for (const l of learnings.data) {
      lines.push(`- ${l.corrected_to ?? l.statement}`);
    }
  }

  if (recentContent.data?.length) {
    lines.push(`\n# 直近の発信 (重複を避ける)`);
    for (const c of recentContent.data) {
      lines.push(`- ${c.title} (${c.type} / ${c.status})`);
    }
  }

  const metrics = topPerformers.data ?? [];
  if (metrics.length) {
    const totals = metrics.reduce(
      (a, m) => ({
        impressions: a.impressions + (m.impressions ?? 0),
        engagements: a.engagements + (m.engagements ?? 0),
        clicks: a.clicks + (m.clicks ?? 0),
        pageviews: a.pageviews + (m.pageviews ?? 0),
      }),
      { impressions: 0, engagements: 0, clicks: 0, pageviews: 0 },
    );
    lines.push(
      `\n# 直近の成果: 表示${totals.impressions} / エンゲージ${totals.engagements} / クリック${totals.clicks} / PV${totals.pageviews}`,
    );
  }

  return {
    orgId: subject.org_id,
    subjectId: subject.id,
    subjectName: subject.name,
    prompt: lines.join("\n"),
    facts: (facts.data ?? []).map((f) => ({
      id: f.id,
      key: f.key,
      value: f.value,
      category: f.category,
      status: f.status,
    })),
    bannedWords: v?.banned_words ?? [],
    bannedExpressions: v?.banned_expressions ?? [],
    channels: (channels.data ?? []).map((c) => c.type),
    goals: (objectives.data ?? []).map((o) => o.goal),
  };
}
