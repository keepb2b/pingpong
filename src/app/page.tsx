import Link from "next/link";
import { PRICING, SETUP_INCLUDES, yen, GOALS, RISK_CHECKPOINTS } from "@/lib/constants";
import { LineIcon, LoopIcon, ShieldCheckIcon } from "@/components/icons/AgentIcons";
import { Logo, LogoMark } from "@/components/Logo";
import { SecretaryChatDemo } from "@/components/SecretaryChatDemo";
import { ProblemsDiagram } from "@/components/ProblemsDiagram";
import { AgentsTeam } from "@/components/AgentsTeam";
import { WorkflowCycle } from "@/components/WorkflowCycle";
import { FunnelFlow } from "@/components/FunnelFlow";



const FEATURES = [
  {
    title: "AI広報カルテ",
    body: "企業理念・沿革・商品・ターゲット・強み・文章トーン・禁止表現まで蓄積します。AIが何を記憶しているかを確認でき、「正しい / 修正する / 今回だけ / 長期的に記憶 / 忘れさせる」を選べます。",
  },
  {
    title: "公式事実データベース",
    body: "料金・実績・受賞歴などを出典と確認日つきで管理します。未確認の数字や古い料金が含まれていれば警告し、確認が取れるまで投稿を停止します。",
  },
  {
    title: "承認してから投稿",
    body: "導入初期は完全自動投稿を行いません。発信理由・目的・CTA・期待効果まで提示し、LINEから承認・修正・保留・投稿しないを選べます。慣れた後は媒体別に自動投稿を許可できます。",
  },
  {
    title: "成果を売上まで計測",
    body: "投稿ごとに専用リンクを発行し、表示から問い合わせ・予約・購入・成約・成約金額まで追跡します。最初に接触した投稿と最後に行動を起こした媒体の両方を評価します。",
  },
  {
    title: "競合・市場・トレンド監視",
    body: "競合サイトの更新、季節イベント、市場の変化を日々監視します。重要な変化はLINEで通知し、必要に応じて広報企画を提案します。",
  },
  {
    title: "危機広報",
    body: "事故・障害・炎上・情報漏洩が発生した際は危機広報モードへ切り替え、予約投稿を一括停止します。事実整理・公式声明案・想定問答・関係者向け案内までを用意します。",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-[var(--surface-2)]">
      {/* ------------------------------------------------------------ nav -- */}
      <header className="bg-[var(--surface)] border-b-[3px] border-brand-600 sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between gap-4">
          <Logo size={30} />

          <nav className="flex items-center gap-1 text-[13px]">
            <a href="#problems" className="hidden md:block px-3 py-2 muted hover:text-[var(--text)]">
              解決する課題
            </a>
            <a href="#agents" className="hidden md:block px-3 py-2 muted hover:text-[var(--text)]">
              6人の専門AI
            </a>
            <a href="#features" className="hidden md:block px-3 py-2 muted hover:text-[var(--text)]">
              機能
            </a>
            <a href="#pricing" className="hidden md:block px-3 py-2 muted hover:text-[var(--text)]">
              料金
            </a>
            <Link href="/login" className="btn btn-secondary h-9 px-4 text-[13px] ml-2">
              <span>ログイン</span>
            </Link>
            <Link href="/signup" className="btn btn-primary h-9 px-4 text-[13px]">
              <span>新規登録</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* ----------------------------------------------------------- hero -- */}
      <section className="bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:py-16 grid lg:grid-cols-[1.15fr_1fr] gap-10 items-start">
          <div>
            <p className="inline-flex items-center gap-1.5 bg-brand-600 text-white text-[12px] font-bold px-2.5 py-1 rounded-[2px]">
              <LineIcon size={14} />
              LINEで一言送るだけ
            </p>

            <h1 className="mt-4 font-serif text-[28px] sm:text-[36px] font-bold leading-[1.35] tracking-tight">
              使うほど会社を理解し、
              <br />
              成果を出す
              <span className="text-brand-600">「AI広報部」</span>
            </h1>

            <p className="mt-5 text-[14px] leading-[1.9] muted">
              AI広報は、企業・サービス・商品・ブランド・店舗・個人の広報活動を、6人の専門AIが
              チームとなって支援するAI広報プラットフォームです。単に記事やSNS投稿を作る
              サービスではありません。
            </p>

            <div className="mt-6 border border-[var(--border)] bg-[var(--surface-2)] rounded-[4px] p-4">
              <p className="text-[13px] font-bold mb-2.5">AI広報が継続的に判断すること</p>
              <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
                {[
                  "今日、何を発信するべきか",
                  "どの媒体で届けるべきか",
                  "どのような行動へ誘導するべきか",
                  "何が問い合わせ・購入につながったか",
                  "次に何を改善するべきか",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-1.5">
                    <span className="text-brand-600 font-bold shrink-0">・</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-5 text-[13px] leading-[1.9] muted">
              経営者や担当者は、日々の出来事をLINEで伝えるだけ。AIが必要な情報を対話形式で
              聞き取り、戦略立案、企画、取材、文章・画像制作、投稿、効果分析、改善まで行います。
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="btn btn-primary h-12 px-8 text-[15px]">
                <span>無料で登録する</span>
              </Link>
              <a href="#pricing" className="btn btn-secondary h-12 px-6 text-[15px]">
                <span>料金を見る</span>
              </a>
            </div>
          </div>

          {/* LINE会話の例 */}
          <div className="card overflow-hidden">
            <div className="band px-4 py-2.5 flex items-center gap-2">
              <LineIcon size={16} />
              <span className="text-[13px] font-bold">AI秘書とのやり取り</span>
            </div>
            <SecretaryChatDemo />
            <p className="px-4 py-3 text-[11.5px] muted leading-relaxed border-t border-[var(--border)]">
              一度に多くの質問をせず、AI秘書が1問ずつ聞き取ります。文章のほか、写真・動画・
              資料もそのまま送れます。
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- problems -- */}
      <section id="problems" className="mx-auto max-w-6xl px-5 py-14">
        <ProblemsDiagram />
      </section>

      {/* ---------------------------------------------------------- agents - */}
      <section id="agents" aria-labelledby="agents-heading" className="px-4 py-8 sm:px-8">
        <AgentsTeam />
      </section>

      {/* ----------------------------------------------------------- cycle - */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="section-title text-[20px] flex items-center gap-2">
          <span className="text-brand-600">
            <LoopIcon size={20} />
          </span>
          広報活動の循環を、毎日続ける
        </h2>
        <p className="muted text-[13px] mb-6 leading-[1.9]">
          一般的な生成AIは、依頼された文章を作ります。一般的なSNSツールは、作成した投稿を
          予約・配信します。AI広報は、企業側からの指示を待つだけではありません。毎日の対話を
          通じて新しい情報を集め、市場・競合・過去の成果を分析し、「今日何をするべきか」を
          自ら判断します。
        </p>

        <WorkflowCycle />

        <div className="mt-5 card p-4 border-l-[3px] border-l-[var(--color-accent-500)]">
          <p className="font-serif text-[13px] leading-[1.9]">
            AIが毎日活動していても、毎日投稿するとは限りません。発信価値の高い情報がない日は、
            無理に投稿せず、情報収集、過去記事の改善、顧客導線の見直しなどを優先します。
          </p>
        </div>
      </section>

      {/* --------------------------------------------------------- funnel -- */}
      <section className="bg-[var(--surface)] border-y border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="section-title text-[20px]">広報目的から逆算した戦略設計</h2>
          <p className="muted text-[13px] mb-6 leading-[1.9]">
            AI広報は、投稿数を増やすこと自体を目的にしません。最初に企業が達成したい目的を設定し、
            目的に応じて重視するKPI・媒体・コンテンツ・CTA・投稿頻度を変更します。
          </p>

          <div className="flex flex-wrap gap-2 mb-8">
            {GOALS.map((g) => (
              <span
                key={g.key}
                className="px-3 py-1.5 border border-[var(--border-strong)] rounded-[3px] text-[13px] bg-[var(--surface-2)]"
              >
                {g.label}
              </span>
            ))}
          </div>

          <FunnelFlow />
        </div>
      </section>

      {/* ------------------------------------------------------- features -- */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="section-title text-[20px]">主な機能</h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-4">
              <h3 className="heading-bar text-[14px] mb-2">{f.title}</h3>
              <p className="muted text-[12.5px] leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 card p-5">
          <h3 className="heading-bar is-accent text-[14px] mb-2 flex items-center gap-2">
            <span className="text-[#1d6f4a]">
              <ShieldCheckIcon size={18} />
            </span>
            ファクトチェックとリスク管理
          </h3>
          <p className="muted text-[12.5px] leading-relaxed mb-3">
            投稿前にAIが以下を確認します。問題が見つかった場合は、理由と修正案を表示します。
            重大なクレーム、法的判断、炎上、事故、情報漏洩など、AIだけで判断できない案件は
            担当者へ引き継ぎます。
          </p>
          <div className="flex flex-wrap gap-1.5">
            {RISK_CHECKPOINTS.map((c) => (
              <span
                key={c}
                className="px-2 py-1 border border-[var(--border)] bg-[var(--surface-2)] rounded-[2px] text-[11.5px]"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- pricing -- */}
      <section id="pricing" className="bg-[var(--surface)] border-t border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="section-title text-[20px]">料金</h2>
          <p className="muted text-[13px] mb-6">
            料金プランは一つだけです。対話頻度、投稿頻度、使用媒体は自由に設定できます。
          </p>

          {/* 料金表 */}
          <div className="overflow-x-auto scroll-thin mb-6">
            <table className="data-table border border-[var(--border)]">
              <thead>
                <tr>
                  <th>項目</th>
                  <th className="text-right">料金（税抜）</th>
                  <th>内容</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-semibold whitespace-nowrap">初期費用</td>
                  <td className="text-right tabular-nums font-bold whitespace-nowrap">
                    {yen(PRICING.setup)}
                  </td>
                  <td className="text-[12px]">初回のみ。初期設定一式が含まれます。</td>
                </tr>
                <tr>
                  <td className="font-semibold whitespace-nowrap">月額料金</td>
                  <td className="text-right tabular-nums font-bold whitespace-nowrap">
                    {yen(PRICING.monthly)}／月
                  </td>
                  <td className="text-[12px]">広報対象1件を含みます。</td>
                </tr>
                <tr>
                  <td className="font-semibold whitespace-nowrap">追加広報対象</td>
                  <td className="text-right tabular-nums font-bold whitespace-nowrap">
                    {yen(PRICING.extraSubject)}／月・1件
                  </td>
                  <td className="text-[12px]">
                    企業、サービス、商品、ブランド、店舗、個人などを追加できます。
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <div className="card p-5">
              <h3 className="heading-bar text-[14px] mb-3">初期費用に含まれるもの</h3>
              <ul className="grid sm:grid-cols-2 gap-x-5 gap-y-1">
                {SETUP_INCLUDES.map((s) => (
                  <li key={s} className="text-[12.5px] flex items-start gap-1.5">
                    <span className="text-[#1d6f4a] font-bold shrink-0">✓</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            <div className="card p-5">
              <h3 className="heading-bar text-[14px] mb-3">月額料金に含まれるもの</h3>
              <ul className="grid sm:grid-cols-2 gap-x-5 gap-y-1">
                {[
                  "6人の専門AIによる広報活動一式",
                  "AI広報カルテ / 公式事実データベース",
                  "承認フロー・権限設定",
                  "媒体別コンテンツ制作と配信",
                  "ファクトチェックとリスク管理",
                  "成果計測（売上まで）",
                  "AI広報スコア",
                  "月次AI広報会議",
                  "競合・市場・トレンド監視",
                  "コメント・口コミ管理",
                  "危機広報モード",
                  "メディアリレーション",
                ].map((s) => (
                  <li key={s} className="text-[12.5px] flex items-start gap-1.5">
                    <span className="text-brand-600 font-bold shrink-0">✓</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <table className="spec-table mt-5">
            <tbody>
              <tr>
                <th>対話頻度</th>
                <td>毎日 / 週5回 / 週3回 / 週1回 / 曜日指定 / 必要なときだけ / 一時停止</td>
              </tr>
              <tr>
                <th>投稿頻度（媒体ごと）</th>
                <td>AIに任せる / 毎日 / 週○回 / 月○回 / 必要なときだけ / 投稿しない</td>
              </tr>
              <tr>
                <th>対応媒体</th>
                <td>X / Instagram / Facebook / Googleビジネスプロフィール / WordPress ほか</td>
              </tr>
            </tbody>
          </table>

          <p className="mt-4 text-[12px] muted">{PRICING.taxNote}</p>

          <div className="mt-8 border-t border-[var(--border)] pt-8 text-center">
            <Link href="/signup" className="btn btn-primary h-12 px-10 text-[15px]">
              <span>AI広報部をはじめる</span>
            </Link>
            <p className="mt-3 font-serif text-[12.5px] muted">
              人を採用することなく、企業が本格的な広報部を持つためのAIエージェントサービスです。
            </p>
          </div>
        </div>
      </section>

      <footer className="bg-ink-900 text-white/70">
        <div className="mx-auto max-w-6xl px-5 py-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <LogoMark size={26} />
            <span className="font-serif text-[13px] text-white font-bold">AI広報</span>
            <span className="font-serif text-[11.5px] font-medium">成果を出すAI広報部</span>
          </div>
          <div className="flex gap-5 text-[12.5px]">
            <Link href="/login" className="hover:text-white">
              ログイン
            </Link>
            <Link href="/signup" className="hover:text-white">
              新規登録
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
