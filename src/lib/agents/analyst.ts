import { runAgent } from "@/lib/openrouter";
import { buildSubjectContext } from "@/lib/agents/context";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { RISK_CHECKPOINTS, SCORE_DIMENSIONS } from "@/lib/constants";

const SYSTEM = `あなたは日本企業の広報を検証する「AIアナリスト」です。
発信前のファクトチェックとリスク判定、発信後の成果分析を担当します。

厳守事項:
- 公式事実データベースに存在しない数値・実績・受賞歴は「未確認」として必ず指摘する。
- 古い料金、公開前の情報、期限切れの事実は警告する。
- 誇大表現(日本一/No.1/絶対/必ず/最安)、断定的な効果保証は指摘する。
- 著作権・商標・肖像権・個人情報・機密情報・差別的表現・ステマ表示の観点で確認する。
- 問題があれば必ず修正案を添える。曖昧な指摘だけで終わらせない。
- 重大な問題(法的判断・炎上・情報漏洩の可能性)は blocked=true にする。
出力は指定されたJSON形式のみ。`;

export type RiskFinding = {
  checkpoint: string;
  severity: "none" | "low" | "medium" | "high" | "critical";
  quote: string;
  problem: string;
  fix: string;
};

export type FactCheckResult = {
  overall: "none" | "low" | "medium" | "high" | "critical";
  passed: boolean;
  blocked: boolean;
  findings: RiskFinding[];
  unverified_claims: Array<{ claim: string; why: string; how_to_verify: string }>;
  summary: string;
};

const SEVERITY_ORDER = ["none", "low", "medium", "high", "critical"] as const;

/** 決定的な事前チェック — モデル未接続でも必ず動く安全網。 */
export function deterministicChecks(
  text: string,
  banned: string[],
  bannedExpr: string[],
  factValues: string[],
): RiskFinding[] {
  const findings: RiskFinding[] = [];

  for (const word of [...banned, ...bannedExpr]) {
    if (word && text.includes(word)) {
      findings.push({
        checkpoint: "ブランドとの不一致",
        severity: "medium",
        quote: word,
        problem: `禁止表現「${word}」が含まれています。`,
        fix: `「${word}」を削除するか、ブランド人格に沿った表現へ置き換えてください。`,
      });
    }
  }

  const superlatives = ["日本一", "世界一", "No.1", "ナンバーワン", "最高", "最安", "必ず", "絶対", "100%", "完全無料"];
  for (const s of superlatives) {
    if (text.includes(s)) {
      findings.push({
        checkpoint: "誇大・断定表現",
        severity: "high",
        quote: s,
        problem: `最上級・断定表現「${s}」は根拠の提示が必要です(景品表示法)。`,
        fix: `客観的な根拠(調査名・期間・出典)を併記するか、表現を「◯◯の一つ」等に緩めてください。`,
      });
    }
  }

  // 本文中の数値のうち、公式事実に存在しないものを拾う
  const numbers = text.match(/\d[\d,]*(?:\.\d+)?\s*(?:%|％|円|万円|億円|件|社|名|人|倍|位)/g) ?? [];
  const factBlob = factValues.join(" ");
  const seen = new Set<string>();
  for (const n of numbers) {
    const norm = n.replace(/\s/g, "");
    if (seen.has(norm)) continue;
    seen.add(norm);
    const bare = norm.replace(/[^\d.]/g, "");
    if (bare && !factBlob.includes(bare)) {
      findings.push({
        checkpoint: "未確認の数値",
        severity: "high",
        quote: norm,
        problem: `「${norm}」は公式事実データベースに登録がありません。`,
        fix: `公式事実として登録し出典・確認日を記録するか、本文から削除してください。`,
      });
    }
  }

  if (/(?:PR|提供|広告)\s*[)）]?$/m.test(text) === false && /タイアップ|提供いただ|モニター/.test(text)) {
    findings.push({
      checkpoint: "ステルスマーケティング",
      severity: "medium",
      quote: "タイアップ/提供",
      problem: "対価を伴う発信の可能性がありますが、広告表記が見当たりません。",
      fix: "「#PR」「広告」等の表記を明示してください。",
    });
  }

  return findings;
}

/** 投稿前のファクトチェック + リスク判定。 */
export async function factCheck(params: {
  subjectId: string;
  contentId: string;
}): Promise<FactCheckResult> {
  const ctx = await buildSubjectContext(params.subjectId);
  const sb = supabaseAdmin();

  const { data: content } = await sb
    .from("content_items")
    .select("title,body,type,cta")
    .eq("id", params.contentId)
    .single();

  if (!content) throw new Error("content not found");

  const fullText = `${content.title}\n${content.body ?? ""}\n${content.cta ?? ""}`;
  const deterministic = deterministicChecks(
    fullText,
    ctx.bannedWords,
    ctx.bannedExpressions,
    ctx.facts.map((f) => f.value),
  );

  const { result } = await runAgent<FactCheckResult>({
    agent: "analyst",
    task: "fact_check",
    system: SYSTEM,
    user: `${ctx.prompt}

# 検査対象
種別: ${content.type}
タイトル: ${content.title}
本文:
${String(content.body ?? "").slice(0, 12000)}
CTA: ${content.cta ?? ""}

# 機械チェックで既に検出された問題
${deterministic.map((d) => `- [${d.checkpoint}/${d.severity}] ${d.quote}: ${d.problem}`).join("\n") || "(なし)"}

# 確認観点
${RISK_CHECKPOINTS.map((c) => `- ${c}`).join("\n")}

# 指示
上記すべての観点で検査する。機械チェックの結果も統合して報告する。
公式事実に存在しない数値・実績は必ず unverified_claims に入れる。
重大な法的リスク・炎上リスク・情報漏洩があれば blocked=true。

JSONのみ:
{
 "overall":"none|low|medium|high|critical",
 "passed":true,
 "blocked":false,
 "findings":[{"checkpoint":"未確認の数値","severity":"high","quote":"該当箇所","problem":"何が問題か","fix":"修正案"}],
 "unverified_claims":[{"claim":"...","why":"...","how_to_verify":"..."}],
 "summary":"総評"
}`,
    orgId: ctx.orgId,
    subjectId: params.subjectId,
    json: true,
    temperature: 0.2,
    maxTokens: 3000,
    fallback: () => ({
      overall: "none",
      passed: true,
      blocked: false,
      findings: [],
      unverified_claims: [],
      summary: "OpenRouterに接続できなかったため、機械チェックのみで判定しました。",
    }),
  });

  const findings = mergeFindings(deterministic, result?.findings ?? []);
  const overall = highestSeverity(findings);
  const blocked = result?.blocked ?? findings.some((f) => f.severity === "critical");

  return {
    overall,
    passed: !blocked && SEVERITY_ORDER.indexOf(overall) <= 1,
    blocked,
    findings,
    unverified_claims:
      result?.unverified_claims ??
      deterministic
        .filter((d) => d.checkpoint === "未確認の数値")
        .map((d) => ({
          claim: d.quote,
          why: d.problem,
          how_to_verify: "公式事実データベースに出典・確認日とともに登録してください。",
        })),
    summary:
      result?.summary ??
      (findings.length
        ? `${findings.length}件の確認事項があります。修正または公式事実の登録が必要です。`
        : "問題は検出されませんでした。"),
  };
}

function mergeFindings(a: RiskFinding[], b: RiskFinding[]): RiskFinding[] {
  const seen = new Set<string>();
  const out: RiskFinding[] = [];
  for (const f of [...a, ...b]) {
    const key = `${f.checkpoint}::${f.quote}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

function highestSeverity(findings: RiskFinding[]): FactCheckResult["overall"] {
  let idx = 0;
  for (const f of findings) {
    const i = SEVERITY_ORDER.indexOf(f.severity);
    if (i > idx) idx = i;
  }
  return SEVERITY_ORDER[idx];
}

/** スコアの根拠と改善策を言語化する (点数は scoring.ts が決定的に算出)。 */
export async function explainScore(params: {
  subjectId: string;
  period: string;
  scores: Record<string, number>;
  evidence: Record<string, unknown>;
}): Promise<{
  rationale: Record<string, string>;
  improvements: Array<{ dimension: string; action: string; expected: string; priority: number }>;
}> {
  const ctx = await buildSubjectContext(params.subjectId);

  const { result } = await runAgent<{
    rationale: Record<string, string>;
    improvements: Array<{ dimension: string; action: string; expected: string; priority: number }>;
  }>({
    agent: "analyst",
    task: "explain_score",
    system: SYSTEM,
    user: `${ctx.prompt}

# ${params.period} のAI広報スコア (各100点満点)
${SCORE_DIMENSIONS.map((d) => `- ${d.label}(${d.key}): ${params.scores[d.key] ?? 0}`).join("\n")}

# 算出根拠となった実データ
${JSON.stringify(params.evidence).slice(0, 6000)}

# 指示
各項目について「なぜその点数なのか」を1〜2文で説明し、点数の低い項目から順に
具体的な改善方法を出す。改善策は必ず数値目標と期待効果を含める。

例: 「導入事例が不足しています。2件追加することで、信頼性と問い合わせ率の改善が期待できます」

JSONのみ:
{"rationale":{"foundation":"...","consistency":"..."},
 "improvements":[{"dimension":"foundation","action":"導入事例を2件追加する","expected":"信頼性と問い合わせ率の改善","priority":1}]}`,
    orgId: ctx.orgId,
    subjectId: params.subjectId,
    json: true,
    temperature: 0.4,
    maxTokens: 2500,
    fallback: () => {
      const weak = SCORE_DIMENSIONS.filter((d) => (params.scores[d.key] ?? 0) < 60);
      return {
        rationale: Object.fromEntries(
          SCORE_DIMENSIONS.map((d) => [
            d.key,
            `${d.label}は${params.scores[d.key] ?? 0}点です。実データに基づく算出結果です。`,
          ]),
        ),
        improvements: weak.slice(0, 5).map((d, i) => ({
          dimension: d.key,
          action: `${d.label}を改善する施策を実施する`,
          expected: `${d.label}スコアの向上`,
          priority: i + 1,
        })),
      };
    },
  });

  return result ?? { rationale: {}, improvements: [] };
}

/** 月次AI広報会議のレポートを作る。 */
export async function monthlyReview(params: {
  subjectId: string;
  period: string;
  data: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const ctx = await buildSubjectContext(params.subjectId);

  const { result } = await runAgent<Record<string, unknown>>({
    agent: "analyst",
    task: "monthly_review",
    system: `${SYSTEM}

月次レポートでは、良かった点だけでなく成果が出なかった理由を必ず具体的に書きます。
「なんとなく伸びた」ではなく、どの投稿がどの導線経由で成果につながったかを示します。`,
    user: `${ctx.prompt}

# ${params.period} の活動データ
${JSON.stringify(params.data).slice(0, 12000)}

# 指示
月次AI広報会議の資料を作る。

JSONのみ:
{
 "summary":"今月の総括(300文字)",
 "activities":[{"item":"実施した広報活動","count":0}],
 "kpi_status":[{"name":"KPI名","target":0,"actual":0,"achieved":false,"comment":"..."}],
 "top_content":[{"title":"...","why":"伸びた理由","metric":"..."}],
 "wins":[{"point":"成果が出た理由"}],
 "losses":[{"point":"成果が出なかった理由","cause":"..."}],
 "funnel_issues":[{"stage":"...","issue":"...","fix":"..."}],
 "market_changes":[{"change":"...","impact":"..."}],
 "learnings":[{"learned":"AIが学習した内容"}],
 "next_strategy":{"focus":"来月の重点","themes":["..."],"channels":["..."],"kpi":[{"name":"...","target":0}]},
 "recommended_campaigns":[{"name":"...","hypothesis":"...","expected":"..."}],
 "needed_materials":[{"material":"必要な広報材料","why":"..."}],
 "expected_impact":"改善した場合の期待効果"
}`,
    orgId: ctx.orgId,
    subjectId: params.subjectId,
    json: true,
    temperature: 0.5,
    maxTokens: 5000,
    fallback: () => ({
      summary: `${params.period}の活動データを集計しました。詳細な講評はAIモデル接続後に生成されます。`,
      activities: [],
      kpi_status: [],
      top_content: [],
      wins: [],
      losses: [],
      funnel_issues: [],
      market_changes: [],
      learnings: [],
      next_strategy: { focus: "広報材料の収集", themes: [], channels: [], kpi: [] },
      recommended_campaigns: [],
      needed_materials: [{ material: "導入事例", why: "信頼性の向上に必要" }],
      expected_impact: "—",
    }),
  });

  return result ?? {};
}

/** 危機広報: 事実整理・声明文・想定問答を作る。 */
export async function crisisResponse(params: {
  subjectId: string;
  incident: { title: string; category: string; severity: string; facts: unknown };
}): Promise<{
  fact_summary: Array<{ fact: string; confirmed: boolean }>;
  statement: string;
  apology: string;
  qa: Array<{ q: string; a: string }>;
  sns_policy: string;
  notices: { customers: string; partners: string; internal: string };
  next_actions: string[];
}> {
  const ctx = await buildSubjectContext(params.subjectId);

  const { result } = await runAgent<{
    fact_summary: Array<{ fact: string; confirmed: boolean }>;
    statement: string;
    apology: string;
    qa: Array<{ q: string; a: string }>;
    sns_policy: string;
    notices: { customers: string; partners: string; internal: string };
    next_actions: string[];
  }>({
    agent: "analyst",
    task: "crisis_response",
    system: `あなたは危機広報の専門家です。
- 確認できていない事実は絶対に断定しない。
- 憶測・責任転嫁・過度な自己弁護を書かない。
- 被害・影響を受けた相手への配慮を最優先する。
- 現時点で言えること / 調査中のこと / 次の報告時期 を明確に分ける。
出力はJSONのみ。`,
    user: `${ctx.prompt}

# 発生した事案
件名: ${params.incident.title}
分類: ${params.incident.category}
深刻度: ${params.incident.severity}
把握している事実: ${JSON.stringify(params.incident.facts)}

# 指示
危機広報の初動一式を作成する。

JSONのみ:
{"fact_summary":[{"fact":"...","confirmed":true}],
 "statement":"公式声明案",
 "apology":"お詫び文",
 "qa":[{"q":"想定質問","a":"回答"}],
 "sns_policy":"SNS返信方針",
 "notices":{"customers":"顧客向け","partners":"取引先向け","internal":"社内向け"},
 "next_actions":["..."]}`,
    orgId: ctx.orgId,
    subjectId: params.subjectId,
    json: true,
    temperature: 0.3,
    maxTokens: 3500,
    fallback: () => ({
      fact_summary: [{ fact: params.incident.title, confirmed: false }],
      statement:
        "現在、事実関係の確認を進めております。判明した内容につきましては、確認でき次第あらためてご報告いたします。",
      apology: "ご迷惑とご心配をおかけしておりますことを深くお詫び申し上げます。",
      qa: [{ q: "原因は何ですか", a: "現在調査中です。判明次第お知らせいたします。" }],
      sns_policy: "個別の憶測には回答せず、公式声明への案内に統一します。",
      notices: {
        customers: "お客様へのご案内文(確認中の事項は断定しない)",
        partners: "取引先へのご案内文",
        internal: "社内向け周知文",
      },
      next_actions: ["予約投稿の停止", "事実関係の確認", "関係者への連絡"],
    }),
  });

  return (
    result ?? {
      fact_summary: [],
      statement: "",
      apology: "",
      qa: [],
      sns_policy: "",
      notices: { customers: "", partners: "", internal: "" },
      next_actions: [],
    }
  );
}
