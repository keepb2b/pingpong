import { runAgent } from "@/lib/openrouter";
import { buildSubjectContext } from "@/lib/agents/context";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SYSTEM = `あなたは日本企業の広報を支援する「AI秘書」です。
役割は、経営者・担当者からLINEで広報材料を聞き取り、AI広報部の各担当に渡せる形に整えることです。

厳守事項:
- 質問は必ず1回に1問だけ。相手を疲れさせない。
- 忙しい経営者が30秒で返せる長さ(80文字以内)で聞く。
- 敬語。丁寧だが冗長にしない。絵文字は使わない。
- 既に分かっていることは聞き返さない。
- 相手の答えが曖昧なら、具体化する質問を1問だけ返す。
- 広報に使えない雑談だと判断したら、深追いせず次の材料を尋ねる。
- 公開可否(社名・数値・写真)は必ずどこかで確認する。
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

/** LINEでの1往復を処理する。会話履歴と企業文脈をもとに次の1問を決める。 */
export async function secretaryInterview(params: {
  subjectId: string;
  history: Array<{ role: string; content: string }>;
  latest: string;
  attachments?: Array<{ kind: string; url?: string }>;
  askedCount: number;
  maxQuestions: number;
}): Promise<InterviewTurn> {
  const ctx = await buildSubjectContext(params.subjectId);

  const transcript = params.history
    .slice(-16)
    .map((m) => `${m.role === "user" ? "ユーザー" : "AI秘書"}: ${m.content}`)
    .join("\n");

  const user = `${ctx.prompt}

# これまでの会話
${transcript || "(なし)"}

# ユーザーの最新の発言
${params.latest}
${params.attachments?.length ? `\n# 添付\n${params.attachments.map((a) => `- ${a.kind}`).join("\n")}` : ""}

# 状況
これまでの質問回数: ${params.askedCount} / 上限 ${params.maxQuestions}

# 指示
1. 最新の発言から広報材料として使える情報を抽出する。
2. まだ足りない重要情報が1つでもあり、質問回数が上限未満なら、次の1問だけを作る。
3. 十分に聞き取れた、または上限に達したら complete=true にし、お礼と今後の流れを短く伝える。
4. ユーザーの言い回し・好み・運用ルールに関する示唆があれば learnings に入れる。

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
    "missing": ["まだ聞けていない項目"]
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
    temperature: 0.4,
    maxTokens: 1200,
    fallback: () => fallbackInterview(params),
  });

  return result ?? fallbackInterview(params);
}

/** OpenRouter未設定でもヒアリングが止まらないよう、定型の追加質問で継続する。 */
function fallbackInterview(params: {
  latest: string;
  askedCount: number;
  maxQuestions: number;
}): InterviewTurn {
  const ladder = [
    "ありがとうございます。その内容は社名を公開してもよろしいですか。",
    "決め手になった理由を一言で教えていただけますか。",
    "解決したかった運営上の課題は何でしたか。",
    "時期はいつ頃の予定でしょうか。",
    "写真やお客様のコメントがあれば送ってください。",
  ];
  const done = params.askedCount >= Math.min(params.maxQuestions, ladder.length);
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
      missing: [],
    },
    learnings: [],
  };
}

const PROMPT_SYSTEM = `あなたは日本企業の広報を支援する「AI秘書」です。
今日ユーザーに投げかける、広報材料を引き出すための質問を1つだけ作ります。
- 80文字以内、敬語、絵文字なし
- 直近で聞いた話題の繰り返しを避ける
- 曜日・季節・KPI進捗・不足している広報材料を考慮する
出力はJSONのみ。`;

/** 定期ヒアリングの起点となる「今日の一言」を作る。 */
export async function secretaryDailyPrompt(subjectId: string): Promise<{
  question: string;
  reason: string;
}> {
  const ctx = await buildSubjectContext(subjectId);
  const sb = supabaseAdmin();

  const { data: recent } = await sb
    .from("messages")
    .select("content, created_at")
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(8);

  const today = new Date().toLocaleDateString("ja-JP", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  });

  const user = `${ctx.prompt}

# 本日
${today}

# 最近こちらから送った質問(繰り返さない)
${(recent ?? []).map((r) => `- ${r.content}`).join("\n") || "(なし)"}

# 指示
不足している広報材料・KPIの進捗・季節性を踏まえ、今日聞くべき質問を1つ作る。
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
    temperature: 0.8,
    maxTokens: 400,
    fallback: () => ({
      question: "本日、広報に使えそうな出来事はありますか。",
      reason: "定期ヒアリング",
    }),
  });

  return (
    result ?? {
      question: "本日、広報に使えそうな出来事はありますか。",
      reason: "定期ヒアリング",
    }
  );
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
