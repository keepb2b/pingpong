import { runAgent } from "@/lib/openrouter";
import { buildSubjectContext } from "@/lib/agents/context";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CONTENT_TYPE_LABEL, type ContentTypeKey } from "@/lib/constants";

const SYSTEM = `あなたは日本企業の広報文章を制作する「AIライター」です。
企業のブランド人格・文体・禁止表現を守り、その企業らしい文章を書きます。

厳守事項:
- 公式事実データベースにある数値・事実のみ断定してよい。
- 根拠のない数値、最上級表現(日本一・No.1・最高)、効果の保証は書かない。
- 未確認の内容は書かず、必要なら unverified に「確認が必要な項目」として挙げる。
- 社内限定情報は絶対に含めない。
- 一般的なAI文章ではなく、その企業の一次情報(現場の具体・固有名詞・数字)を核にする。
- 読者の次の行動(CTA)に自然につなげる。
出力は指定されたJSON形式のみ。`;

export type WrittenContent = {
  title: string;
  body: string;
  summary: string;
  keywords: string[];
  cta: string;
  unverified: string[];
  headline_options?: string[];
};

const TYPE_GUIDE: Record<string, string> = {
  seo_article: `検索意図に答えるSEO・AEO記事。2000〜3000文字。h2/h3の見出し構成(Markdown)。
冒頭200文字で結論。AIの引用に耐えるよう、事実を短い断定文で明示する。FAQを3つ末尾に付ける。`,
  news: `事実を中心としたニュース記事。600〜1000文字。5W1Hを冒頭に。誇張しない。`,
  case_study: `導入事例。1200〜1800文字。「課題→検討→導入→効果→今後」の構成。
顧客の言葉を引用として1つ以上入れる(未取得なら unverified に記載)。数値は公式事実のみ。`,
  faq: `よくある質問。5〜8問。各回答は120〜200文字。検索・AI回答で引用されやすい簡潔な断定文。`,
  sns_post: `SNS投稿の原稿。280文字以内。1投稿1メッセージ。冒頭1行で止める。ハッシュタグは本文と別。`,
  gbp_post: `Googleビジネスプロフィール投稿。1500文字以内、実際は300文字前後。
地域名・サービス名を自然に含める。来店/予約/問い合わせのCTAで締める。`,
  press_release: `プレスリリース。1000〜1500文字。
「タイトル/リード/背景/概要/今後の展開/会社概要/問い合わせ先」の構成。記者が事実だけ抜き出せる書式。`,
  media_pitch: `記者・編集部への提案文。400〜600文字。
なぜ今その媒体の読者に関係があるかを冒頭3行で。取材で提供できる素材を箇条書き。`,
  lp_improvement: `LP・Webサイトの改善提案。現状の課題→改善案→期待効果。具体的な文言案を含める。`,
  recruiting: `採用コンテンツ。800〜1200文字。働く人の実像と、入社後の具体的な仕事内容。`,
  headline: `タイトル・キャッチコピー案を8つ。訴求軸を変える。各30文字以内。`,
  email: `メール案内。件名+本文400〜600文字。1つのCTAに絞る。`,
};

/** 広報材料と戦略から、指定した種別のコンテンツを制作する。 */
export async function writeContent(params: {
  subjectId: string;
  type: ContentTypeKey;
  theme: string;
  angle?: string;
  audience?: string;
  goal?: string;
  cta?: string;
  intakeItemId?: string | null;
  extraInstructions?: string;
}): Promise<WrittenContent> {
  const ctx = await buildSubjectContext(params.subjectId);
  const sb = supabaseAdmin();

  let material = "";
  if (params.intakeItemId) {
    const { data } = await sb
      .from("intake_items")
      .select("title,raw_text,structured,kind,occurred_on")
      .eq("id", params.intakeItemId)
      .maybeSingle();
    if (data) {
      material = `# 使用する広報材料
見出し: ${data.title}
種別: ${data.kind}
内容: ${data.raw_text ?? ""}
構造化データ: ${JSON.stringify(data.structured ?? {})}
発生日: ${data.occurred_on ?? "未指定"}`;
    }
  }

  const user = `${ctx.prompt}

${material}

# 制作依頼
種別: ${CONTENT_TYPE_LABEL[params.type] ?? params.type}
テーマ: ${params.theme}
${params.angle ? `切り口: ${params.angle}` : ""}
${params.audience ? `対象読者: ${params.audience}` : ""}
${params.goal ? `広報目的: ${params.goal}` : ""}
${params.cta ? `誘導したい行動: ${params.cta}` : ""}
${params.extraInstructions ? `追加指示: ${params.extraInstructions}` : ""}

# 書式ガイド
${TYPE_GUIDE[params.type] ?? "適切な長さで制作する。"}

JSONのみを出力:
{
  "title": "タイトル",
  "body": "本文(Markdown可)",
  "summary": "120文字の要約",
  "keywords": ["検索キーワード"],
  "cta": "本文末のCTA文言",
  "unverified": ["公式事実に存在せず確認が必要な項目"],
  "headline_options": ["代替タイトル案"]
}`;

  const { result } = await runAgent<WrittenContent>({
    agent: "writer",
    task: `write_${params.type}`,
    system: SYSTEM,
    user,
    orgId: ctx.orgId,
    subjectId: params.subjectId,
    json: true,
    temperature: 0.7,
    maxTokens: 6000,
    fallback: () => fallbackContent(params, ctx.subjectName),
  });

  return result ?? fallbackContent(params, ctx.subjectName);
}

function fallbackContent(
  params: { type: string; theme: string; cta?: string },
  name: string,
): WrittenContent {
  return {
    title: `${params.theme}`,
    body: `## ${params.theme}

${name}に関する広報コンテンツの下書きです。

本文はAIモデル(OpenRouter)の接続後に自動生成されます。現在はAPIキーが未設定のため、
構成のみを生成しています。

### 背景
${params.theme}について、現場で起きた変化を具体的に記載します。

### 内容
収集済みの広報材料をもとに、対象読者の課題と解決の流れを説明します。

### 今後
次のアクションと、読者に取ってほしい行動を明示します。`,
    summary: `${params.theme}についての広報コンテンツ(下書き)。`,
    keywords: [params.theme],
    cta: params.cta ?? "詳しくはお問い合わせください。",
    unverified: ["OPENROUTER_API_KEY が未設定のため本文は自動生成されていません"],
    headline_options: [],
  };
}

/** 1つの広報材料から、複数種別のコンテンツをまとめて展開する。 */
export async function expandToFormats(params: {
  subjectId: string;
  intakeItemId: string;
  types: ContentTypeKey[];
  theme: string;
  goal?: string;
  cta?: string;
}): Promise<Array<{ type: ContentTypeKey; content: WrittenContent }>> {
  const out: Array<{ type: ContentTypeKey; content: WrittenContent }> = [];
  for (const type of params.types) {
    const content = await writeContent({
      subjectId: params.subjectId,
      type,
      theme: params.theme,
      goal: params.goal,
      cta: params.cta,
      intakeItemId: params.intakeItemId,
    });
    out.push({ type, content });
  }
  return out;
}
