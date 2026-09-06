// ============================================================================
// AI広報 — 共通定数 / 日本語ラベル
// ============================================================================

export const AGENTS = [
  {
    key: "secretary",
    name: "AI秘書",
    role: "ユーザーとAI広報部をつなぐ窓口",
    color: "var(--color-secretary)",
    duties: [
      "LINEでのヒアリング",
      "情報・写真・資料の受付",
      "提案通知",
      "承認・修正・保留",
      "投稿スケジュール管理",
      "設定変更",
      "結果報告",
      "各AI担当への指示",
      "人による判断が必要な案件の通知",
    ],
  },
  {
    key: "strategist",
    name: "AIストラテジスト",
    role: "企業の目標から逆算して広報戦略を設計",
    color: "var(--color-strategist)",
    duties: [
      "広報目的の設定",
      "ターゲット分析",
      "市場・競合分析",
      "発信テーマの決定",
      "年間・月間広報計画",
      "媒体戦略",
      "ブランド戦略",
      "KPI達成戦略",
      "キャンペーン企画",
      "話題化の提案",
    ],
  },
  {
    key: "writer",
    name: "AIライター",
    role: "企業情報とブランド人格を理解して文章を制作",
    color: "var(--color-writer)",
    duties: [
      "SEO・AEO記事",
      "ニュース記事",
      "導入事例",
      "FAQ",
      "SNS投稿",
      "Googleビジネス投稿",
      "プレスリリース",
      "メディア向け提案文",
      "LP・Webサイト改善",
      "採用コンテンツ",
      "タイトル・キャッチコピー",
    ],
  },
  {
    key: "marketer",
    name: "AIマーケター",
    role: "制作した情報を成果につながる形で届ける",
    color: "var(--color-marketer)",
    duties: [
      "媒体別の文章最適化",
      "投稿曜日・時間の調整",
      "CTA設計",
      "顧客導線設計",
      "A/Bテスト",
      "コメント・口コミ対応案",
      "キャンペーン運用",
    ],
  },
  {
    key: "analyst",
    name: "AIアナリスト",
    role: "広報活動の結果を分析し次の改善につなげる",
    color: "var(--color-analyst)",
    duties: [
      "PV・検索流入",
      "SNSリーチ",
      "エンゲージメント",
      "CTAクリック率",
      "問い合わせ・LINE登録・資料請求",
      "予約・購入・商談・成約",
      "顧客導線分析",
      "KPI進捗",
      "成功・失敗要因",
      "月次レポート",
      "AI広報スコア",
    ],
  },
  {
    key: "creator",
    name: "AIクリエイター",
    role: "企業のブランドに合わせたクリエイティブを制作",
    color: "var(--color-creator)",
    duties: [
      "SNS画像",
      "バナー",
      "サムネイル",
      "アイキャッチ",
      "広告素材",
      "複数枚投稿",
      "動画素材",
      "ブランドテンプレート",
      "媒体別サイズ調整",
    ],
  },
] as const;

export type AgentKey = (typeof AGENTS)[number]["key"];

export const AGENT_LABEL: Record<AgentKey, string> = {
  secretary: "AI秘書",
  strategist: "AIストラテジスト",
  writer: "AIライター",
  marketer: "AIマーケター",
  analyst: "AIアナリスト",
  creator: "AIクリエイター",
};

// ------------------------------------------------------------------ 媒体 ---
export const CHANNELS = [
  { key: "x", label: "X", limit: 140, kind: "sns" },
  { key: "instagram", label: "Instagram", limit: 2200, kind: "sns" },
  { key: "facebook", label: "Facebook", limit: 2000, kind: "sns" },
  { key: "gbp", label: "Googleビジネスプロフィール", limit: 1500, kind: "local" },
  { key: "wordpress", label: "WordPress", limit: 0, kind: "owned" },
  { key: "site", label: "公式サイト", limit: 0, kind: "owned" },
  { key: "line", label: "LINE", limit: 500, kind: "direct" },
  { key: "email", label: "メール", limit: 0, kind: "direct" },
  { key: "press", label: "プレスリリース", limit: 0, kind: "earned" },
] as const;

export type ChannelKey = (typeof CHANNELS)[number]["key"];

export const CHANNEL_LABEL = Object.fromEntries(
  CHANNELS.map((c) => [c.key, c.label]),
) as Record<ChannelKey, string>;

export const CHANNEL_LIMIT = Object.fromEntries(
  CHANNELS.map((c) => [c.key, c.limit]),
) as Record<ChannelKey, number>;

// ------------------------------------------------------------- 広報目的 ---
export const GOALS = [
  { key: "awareness", label: "認知拡大" },
  { key: "traffic", label: "集客" },
  { key: "inquiry", label: "問い合わせ獲得" },
  { key: "booking_purchase", label: "予約・購入" },
  { key: "recruiting", label: "採用" },
  { key: "seo_aeo", label: "SEO・AEO強化" },
  { key: "brand", label: "ブランド構築" },
  { key: "media", label: "メディア露出" },
  { key: "reputation", label: "口コミ・信頼強化" },
] as const;

export type GoalKey = (typeof GOALS)[number]["key"];
export const GOAL_LABEL = Object.fromEntries(
  GOALS.map((g) => [g.key, g.label]),
) as Record<GoalKey, string>;

// --------------------------------------------------------- コンテンツ種別 -
export const CONTENT_TYPES = [
  { key: "seo_article", label: "SEO・AEO記事", agent: "writer" },
  { key: "news", label: "ニュース記事", agent: "writer" },
  { key: "case_study", label: "導入事例", agent: "writer" },
  { key: "faq", label: "FAQ", agent: "writer" },
  { key: "sns_post", label: "SNS投稿", agent: "writer" },
  { key: "gbp_post", label: "Googleビジネス投稿", agent: "writer" },
  { key: "press_release", label: "プレスリリース", agent: "writer" },
  { key: "media_pitch", label: "メディア向け提案文", agent: "writer" },
  { key: "lp_improvement", label: "LP・Webサイト改善", agent: "marketer" },
  { key: "recruiting", label: "採用コンテンツ", agent: "writer" },
  { key: "headline", label: "タイトル・キャッチコピー", agent: "writer" },
  { key: "email", label: "メール案内", agent: "marketer" },
] as const;

export type ContentTypeKey = (typeof CONTENT_TYPES)[number]["key"];
export const CONTENT_TYPE_LABEL = Object.fromEntries(
  CONTENT_TYPES.map((c) => [c.key, c.label]),
) as Record<ContentTypeKey, string>;

// ------------------------------------------------------------ ステータス --
export const STATUS_LABEL: Record<string, string> = {
  draft: "下書き",
  fact_check: "ファクトチェック中",
  pending_approval: "承認待ち",
  approved: "承認済み",
  scheduled: "投稿予定",
  published: "投稿済み",
  rejected: "却下",
  on_hold: "保留",
  failed: "失敗",
  proposed: "提案中",
  new: "新規",
  open: "対応中",
  resolved: "解決済み",
  closed: "完了",
};

export const RISK_LABEL: Record<string, string> = {
  none: "問題なし",
  low: "軽微",
  medium: "要確認",
  high: "高リスク",
  critical: "重大",
};

export const ROLE_LABEL: Record<string, string> = {
  owner: "管理者(オーナー)",
  admin: "管理者",
  editor: "編集者",
  legal: "法務確認者",
  brand: "ブランド管理者",
  approver: "最終承認者",
  viewer: "閲覧者",
};

export const SUBJECT_TYPE_LABEL: Record<string, string> = {
  company: "企業",
  service: "サービス",
  product: "商品",
  brand: "ブランド",
  store: "店舗",
  person: "個人",
};

// ---------------------------------------------------------------- 頻度 ----
export const DIALOGUE_FREQUENCIES = [
  { key: "daily", label: "毎日" },
  { key: "five_per_week", label: "週5回" },
  { key: "three_per_week", label: "週3回" },
  { key: "weekly", label: "週1回" },
  { key: "custom_days", label: "曜日指定" },
  { key: "on_demand", label: "必要なときだけ" },
  { key: "paused", label: "一時停止" },
] as const;

export const POST_FREQUENCY_MODES = [
  { key: "ai_auto", label: "AIに任せる" },
  { key: "daily", label: "毎日" },
  { key: "weekly_n", label: "週○回" },
  { key: "monthly_n", label: "月○回" },
  { key: "on_demand", label: "必要なときだけ" },
  { key: "never", label: "投稿しない" },
] as const;

export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// ------------------------------------------------------- AI広報カルテ -----
export const KARTE_SECTIONS = [
  { key: "philosophy", label: "企業理念" },
  { key: "history", label: "沿革" },
  { key: "leader_voice", label: "代表者の考え" },
  { key: "products", label: "商品・サービス" },
  { key: "pricing", label: "料金・機能" },
  { key: "targets", label: "ターゲット" },
  { key: "strengths", label: "強み" },
  { key: "weaknesses", label: "弱み" },
  { key: "competitors", label: "競合" },
  { key: "cases", label: "導入事例" },
  { key: "testimonials", label: "顧客の声" },
  { key: "faq", label: "FAQ" },
  { key: "brand_image", label: "ブランドイメージ" },
  { key: "tone", label: "文章トーン" },
  { key: "expressions", label: "使用表現" },
  { key: "banned_expressions", label: "禁止表現" },
  { key: "disclosable", label: "公開可能な情報" },
] as const;

// ------------------------------------------------------ AI広報スコア ------
export const SCORE_DIMENSIONS = [
  { key: "foundation", label: "広報基盤" },
  { key: "consistency", label: "発信継続性" },
  { key: "quality", label: "コンテンツ品質" },
  { key: "brand_fit", label: "ブランド整合性" },
  { key: "seo_aeo", label: "SEO・AEO" },
  { key: "sns_reach", label: "SNS到達" },
  { key: "funnel", label: "顧客導線" },
  { key: "cv_revenue", label: "CV・売上成果" },
  { key: "reputation", label: "口コミ・信頼" },
  { key: "risk_mgmt", label: "リスク管理" },
] as const;

export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number]["key"];

// ------------------------------------------------------------ 成果指標 ----
export const CONVERSION_LABEL: Record<string, string> = {
  view: "表示",
  read: "閲覧",
  cta_click: "CTAクリック",
  line_register: "LINE登録",
  call: "電話",
  inquiry: "問い合わせ",
  doc_request: "資料請求",
  signup: "会員登録",
  booking: "予約",
  purchase: "購入",
  meeting: "商談",
  contract: "成約",
  visit: "来店",
  coupon: "クーポン利用",
};

/** 成果につながる (売上手前の) コンバージョン */
export const OUTCOME_CONVERSIONS = [
  "inquiry",
  "booking",
  "purchase",
  "contract",
  "doc_request",
  "line_register",
  "call",
  "visit",
];

// ---------------------------------------------------------------- 料金 ----
export const PRICING = {
  setup: 99800,
  monthly: 39800,
  extraSubject: 9800,
  currency: "JPY",
  taxNote: "表示価格は税抜です。",
} as const;

export const SETUP_INCLUDES = [
  "AI初期ヒアリング",
  "AI広報カルテ作成",
  "公式事実データ登録",
  "ターゲット・競合分析",
  "ブランド人格設定",
  "禁止表現・承認ルール設定",
  "KPI・CV設定",
  "媒体連携",
  "LINE設定",
  "投稿・対話頻度設定",
  "AI初期調整",
  "テスト制作・動作確認",
];

// ------------------------------------------------- ファクトチェック観点 ---
export const RISK_CHECKPOINTS = [
  "事実誤認",
  "未確認の数値",
  "誇大・断定表現",
  "著作権・商標",
  "肖像権",
  "個人情報",
  "機密情報",
  "不適切・差別的表現",
  "広告・キャンペーン表現",
  "ステルスマーケティング",
  "炎上リスク",
  "ブランドとの不一致",
];

export function yen(n: number): string {
  return "¥" + n.toLocaleString("ja-JP");
}
