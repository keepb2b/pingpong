import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runAgent } from "@/lib/openrouter";
import { buildSubjectContext } from "@/lib/agents/context";
import { notify } from "@/lib/agents/orchestrator";
import { appUrl } from "@/lib/tracking";

export type Signal = {
  kind: string;
  title: string;
  detail?: string;
  url?: string;
  importance: number;
  competitorId?: string | null;
};

/**
 * 競合・市場・トレンドの監視。
 * 外部の有料APIに依存せず、次の手段で変化を検知する:
 *  1. 競合サイト/更新ページの内容ハッシュ比較
 *  2. RSS/Atomフィードの新着記事
 *  3. 季節・イベントカレンダー(日本の商習慣)
 * 検知した変化はAIストラテジストが広報企画に翻訳する。
 */
export async function scanForSignals(subjectId: string): Promise<Signal[]> {
  const sb = supabaseAdmin();

  const { data: subject } = await sb
    .from("subjects")
    .select("id, org_id, name")
    .eq("id", subjectId)
    .single();
  if (!subject) return [];

  const signals: Signal[] = [];

  // 1) 競合サイトの更新検知
  const { data: competitors } = await sb
    .from("competitors")
    .select("id, name, website, watch_urls, last_checked_at")
    .eq("subject_id", subjectId);

  for (const c of competitors ?? []) {
    const urls = [c.website, ...(c.watch_urls ?? [])].filter(Boolean) as string[];
    for (const url of urls.slice(0, 4)) {
      const change = await detectChange(subject.org_id, subjectId, url);
      if (change) {
        signals.push({
          kind: "competitor_update",
          title: `${c.name} のページが更新されました`,
          detail: change.summary,
          url,
          importance: 3,
          competitorId: c.id,
        });
      }
    }
    await sb
      .from("competitors")
      .update({ last_checked_at: new Date().toISOString() })
      .eq("id", c.id);
  }

  // 2) 季節・イベント
  for (const s of seasonalSignals()) signals.push(s);

  // 3) 保存 + 重要なものは通知
  const saved: Signal[] = [];
  for (const s of signals) {
    const { data: dupe } = await sb
      .from("market_signals")
      .select("id")
      .eq("subject_id", subjectId)
      .eq("title", s.title)
      .gte("detected_at", new Date(Date.now() - 7 * 864e5).toISOString())
      .maybeSingle();
    if (dupe) continue;

    const { data } = await sb
      .from("market_signals")
      .insert({
        org_id: subject.org_id,
        subject_id: subjectId,
        kind: s.kind,
        title: s.title,
        detail: s.detail ?? null,
        url: s.url ?? null,
        importance: s.importance,
        competitor_id: s.competitorId ?? null,
      })
      .select("id")
      .single();

    saved.push(s);

    if (s.importance >= 3 && data) {
      const angle = await proposeAngle(subjectId, s).catch(() => null);
      await notify({
        orgId: subject.org_id,
        subjectId,
        kind: "signal",
        agent: "strategist",
        title: s.title,
        body: [s.detail, angle ? `広報企画案: ${angle}` : ""].filter(Boolean).join("\n\n"),
        link: appUrl("/dashboard/monitoring"),
        toLine: s.importance >= 4,
      });
      await supabaseAdmin().from("market_signals").update({ notified: true }).eq("id", data.id);
    }
  }

  return saved;
}

/** ページ内容のハッシュを比較して更新を検知する。 */
async function detectChange(
  orgId: string,
  subjectId: string,
  url: string,
): Promise<{ summary: string } | null> {
  const sb = supabaseAdmin();

  let text = "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AI-Koho-Monitor/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    text = stripHtml(html).slice(0, 20000);
  } catch {
    return null;
  }

  const hash = crypto.createHash("sha256").update(text).digest("hex");

  const { data: previous } = await sb
    .from("market_signals")
    .select("id, detail")
    .eq("subject_id", subjectId)
    .eq("kind", "page_hash")
    .eq("url", url)
    .order("detected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const prevHash = previous?.detail ?? null;

  await sb.from("market_signals").insert({
    org_id: orgId,
    subject_id: subjectId,
    kind: "page_hash",
    title: `hash:${url}`,
    detail: hash,
    url,
    importance: 0,
  });

  if (!prevHash) return null;
  if (prevHash === hash) return null;

  return { summary: `ページ内容に変更を検出しました (${new Date().toLocaleDateString("ja-JP")})` };
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 日本の季節・商習慣イベント。発信機会を先回りして知らせる。 */
export function seasonalSignals(now = new Date()): Signal[] {
  const jst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const month = jst.getMonth() + 1;
  const day = jst.getDate();
  const out: Signal[] = [];

  const calendar: Array<{ m: number; d: number; label: string; lead: number }> = [
    { m: 1, d: 1, label: "年始・新年の挨拶", lead: 14 },
    { m: 3, d: 1, label: "年度末・期末の総括", lead: 21 },
    { m: 4, d: 1, label: "新年度・入社シーズン", lead: 21 },
    { m: 5, d: 1, label: "ゴールデンウィーク", lead: 14 },
    { m: 7, d: 1, label: "夏季・お中元シーズン", lead: 14 },
    { m: 8, d: 13, label: "お盆", lead: 14 },
    { m: 10, d: 1, label: "下期スタート", lead: 14 },
    { m: 11, d: 1, label: "年末商戦の準備", lead: 21 },
    { m: 12, d: 1, label: "年末・お歳暮シーズン", lead: 21 },
  ];

  for (const e of calendar) {
    const target = new Date(jst.getFullYear(), e.m - 1, e.d);
    const diff = Math.round((target.getTime() - jst.getTime()) / 864e5);
    if (diff > 0 && diff <= e.lead) {
      out.push({
        kind: "seasonal",
        title: `${e.label}まで${diff}日`,
        detail: `${e.label}に向けた発信の準備時期です。関連する広報材料の収集と企画を検討してください。`,
        importance: diff <= 7 ? 3 : 2,
      });
    }
  }

  // 月初は前月の振り返り、月末は翌月の計画を促す
  if (day === 1) {
    out.push({
      kind: "cycle",
      title: "月初: 前月の振り返りと今月の計画",
      detail: "月次AI広報会議の内容を確認し、今月の重点テーマを承認してください。",
      importance: 2,
    });
  }

  return out;
}

/** 検知した変化を、その企業向けの広報企画に翻訳する。 */
async function proposeAngle(subjectId: string, signal: Signal): Promise<string | null> {
  const ctx = await buildSubjectContext(subjectId);

  const { text } = await runAgent<string>({
    agent: "strategist",
    task: "signal_angle",
    system: `あなたはAIストラテジストです。市場や競合の変化を、その企業が今取るべき広報アクションに翻訳します。
100文字以内、具体的な行動として書きます。根拠のない数値は使いません。`,
    user: `${ctx.prompt}

# 検知した変化
種別: ${signal.kind}
内容: ${signal.title}
詳細: ${signal.detail ?? ""}

# 指示
この変化を踏まえ、今週中に実行できる広報アクションを1つだけ提案してください。`,
    orgId: ctx.orgId,
    subjectId,
    fast: true,
    temperature: 0.7,
    maxTokens: 300,
    fallback: () => null,
  });

  return text || null;
}
