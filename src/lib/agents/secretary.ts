import { runAgent } from "@/lib/openrouter";
import { buildSubjectContext } from "@/lib/agents/context";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** 広報制作・今後の告知に直結する問いだけを許可する。 */
const ALLOWED_INQUIRY = [
  "公開してよい固有名詞・数値・写真か（公開可否）",
  "いつ起きた／いつ発表するか（時期）",
  "何が変わったか・成果（制作の核になる一次情報）",
  "誰向け／導入先・対象（記事の主語）",
  "次の告知・イベント・発売など今後の予定",
  "お客様の声や写真など、制作に使える素材の有無",
  "未記入のカルテのうち、発信に必要な項目（商品、強み、事例、公開範囲）",
] as const;

/** 1つの物語（1会話）で聞く質問の上限。 */
export const STORY_QUESTION_MAX = 6;

const SYSTEM = `あなたは日本企業の広報を支援する「AI秘書」です。
役割は、LINEで広報制作と今後の発信に必要な情報だけを聞き取り、各担当へ渡すことです。

厳守事項:
- 質問は必ず1回に1問。80文字以内、敬語、絵文字なし。
- 1つの話につき質問は最大6問。重要な不足だけ聞く。
- 「この物語ですでに聞いた質問」と同じ趣旨は、言い換えても絶対に聞かない。
- 「聞いてよい項目」に含まれる不足だけを聞く。雑談・気分・社内事情・弱みの深掘りは聞かない。
- 既に会話・カルテ・公式事実にあることは聞き返さない。
- 不足がなければ complete=true。お礼と制作に進む旨だけ伝える。
- 公開可否は、固有名詞・数値・写真が出たときだけ、かつ未質問のときだけ確認する。
出力は指定されたJSON形式のみ。`;

export type InterviewTurn = {
  /** 次にユーザーへ送る一言 */
  reply: string;
  /** これ以上聞くことがなければ true */
  complete: boolean;
  /** 聞き取れた情報の構造化 */
  extracted: {
    title?: string;
    kind?: string;
    summary?: string;
    facts?: Array<{ key: string; value: string; needs_confirmation?: boolean }>;
    disclosable?: boolean;
    newsworthiness?: number;
    missing?: string[];
  };
  /** 学習候補 (ブランド/好み/運用ルール) */
  learnings?: Array<{ statement: string; category: string }>;
};

type ProductionGap = { key: string; question: string };

/** カルテ・材料・予定のうち、制作と今後の活動に足りない項目。 */
async function listProductionGaps(subjectId: string): Promise<ProductionGap[]> {
  const sb = supabaseAdmin();
  const gaps: ProductionGap[] = [];

  const [{ data: karte }, { data: facts }, { data: upcoming }, { data: recentIntake }] =
    await Promise.all([
      sb.from("karte_sections").select("key, content").eq("subject_id", subjectId),
      sb.from("official_facts").select("id").eq("subject_id", subjectId).limit(1),
      sb
        .from("content_items")
        .select("id")
        .eq("subject_id", subjectId)
        .in("status", ["scheduled", "approved", "pending_approval"])
        .limit(1),
      sb
        .from("intake_items")
        .select("id, structured")
        .eq("subject_id", subjectId)
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

  const karteMap = new Map((karte ?? []).map((k) => [k.key, (k.content ?? "").trim()]));
  const needKarte: Array<[string, string]> = [
    ["products", "今後の発信のため、いま力を入れている商品・サービスを一言で教えてください。"],
    ["strengths", "他社と違う強みを、発信で使ってよい表現で一言ください。"],
    ["cases", "掲載してよい導入事例や成果はありますか。社名の公開可否も教えてください。"],
    ["testimonials", "引用してよいお客様の声はありますか。"],
    ["disclosable", "社名・数値・写真のうち、対外発信してよい範囲を教えてください。"],
    ["targets", "今後いちばん届けたい相手は、どのような方ですか。"],
  ];
  for (const [key, question] of needKarte) {
    if (!karteMap.get(key)) gaps.push({ key: `karte:${key}`, question });
  }

  if (!(facts ?? []).length) {
    gaps.push({
      key: "facts",
      question: "記事に書いてよい確定の数字（価格・実績・導入数など）はありますか。",
    });
  }

  if (!(upcoming ?? []).length) {
    gaps.push({
      key: "upcoming",
      question: "今後2〜4週間で告知したい発売・イベント・キャンペーンはありますか。",
    });
  }

  const latest = recentIntake?.[0]?.structured as Record<string, unknown> | null;
  if (latest && typeof latest === "object") {
    const missing = Array.isArray(latest.missing) ? (latest.missing as string[]) : [];
    for (const item of missing) {
      const text = String(item);
      if (/公開|社名|写真|数値/.test(text)) {
        gaps.push({
          key: "disclosable_open",
          question: "その内容は社名・数値・写真を公開してもよろしいですか。",
        });
      } else if (/時期|いつ/.test(text)) {
        gaps.push({ key: "when", question: "発表や実施の時期はいつ頃でしょうか。" });
      } else if (/成果|効果|変化/.test(text)) {
        gaps.push({ key: "result", question: "変化や成果を、書いてよい範囲で一言ください。" });
      }
    }
  }

  const seen = new Set<string>();
  return gaps.filter((g) => {
    if (seen.has(g.key)) return false;
    seen.add(g.key);
    return true;
  });
}

function formatGaps(gaps: ProductionGap[]): string {
  if (!gaps.length) {
    return "(不足なし。新規の制作材料がなければ質問せず complete=true にする)";
  }
  return gaps.map((g, i) => `${i + 1}. ${g.question}`).join("\n");
}

function normalizeAsk(text: string): string {
  return text
    .replace(/[？?。、,.！!\s]/g, "")
    .replace(/ください|でしょうか|ますか|ですか|よろしいですか/g, "")
    .slice(0, 40);
}

/** 同じ物語で重複判定するための質問の種類。 */
function questionKind(text: string): string {
  if (/公開|社名|写真|数値|対外/.test(text)) return "disclosable";
  if (/いつ|時期|予定日|実施/.test(text)) return "when";
  if (/成果|変化|効果|実績/.test(text)) return "result";
  if (/対象|導入|届けたい|誰/.test(text)) return "who";
  if (/発売|イベント|キャンペーン|今後.*告知|2.?4週間/.test(text)) return "upcoming";
  if (/お客様の声|コメント|素材/.test(text)) return "voice";
  if (/商品|サービス/.test(text)) return "products";
  if (/強み/.test(text)) return "strengths";
  if (/事例/.test(text)) return "cases";
  if (/数字|価格|導入数/.test(text)) return "facts";
  return normalizeAsk(text);
}

function alreadyAsked(history: Array<{ role: string; content: string }>): {
  kinds: Set<string>;
  texts: string[];
} {
  const texts = history
    .filter((m) => m.role === "assistant" && /[？?]/.test(m.content))
    .map((m) => m.content.trim());
  return { kinds: new Set(texts.map(questionKind)), texts };
}

function wrapUpReply(): InterviewTurn {
  return {
    reply:
      "ありがとうございます。いただいた内容をもとに広報案を作成します。追加があれば、そのときにお知らせください。",
    complete: true,
    extracted: { missing: [], disclosable: true, newsworthiness: 50 },
    learnings: [],
  };
}

/** LINEでの1往復を処理する。会話履歴と企業文脈をもとに次の1問を決める。 */
export async function secretaryInterview(params: {
  subjectId: string;
  history: Array<{ role: string; content: string }>;
  latest: string;
  attachments?: Array<{ kind: string; url?: string }>;
  askedCount: number;
  maxQuestions: number;
}): Promise<InterviewTurn> {
  const cap = Math.min(Math.max(1, params.maxQuestions || STORY_QUESTION_MAX), STORY_QUESTION_MAX);
  const asked = alreadyAsked(params.history);
  if (params.askedCount >= cap) {
    return wrapUpReply();
  }

  const ctx = await buildSubjectContext(params.subjectId);
  const gaps = (await listProductionGaps(params.subjectId)).filter(
    (g) => !asked.kinds.has(questionKind(g.question)),
  );

  const remaining = cap - params.askedCount;

  const transcript = params.history
    .slice(-24)
    .map((m) => `${m.role === "user" ? "ユーザー" : "AI秘書"}: ${m.content}`)
    .join("\n");

  const user = `${ctx.prompt}

# 聞いてよい項目（これ以外は聞かない）
${ALLOWED_INQUIRY.map((x) => `- ${x}`).join("\n")}

# いま不足している制作・今後の材料（未質問のみ）
${formatGaps(gaps)}

# この物語ですでに聞いた質問（同じ趣旨は再質問禁止）
${asked.texts.map((t) => `- ${t}`).join("\n") || "(まだなし)"}

# これまでの会話
${transcript || "(なし)"}

# ユーザーの最新の発言
${params.latest}
${params.attachments?.length ? `\n# 添付\n${params.attachments.map((a) => `- ${a.kind}`).join("\n")}` : ""}

# 状況
これまでの質問回数: ${params.askedCount} / 上限 ${cap}（残り ${remaining} 問まで）

# 指示
1. 最新の発言から、投稿・記事・事例に使える一次情報だけ抽出する。
2. 未質問の重要不足が1つあるときだけ、次の1問を作る。重要度: 公開可否 → 時期 → 成果 → 対象 → 今後の予定 → 素材。
3. すでに聞いた質問と同じ趣旨は禁止（言い換えも禁止）。
4. 残り0、または重要不足がなければ complete=true。お礼と制作に進む旨のみ。追加の質問を書かない。
5. learnings は発信ルール（禁止表現・公開範囲）に限る。

JSONのみを出力:
{
  "reply": "ユーザーへ送る一言(80文字以内)",
  "complete": false,
  "extracted": {
    "title": "広報材料の見出し",
    "kind": "event|achievement|new_service|customer_voice|photo|document|number|other",
    "summary": "内容の要約",
    "facts": [{"key":"導入先","value":"◯◯ホテル","needs_confirmation":true}],
    "disclosable": true,
    "newsworthiness": 0,
    "missing": ["まだ聞けていない制作必須項目"]
  },
  "learnings": [{"statement":"...","category":"preference|rule|brand"}]
}`;

  const { result } = await runAgent<InterviewTurn>({
    agent: "secretary",
    task: "line_interview",
    system: SYSTEM,
    user,
    orgId: ctx.orgId,
    subjectId: params.subjectId,
    json: true,
    temperature: 0.3,
    maxTokens: 1200,
    fallback: () => fallbackInterview(params, gaps, cap, asked),
  });

  let turn = result ?? fallbackInterview(params, gaps, cap, asked);
  if (turn.complete) return turn;

  if (asked.kinds.has(questionKind(turn.reply)) || asked.texts.some((t) => normalizeAsk(t) === normalizeAsk(turn.reply))) {
    const next = gaps.find((g) => !asked.kinds.has(questionKind(g.question)));
    if (!next) return wrapUpReply();
    turn = { ...turn, reply: next.question, complete: false };
  }

  if (!gaps.length && params.askedCount >= 1 && !hasOpenProductionGap(turn)) {
    return wrapUpReply();
  }
  return turn;
}

function hasOpenProductionGap(turn: InterviewTurn): boolean {
  const missing = turn.extracted?.missing ?? [];
  return missing.some((m) =>
    /公開|時期|いつ|成果|事例|写真|声|予定|告知|発売|イベント|商品|強み|対象/.test(m),
  );
}

/** モデル未設定でも、制作必須の定型質問だけ続ける。 */
function fallbackInterview(
  params: { latest: string; askedCount: number; maxQuestions: number },
  gaps: ProductionGap[],
  cap: number,
  asked: { kinds: Set<string> },
): InterviewTurn {
  const ladder = (
    gaps.length > 0
      ? gaps.map((g) => g.question)
      : [
          "その内容は社名・数値・写真を公開してもよろしいですか。",
          "発表や実施の時期はいつ頃でしょうか。",
          "変化や成果を、書いてよい範囲で一言ください。",
          "今後告知したい発売・イベント・キャンペーンはありますか。",
        ]
  ).filter((q) => !asked.kinds.has(questionKind(q)));
  const done = params.askedCount >= cap || ladder.length === 0;
  return {
    reply: done
      ? "ありがとうございます。いただいた内容をもとに広報案を作成し、後ほどご提案します。"
      : ladder[params.askedCount] ?? ladder[0],
    complete: done,
    extracted: {
      title: params.latest.slice(0, 40) || "広報材料",
      kind: "event",
      summary: params.latest,
      disclosable: true,
      newsworthiness: 50,
      missing: done ? [] : gaps.slice(params.askedCount + 1).map((g) => g.question),
    },
    learnings: [],
  };
}

const PROMPT_SYSTEM = `あなたは日本企業の広報を支援する「AI秘書」です。
今日LINEで聞く質問を、広報制作または今後の活動に必要なもの1つだけ作ります。
- 不足リストに無い話題は出さない
- 80文字以内、敬語、絵文字なし
- 最近送った質問の繰り返し禁止
- 雑談・体調・気分・関係ないKPIの雑問は禁止
出力はJSONのみ。`;

/** 定期ヒアリングの起点となる「今日の一言」を作る。 */
export async function secretaryDailyPrompt(subjectId: string): Promise<{
  question: string;
  reason: string;
  skip?: boolean;
}> {
  const ctx = await buildSubjectContext(subjectId);
  const gaps = await listProductionGaps(subjectId);
  const sb = supabaseAdmin();

  const { data: recent } = await sb
    .from("messages")
    .select("content, created_at")
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(8);

  if (!gaps.length) {
    return {
      question: "",
      reason: "制作・今後の活動に必要な不足がないため送信しない",
      skip: true,
    };
  }

  const today = new Date().toLocaleDateString("ja-JP", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  });

  const user = `${ctx.prompt}

# 本日
${today}

# 聞いてよい項目
${ALLOWED_INQUIRY.map((x) => `- ${x}`).join("\n")}

# 今日聞いてよい不足（この中から1つだけ）
${formatGaps(gaps)}

# 最近こちらから送った質問(繰り返さない)
${(recent ?? []).map((r) => `- ${r.content}`).join("\n") || "(なし)"}

# 指示
不足リストの先頭付近から、今日いちばん制作または今後の告知に効く1問だけ選ぶ。
リスト外の質問は作らない。
JSONのみ: {"question":"...","reason":"この質問を選んだ理由"}`;

  const { result } = await runAgent<{ question: string; reason: string }>({
    agent: "secretary",
    task: "daily_prompt",
    system: PROMPT_SYSTEM,
    user,
    orgId: ctx.orgId,
    subjectId,
    json: true,
    fast: true,
    temperature: 0.4,
    maxTokens: 400,
    fallback: () => ({
      question: gaps[0].question,
      reason: "制作に必要な不足項目",
    }),
  });

  const question = result?.question?.trim() || gaps[0].question;
  return {
    question,
    reason: result?.reason ?? "制作に必要な不足項目",
  };
}

/** 提案・結果報告をLINE向けの短文にまとめる。 */
export async function secretarySummarize(params: {
  subjectId: string;
  kind: "proposal" | "report" | "alert";
  payload: unknown;
}): Promise<string> {
  const ctx = await buildSubjectContext(params.subjectId);

  const { text } = await runAgent<string>({
    agent: "secretary",
    task: `summarize_${params.kind}`,
    system: `あなたはAI秘書です。経営者がLINEで30秒で読める日本語の要約を作ります。
箇条書き中心、300文字以内、絵文字なし、敬語。最後に必要な操作(承認/修正/保留)を一行で促す。`,
    user: `${ctx.prompt}\n\n# 対象データ\n${JSON.stringify(params.payload).slice(0, 6000)}`,
    orgId: ctx.orgId,
    subjectId: params.subjectId,
    fast: true,
    temperature: 0.5,
    maxTokens: 600,
    fallback: () => "新しいご提案があります。ダッシュボードからご確認ください。",
  });

  return text || "新しいご提案があります。ダッシュボードからご確認ください。";
}
