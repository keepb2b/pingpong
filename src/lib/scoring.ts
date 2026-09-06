import { supabaseAdmin } from "@/lib/supabase/admin";
import { SCORE_DIMENSIONS, OUTCOME_CONVERSIONS, type ScoreDimension } from "@/lib/constants";

export type ScoreResult = {
  period: string;
  scores: Record<ScoreDimension, number>;
  total: number;
  evidence: Record<string, unknown>;
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
/** 0..1 に正規化してから100点換算 (target を満点とする) */
const ratio = (actual: number, target: number) =>
  target <= 0 ? 0 : clamp((actual / target) * 100);

export function periodRange(period: string): { from: Date; to: Date } {
  const [y, m] = period.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));
  return { from, to };
}

/**
 * AI広報スコア — 10観点を実データから算出する。
 * 「総合点だけでなく点数の根拠」を返せるよう evidence も同時に返す。
 */
export async function computeScore(
  subjectId: string,
  period: string,
): Promise<ScoreResult> {
  const sb = supabaseAdmin();
  const { from, to } = periodRange(period);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const days = Math.round((to.getTime() - from.getTime()) / 864e5);
  const orgId = await orgOf(subjectId);

  const [
    karte,
    facts,
    voice,
    personas,
    objectives,
    kpis,
    channels,
    posts,
    content,
    risks,
    metrics,
    conversions,
    touchpoints,
    mentions,
    links,
    crises,
  ] = await Promise.all([
    sb.from("karte_sections").select("key,content").eq("subject_id", subjectId),
    sb.from("official_facts").select("id,status,verified_at,expires_at").eq("subject_id", subjectId),
    sb.from("brand_voice").select("persona,tone,banned_words").eq("subject_id", subjectId).maybeSingle(),
    sb.from("personas").select("id").eq("subject_id", subjectId),
    sb.from("pr_objectives").select("id").eq("subject_id", subjectId).eq("active", true),
    sb.from("kpis").select("target_value,current_value").eq("subject_id", subjectId),
    sb.from("channels").select("type,connected,frequency_mode").eq("subject_id", subjectId),
    sb
      .from("posts")
      .select("id,channel,published_at,status")
      .eq("subject_id", subjectId)
      .gte("created_at", fromIso)
      .lt("created_at", toIso),
    sb
      .from("content_items")
      .select("id,type,status,risk")
      .eq("subject_id", subjectId)
      .gte("created_at", fromIso)
      .lt("created_at", toIso),
    sb
      .from("risk_checks")
      .select("overall,passed,blocked,findings,created_at")
      .eq("org_id", orgId)
      .gte("created_at", fromIso)
      .lt("created_at", toIso),
    sb
      .from("metrics_daily")
      .select("impressions,reach,engagements,clicks,pageviews,search_clicks,channel")
      .eq("subject_id", subjectId)
      .gte("day", from.toISOString().slice(0, 10))
      .lt("day", to.toISOString().slice(0, 10)),
    sb
      .from("conversions")
      .select("type,amount")
      .eq("subject_id", subjectId)
      .gte("occurred_at", fromIso)
      .lt("occurred_at", toIso),
    sb
      .from("touchpoints")
      .select("position,content_id")
      .eq("org_id", orgId)
      .gte("occurred_at", fromIso)
      .lt("occurred_at", toIso),
    sb
      .from("mentions")
      .select("sentiment,rating,status,source")
      .eq("subject_id", subjectId)
      .gte("occurred_at", fromIso)
      .lt("occurred_at", toIso),
    sb.from("tracking_links").select("id,clicks").eq("subject_id", subjectId),
    sb
      .from("crisis_incidents")
      .select("id,status,severity")
      .eq("subject_id", subjectId)
      .gte("opened_at", fromIso)
      .lt("opened_at", toIso),
  ]);

  // ---------------------------------------------------------- 広報基盤 ----
  const karteFilled = (karte.data ?? []).filter((k) => (k.content ?? "").trim().length > 20).length;
  const factCount = (facts.data ?? []).length;
  const caseStudies = (content.data ?? []).filter((c) => c.type === "case_study").length;
  const foundation = clamp(
    ratio(karteFilled, 17) * 0.4 +
      ratio(factCount, 20) * 0.25 +
      ratio((personas.data ?? []).length, 3) * 0.15 +
      ratio((objectives.data ?? []).length, 2) * 0.1 +
      ratio((channels.data ?? []).filter((c) => c.connected).length, 3) * 0.1,
  );

  // ------------------------------------------------------ 発信継続性 -----
  const published = (posts.data ?? []).filter((p) => p.status === "published");
  const activeDays = new Set(
    published.map((p) => (p.published_at ?? "").slice(0, 10)).filter(Boolean),
  ).size;
  const expectedPosts = Math.max(4, Math.round(days / 3)); // 週2回相当を基準
  const consistency = clamp(
    ratio(published.length, expectedPosts) * 0.6 + ratio(activeDays, Math.round(days / 4)) * 0.4,
  );

  // --------------------------------------------------- コンテンツ品質 ----
  const checks = risks.data ?? [];
  const cleanChecks = checks.filter((c) => c.passed).length;
  const avgFindings =
    checks.length === 0
      ? 0
      : checks.reduce((a, c) => a + (Array.isArray(c.findings) ? c.findings.length : 0), 0) /
        checks.length;
  const contentDiversity = new Set((content.data ?? []).map((c) => c.type)).size;
  const quality = clamp(
    (checks.length ? ratio(cleanChecks, checks.length) : 55) * 0.5 +
      Math.max(0, 100 - avgFindings * 18) * 0.25 +
      ratio(contentDiversity, 5) * 0.25,
  );

  // ------------------------------------------------ ブランド整合性 -------
  const hasVoice = Boolean(voice.data?.persona) ? 1 : 0;
  const hasTone = (voice.data?.tone ?? []).length > 0 ? 1 : 0;
  const hasBanned = (voice.data?.banned_words ?? []).length > 0 ? 1 : 0;
  const brandFindings = checks.reduce(
    (a, c) =>
      a +
      (Array.isArray(c.findings)
        ? (c.findings as Array<{ checkpoint?: string }>).filter(
            (f) => f.checkpoint === "ブランドとの不一致",
          ).length
        : 0),
    0,
  );
  const brand_fit = clamp(
    (hasVoice + hasTone + hasBanned) * 22 + 34 - brandFindings * 12,
  );

  // ----------------------------------------------------- SEO・AEO -------
  const m = metrics.data ?? [];
  const pageviews = sum(m, "pageviews");
  const searchClicks = sum(m, "search_clicks");
  const seoContent = (content.data ?? []).filter(
    (c) => c.type === "seo_article" || c.type === "faq",
  ).length;
  const seo_aeo = clamp(
    ratio(searchClicks, 300) * 0.45 + ratio(pageviews, 1000) * 0.3 + ratio(seoContent, 4) * 0.25,
  );

  // ------------------------------------------------------ SNS到達 -------
  const snsMetrics = m.filter((x) => ["x", "instagram", "facebook"].includes(x.channel ?? ""));
  const impressions = sum(snsMetrics, "impressions");
  const engagements = sum(snsMetrics, "engagements");
  const engRate = impressions ? (engagements / impressions) * 100 : 0;
  const sns_reach = clamp(ratio(impressions, 20000) * 0.6 + ratio(engRate, 3) * 0.4);

  // ----------------------------------------------------- 顧客導線 -------
  const clicks = sum(m, "clicks") + (links.data ?? []).reduce((a, l) => a + (l.clicks ?? 0), 0);
  const ctr = impressions ? (clicks / impressions) * 100 : 0;
  const tp = touchpoints.data ?? [];
  const pathCoverage = new Set(tp.map((t) => t.position)).size; // first/mid/last の網羅
  const linkCoverage = ratio((links.data ?? []).length, Math.max(1, published.length));
  const funnel = clamp(
    ratio(ctr, 2) * 0.35 + ratio(pathCoverage, 3) * 0.3 + linkCoverage * 0.35,
  );

  // -------------------------------------------------- CV・売上成果 ------
  const convs = conversions.data ?? [];
  const outcomes = convs.filter((c) => OUTCOME_CONVERSIONS.includes(c.type));
  const revenue = convs.reduce((a, c) => a + Number(c.amount ?? 0), 0);
  const kpiRows = kpis.data ?? [];
  const kpiAttainment =
    kpiRows.length === 0
      ? 0
      : kpiRows.reduce(
          (a, k) => a + (k.target_value > 0 ? Math.min(1, k.current_value / k.target_value) : 0),
          0,
        ) / kpiRows.length;
  const cv_revenue = clamp(
    ratio(outcomes.length, 10) * 0.4 + kpiAttainment * 100 * 0.35 + ratio(revenue, 500000) * 0.25,
  );

  // ---------------------------------------------------- 口コミ・信頼 ----
  const men = mentions.data ?? [];
  const positive = men.filter((x) => x.sentiment === "positive").length;
  const negative = men.filter((x) => x.sentiment === "negative").length;
  const handled = men.filter((x) => x.status === "replied" || x.status === "resolved").length;
  const ratings = men.map((x) => x.rating).filter((r): r is number => typeof r === "number");
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  const reputation = clamp(
    (men.length ? ratio(positive, Math.max(1, positive + negative)) : 50) * 0.35 +
      (men.length ? ratio(handled, men.length) : 50) * 0.35 +
      (ratings.length ? ratio(avgRating, 5) : 50) * 0.3,
  );

  // ------------------------------------------------------ リスク管理 ----
  const blocked = checks.filter((c) => c.blocked).length;
  const criticalPublished = (content.data ?? []).filter(
    (c) => c.status === "published" && (c.risk === "high" || c.risk === "critical"),
  ).length;
  const checkCoverage = ratio(checks.length, Math.max(1, (content.data ?? []).length));
  const openCrises = (crises.data ?? []).filter((c) => c.status === "open").length;
  const risk_mgmt = clamp(
    checkCoverage * 0.55 +
      Math.max(0, 100 - criticalPublished * 30) * 0.3 +
      Math.max(0, 100 - openCrises * 40) * 0.15 -
      blocked * 2,
  );

  const scores: Record<ScoreDimension, number> = {
    foundation,
    consistency,
    quality,
    brand_fit,
    seo_aeo,
    sns_reach,
    funnel,
    cv_revenue,
    reputation,
    risk_mgmt,
  };

  // 成果への近さで重み付け (投稿数より売上寄りの指標を重く見る)
  const weights: Record<ScoreDimension, number> = {
    foundation: 0.1,
    consistency: 0.1,
    quality: 0.1,
    brand_fit: 0.08,
    seo_aeo: 0.1,
    sns_reach: 0.1,
    funnel: 0.12,
    cv_revenue: 0.18,
    reputation: 0.07,
    risk_mgmt: 0.05,
  };

  const total = clamp(
    SCORE_DIMENSIONS.reduce((a, d) => a + scores[d.key] * weights[d.key], 0),
  );

  return {
    period,
    scores,
    total,
    evidence: {
      karte_filled: karteFilled,
      karte_total: 17,
      official_facts: factCount,
      case_studies: caseStudies,
      personas: (personas.data ?? []).length,
      connected_channels: (channels.data ?? []).filter((c) => c.connected).length,
      published_posts: published.length,
      expected_posts: expectedPosts,
      active_days: activeDays,
      content_created: (content.data ?? []).length,
      content_types: contentDiversity,
      risk_checks: checks.length,
      clean_checks: cleanChecks,
      avg_findings_per_check: Number(avgFindings.toFixed(2)),
      blocked_checks: blocked,
      impressions,
      engagements,
      engagement_rate_pct: Number(engRate.toFixed(2)),
      clicks,
      ctr_pct: Number(ctr.toFixed(2)),
      pageviews,
      search_clicks: searchClicks,
      conversions_total: convs.length,
      outcome_conversions: outcomes.length,
      revenue,
      kpi_attainment_pct: Math.round(kpiAttainment * 100),
      tracking_links: (links.data ?? []).length,
      mentions: men.length,
      positive_mentions: positive,
      negative_mentions: negative,
      handled_mentions: handled,
      avg_rating: Number(avgRating.toFixed(2)),
      open_crises: openCrises,
    },
  };
}

function sum(rows: Array<Record<string, unknown>>, key: string): number {
  return rows.reduce((a, r) => a + Number(r[key] ?? 0), 0);
}

async function orgOf(subjectId: string): Promise<string> {
  const sb = supabaseAdmin();
  const { data } = await sb.from("subjects").select("org_id").eq("id", subjectId).single();
  return data?.org_id ?? "";
}
