import Link from "next/link";
import { AGENTS, PRICING, SETUP_INCLUDES, yen, GOALS, RISK_CHECKPOINTS } from "@/lib/constants";
import { AgentIcon, LineIcon, LoopIcon, ShieldCheckIcon, SparkIcon } from "@/components/icons/AgentIcons";

const PROBLEMS = [
  "専任の広報担当者を採用できない",
  "何を発信すればよいか分からない",
  "日々の業務が忙しく、発信を継続できない",
  "SNSやブログの内容が思いつかない",
  "AIを使っても、自社らしい文章にならない",
  "投稿しても、売上につながっているか分からない",
  "媒体ごとの管理や分析に時間がかかる",
  "社内にある広報材料を集められない",
  "競合や市場の変化を追いきれない",
  "広報活動の改善方法が分からない",
];

const CYCLE = [
  { label: "情報収集", agent: "secretary" },
  { label: "AI取材", agent: "secretary" },
  { label: "戦略判断", agent: "strategist" },
  { label: "コンテンツ制作", agent: "writer" },
  { label: "リスク確認", agent: "analyst" },
  { label: "ユーザー承認", agent: "secretary" },
  { label: "投稿・配信", agent: "marketer" },
  { label: "売上計測", agent: "analyst" },
  { label: "学習・改善", agent: "strategist" },
] as const;

const FEATURES = [
  {
    title: "AI広報カルテ",
    body: "企業理念・沿革・商品・ターゲット・強み・文章トーン・禁止表現まで蓄積。AIが何を記憶しているかを確認でき、「正しい / 修正する / 今回だけ / 長期的に記憶 / 忘れさせる」を選べます。",
  },
  {
    title: "公式事実データベース",
    body: "料金・実績・受賞歴などを出典と確認日つきで管理。未確認の数字や古い料金が含まれていれば警告し、確認が取れるまで投稿を停止します。",
  },
  {
    title: "承認してから投稿",
    body: "導入初期は完全自動投稿を行いません。発信理由・目的・CTA・期待効果まで提示し、LINEから承認・修正・保留・投稿しないを選べます。慣れた後は媒体別に自動投稿を許可できます。",
  },
  {
    title: "成果を売上まで計測",
    body: "投稿ごとに専用リンクを発行し、表示から問い合わせ・予約・購入・成約・成約金額まで追跡。最初に接触した投稿と最後に行動を起こした媒体の両方を評価します。",
  },
  {
    title: "競合・市場・トレンド監視",
    body: "競合サイトの更新、季節イベント、市場の変化を日々監視。重要な変化はLINEで通知し、必要に応じて広報企画を提案します。",
  },
  {
    title: "危機広報",
    body: "事故・障害・炎上・情報漏洩が発生したら危機広報モードへ切り替え、予約投稿を一括停止。事実整理・公式声明案・想定問答・関係者向け案内までを用意します。",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-dvh">
      {/* ------------------------------------------------------------ nav -- */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/85 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-5 h-14 flex items-center justify-between">
          <span className="font-bold text-[15px] tracking-tight flex items-center gap-2">
            <span className="text-brand-600">
              <SparkIcon size={18} />
            </span>
            AI広報
          </span>
          <nav className="flex items-center gap-1 text-sm">
            <a href="#agents" className="hidden sm:block px-3 py-2 muted hover:text-[var(--text)]">
              6人の専門AI
            </a>
            <a href="#features" className="hidden sm:block px-3 py-2 muted hover:text-[var(--text)]">
              機能
            </a>
            <a href="#pricing" className="hidden sm:block px-3 py-2 muted hover:text-[var(--text)]">
              料金
            </a>
            <Link href="/login" className="px-3 py-2 muted hover:text-[var(--text)]">
              ログイン
            </Link>
            <Link
              href="/signup"
              className="ml-1 h-9 px-4 inline-flex items-center rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              はじめる
            </Link>
          </nav>
        </div>
      </header>

      {/* ----------------------------------------------------------- hero -- */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 aurora" aria-hidden />
        <div className="absolute inset-0 grid-lines" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-5 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium">
            <span className="text-[color:var(--color-writer)]">
              <LineIcon size={14} />
            </span>
            LINEで一言送るだけ
          </div>

          <h1 className="mt-5 text-4xl sm:text-6xl font-bold tracking-tight leading-[1.15] max-w-3xl">
            使うほど会社を理解し、
            <br />
            成果を出す
            <span className="text-brand-600">「AI広報部」</span>
          </h1>

          <p className="mt-6 text-base sm:text-lg muted max-w-2xl leading-relaxed">
            AI広報は、企業・サービス・商品・ブランド・店舗・個人の広報活動を、
            6人の専門AIがチームとなって支援するAI広報プラットフォームです。
            単に記事やSNS投稿を作るサービスではありません。
          </p>

          <ul className="mt-6 grid sm:grid-cols-2 gap-x-8 gap-y-2 max-w-2xl text-sm">
            {[
              "今日、何を発信するべきか",
              "どの媒体で届けるべきか",
              "どのような行動へ誘導するべきか",
              "何が問い合わせ・予約・購入につながったか",
              "次に何を改善するべきか",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
                {t}
              </li>
            ))}
          </ul>

          <p className="mt-6 text-sm muted max-w-2xl leading-relaxed">
            までを継続的に判断します。経営者や担当者は、日々の出来事をLINEで伝えるだけ。
            AIが必要な情報を対話形式で聞き取り、戦略立案、企画、取材、文章・画像制作、投稿、効果分析、改善まで行います。
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="h-12 px-7 inline-flex items-center rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700 transition-all active:scale-[0.98] shadow-lg shadow-brand-600/25"
            >
              無料で登録する
            </Link>
            <a
              href="#pricing"
              className="h-12 px-6 inline-flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] font-medium hover:bg-[var(--surface-3)] transition-colors"
            >
              料金を見る
            </a>
          </div>

          <p className="mt-5 text-xs muted">
            AI広報が目指すのは「投稿するAI」ではありません。認知を広げ、信頼を構築し、
            問い合わせ・予約・購入・採用などの成果につなげる、企業専属のAI広報部です。
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------- problems -- */}
      <section className="border-y border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">AI広報が解決する課題</h2>
          <p className="mt-3 muted text-sm max-w-2xl">
            多くの企業や店舗では、広報の重要性を理解していても、次のような問題を抱えています。
            AI広報は、これらの業務を一つの仕組みに統合します。
          </p>
          <ul className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger">
            {PROBLEMS.map((p) => (
              <li
                key={p}
                className="card p-4 text-sm flex items-start gap-3 hover:border-brand-300 transition-colors"
              >
                <span className="mt-0.5 text-[var(--text-muted)] shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M12 7.5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <circle cx="12" cy="16" r="1" fill="currentColor" />
                  </svg>
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------ LINE - */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              LINEがAI広報部の窓口
            </h2>
            <p className="mt-4 muted text-sm leading-relaxed">
              専用の管理画面を毎日開く必要はありません。AI秘書がLINEを通じて、
              企業の新しい情報や広報材料を収集します。
              一度に多くの質問をするのではなく、AI秘書が1問ずつ必要な情報を聞き取ります。
            </p>
            <p className="mt-4 muted text-sm leading-relaxed">
              ユーザーは、文章だけでなく、音声、写真、動画、資料を送ることができます。
              集めた情報は、SNS投稿、記事、導入事例、プレスリリース、FAQ、営業資料などへ展開されます。
            </p>
          </div>

          {/* LINE会話のモック */}
          <div className="card p-5 bg-[var(--surface)]">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[var(--border)]">
              <span className="text-[color:var(--color-writer)]">
                <LineIcon size={18} />
              </span>
              <span className="text-sm font-medium">AI秘書</span>
              <span className="ml-auto text-[11px] muted">オンライン</span>
            </div>
            <div className="space-y-3 stagger">
              <Bubble side="ai">本日、広報に使えそうな出来事はありますか？</Bubble>
              <Bubble side="me">ROOMKEYを新しい施設へ導入することが決まりました</Bubble>
              <Bubble side="ai">導入先の名称は公開してもよろしいですか？</Bubble>
              <Bubble side="me">はい、大丈夫です</Bubble>
              <Bubble side="ai">導入を決めた理由を一言で教えていただけますか？</Bubble>
              <Bubble side="ai" muted>
                解決したい運営上の課題／導入時期／写真やコメントの有無 を続けて確認します
              </Bubble>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- agents - */}
      <section id="agents" className="border-y border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            6人の専門AIによる広報チーム
          </h2>
          <p className="mt-3 muted text-sm max-w-2xl">
            秘書が情報を集め、ストラテジストが戦略を作り、ライターが伝え、クリエイターが魅せ、
            マーケターが届け、アナリストが成果を検証する。
          </p>

          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
            {AGENTS.map((a) => (
              <div
                key={a.key}
                className="card p-5 group hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
                style={{ borderTopColor: a.color, borderTopWidth: 2 }}
              >
                <div style={{ color: a.color }}>
                  <AgentIcon agent={a.key} size={44} />
                </div>
                <h3 className="mt-3 font-semibold">{a.name}</h3>
                <p className="mt-1 muted text-xs leading-relaxed">{a.role}</p>
                <ul className="mt-3 space-y-1">
                  {a.duties.slice(0, 6).map((d) => (
                    <li key={d} className="text-xs flex items-start gap-1.5">
                      <span
                        className="mt-[6px] h-1 w-1 rounded-full shrink-0"
                        style={{ background: a.color }}
                      />
                      {d}
                    </li>
                  ))}
                  {a.duties.length > 6 && (
                    <li className="text-xs muted pl-2.5">ほか {a.duties.length - 6}項目</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- cycle - */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="flex items-start gap-3">
          <span className="text-brand-600 mt-1">
            <LoopIcon size={26} />
          </span>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              広報活動の循環を、毎日続ける
            </h2>
            <p className="mt-3 muted text-sm max-w-2xl leading-relaxed">
              一般的な生成AIは、依頼された文章を作ります。一般的なSNSツールは、作成した投稿を予約・配信します。
              AI広報は、企業側からの指示を待つだけではありません。毎日の対話を通じて新しい情報を集め、
              市場・競合・過去の成果を分析し、「今日何をするべきか」を自ら判断します。
            </p>
          </div>
        </div>

        <ol className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 stagger">
          {CYCLE.map((c, i) => {
            const agent = AGENTS.find((a) => a.key === c.agent)!;
            return (
              <li key={c.label} className="card p-4 relative overflow-hidden">
                <span
                  className="absolute top-0 left-0 h-0.5 w-full"
                  style={{ background: agent.color }}
                  aria-hidden
                />
                <span className="text-[11px] muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-1 text-sm font-medium">{c.label}</p>
                <p className="mt-1.5 text-[11px]" style={{ color: agent.color }}>
                  {agent.name}
                </p>
              </li>
            );
          })}
        </ol>

        <p className="mt-6 text-sm muted max-w-3xl leading-relaxed">
          AIが毎日活動していても、毎日投稿するとは限りません。発信価値の高い情報がない日は、
          無理に投稿せず、情報収集、過去記事の改善、顧客導線の見直しなどを優先します。
        </p>
      </section>

      {/* --------------------------------------------------------- funnel -- */}
      <section className="border-y border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            広報目的から逆算した戦略設計
          </h2>
          <p className="mt-3 muted text-sm max-w-2xl">
            AI広報は、投稿数を増やすこと自体を目的にしません。最初に、企業が達成したい目的を設定し、
            目的に応じて重視するKPI・媒体・コンテンツ・CTA・投稿頻度を変更します。
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <span
                key={g.key}
                className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm bg-[var(--surface-2)]"
              >
                {g.label}
              </span>
            ))}
          </div>

          <div className="mt-10 card p-6">
            <p className="text-sm font-medium">
              例えば集客が目的であれば、単に閲覧数を見るのではなく、顧客導線全体を分析します。
            </p>
            <div className="viz-root mt-5 flex flex-wrap items-center gap-2">
              {["投稿を見る", "記事を読む", "CTAをクリックする", "問い合わせ・予約をする", "購入・成約する"].map(
                (s, i, arr) => (
                  <span key={s} className="flex items-center gap-2">
                    <span
                      className={`px-3 py-2 rounded-lg text-xs font-medium ${i < 2 ? "text-ink-900" : "text-white"}`}
                      style={{ background: `var(--ord-${i + 1})` }}
                    >
                      {s}
                    </span>
                    {i < arr.length - 1 && (
                      <span className="muted" aria-hidden>
                        →
                      </span>
                    )}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- features -- */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">主な機能</h2>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5 hover:border-brand-300 transition-colors">
              <h3 className="font-semibold text-sm">{f.title}</h3>
              <p className="mt-2 muted text-xs leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 card p-6">
          <div className="flex items-start gap-3">
            <span className="text-emerald-600 mt-0.5">
              <ShieldCheckIcon size={22} />
            </span>
            <div>
              <h3 className="font-semibold text-sm">ファクトチェックとリスク管理</h3>
              <p className="mt-1.5 muted text-xs leading-relaxed">
                投稿前にAIが以下を確認します。問題が見つかった場合は、理由と修正案を表示します。
                重大なクレーム、法的判断、炎上、事故、情報漏洩など、AIだけで判断できない案件は担当者へ引き継ぎます。
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {RISK_CHECKPOINTS.map((c) => (
                  <span
                    key={c}
                    className="px-2 py-1 rounded-md bg-[var(--surface-3)] text-[11px] muted"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- pricing -- */}
      <section id="pricing" className="border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">料金</h2>
          <p className="mt-3 muted text-sm">
            料金プランは一つだけです。対話頻度、投稿頻度、使用媒体は自由に設定できます。
          </p>

          <div className="mt-10 grid lg:grid-cols-3 gap-5">
            <div className="card p-6">
              <p className="text-xs font-medium muted">初期費用</p>
              <p className="mt-2 text-3xl font-bold tabular-nums">{yen(PRICING.setup)}</p>
              <p className="mt-1 text-xs muted">初回のみ</p>
              <ul className="mt-5 space-y-1.5">
                {SETUP_INCLUDES.map((s) => (
                  <li key={s} className="text-xs flex items-start gap-2">
                    <span className="text-emerald-600 mt-0.5 shrink-0">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="m5 13 4 4 10-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            <div className="card p-6 relative overflow-hidden ring-2 ring-brand-500">
              <span className="absolute top-4 right-4 px-2 py-0.5 rounded-full bg-brand-600 text-white text-[10px] font-bold">
                標準プラン
              </span>
              <p className="text-xs font-medium muted">月額料金</p>
              <p className="mt-2 text-3xl font-bold tabular-nums">
                {yen(PRICING.monthly)}
                <span className="text-sm font-medium muted">／月</span>
              </p>
              <p className="mt-1 text-xs muted">広報対象1件を含みます。</p>
              <ul className="mt-5 space-y-1.5 text-xs">
                {[
                  "6人の専門AIによる広報活動一式",
                  "AI広報カルテ / 公式事実データベース",
                  "承認フロー・権限設定",
                  "媒体別コンテンツ制作と配信",
                  "ファクトチェックとリスク管理",
                  "成果計測(売上まで)とAI広報スコア",
                  "月次AI広報会議",
                  "競合・市場・トレンド監視",
                  "危機広報モード",
                  "メディアリレーション",
                ].map((s) => (
                  <li key={s} className="flex items-start gap-2">
                    <span className="text-brand-600 mt-0.5 shrink-0">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="m5 13 4 4 10-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            <div className="card p-6">
              <p className="text-xs font-medium muted">追加広報対象</p>
              <p className="mt-2 text-3xl font-bold tabular-nums">
                {yen(PRICING.extraSubject)}
                <span className="text-sm font-medium muted">／月・1件</span>
              </p>
              <p className="mt-1 text-xs muted">
                企業、サービス、商品、ブランド、店舗、個人などを追加できます。
              </p>
              <div className="mt-5 space-y-3">
                <div>
                  <p className="text-xs font-medium">対話頻度</p>
                  <p className="mt-1 text-xs muted leading-relaxed">
                    毎日 / 週5回 / 週3回 / 週1回 / 曜日指定 / 必要なときだけ / 一時停止
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium">投稿頻度(媒体ごと)</p>
                  <p className="mt-1 text-xs muted leading-relaxed">
                    AIに任せる / 毎日 / 週○回 / 月○回 / 必要なときだけ / 投稿しない
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-6 text-xs muted">{PRICING.taxNote}</p>

          <div className="mt-10 text-center">
            <Link
              href="/signup"
              className="h-12 px-8 inline-flex items-center rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700 transition-all active:scale-[0.98] shadow-lg shadow-brand-600/25"
            >
              AI広報部をはじめる
            </Link>
            <p className="mt-3 text-xs muted">
              人を採用することなく、企業が本格的な広報部を持つためのAIエージェントサービスです。
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-5 py-8 flex flex-wrap items-center justify-between gap-4 text-xs muted">
          <span>AI広報 — 成果を出すAI広報部</span>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-[var(--text)]">
              ログイン
            </Link>
            <Link href="/signup" className="hover:text-[var(--text)]">
              新規登録
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Bubble({
  children,
  side,
  muted: isMuted,
}: {
  children: React.ReactNode;
  side: "ai" | "me";
  muted?: boolean;
}) {
  const isAi = side === "ai";
  return (
    <div className={`flex ${isAi ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] px-3.5 py-2.5 text-[13px] leading-relaxed rounded-2xl ${
          isAi
            ? `bg-[var(--surface-3)] rounded-tl-sm ${isMuted ? "muted text-xs" : ""}`
            : "bg-brand-600 text-white rounded-tr-sm"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
