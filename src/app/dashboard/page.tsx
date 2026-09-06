import Link from "next/link";
import { redirect } from "next/navigation";
import { getOrgContext, supabaseServer } from "@/lib/supabase/server";
import { Card, CardHeader, Badge, StatTile, EmptyState, statusTone, riskTone } from "@/components/ui";
import { PageHeader, AgentButton, formatDateTime } from "@/components/dashboard/shared";
import { ScoreRing } from "@/components/charts";
import { AgentIcon, LineIcon, LoopIcon, SparkIcon } from "@/components/icons/AgentIcons";
import {
  AGENTS,
  CHANNEL_LABEL,
  CONTENT_TYPE_LABEL,
  GOAL_LABEL,
  STATUS_LABEL,
  RISK_LABEL,
  OUTCOME_CONVERSIONS,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/onboarding");
  if (!ctx.subjectId) redirect("/onboarding");

  const sb = await supabaseServer();
  const subjectId = ctx.subjectId;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [
    { data: pending },
    { data: proposals },
    { data: scheduled },
    { data: score },
    { data: kpis },
    { data: conversions },
    { data: signals },
    { data: intake },
    { data: lineAccounts },
    { data: latestNote },
  ] = await Promise.all([
    sb
      .from("content_items")
      .select("id, title, type, status, risk, summary, goal, created_at")
      .eq("subject_id", subjectId)
      .in("status", ["pending_approval", "on_hold"])
      .order("created_at", { ascending: false })
      .limit(6),
    sb
      .from("proposals")
      .select("id, theme, reason, goal, channels, cta, expected_effect, status, score, created_at")
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: false })
      .limit(4),
    sb
      .from("posts")
      .select("id, channel, scheduled_for, body, status")
      .eq("subject_id", subjectId)
      .eq("status", "scheduled")
      .order("scheduled_for")
      .limit(5),
    sb
      .from("pr_scores")
      .select("total, period, improvements")
      .eq("subject_id", subjectId)
      .order("period", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from("kpis").select("name, target_value, current_value, unit").eq("subject_id", subjectId).limit(4),
    sb
      .from("conversions")
      .select("type, amount")
      .eq("subject_id", subjectId)
      .gte("occurred_at", monthStart),
    sb
      .from("market_signals")
      .select("id, title, kind, importance, detected_at")
      .eq("subject_id", subjectId)
      .neq("kind", "page_hash")
      .order("detected_at", { ascending: false })
      .limit(4),
    sb
      .from("intake_items")
      .select("id, title, kind, newsworthiness, status, created_at")
      .eq("subject_id", subjectId)
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(5),
    sb.from("line_accounts").select("id").eq("org_id", ctx.orgId).limit(1),
    sb
      .from("notifications")
      .select("title, body, agent, created_at")
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const outcomes = (conversions ?? []).filter((c) => OUTCOME_CONVERSIONS.includes(c.type));
  const revenue = (conversions ?? []).reduce((a, c) => a + Number(c.amount ?? 0), 0);
  const clicks = (conversions ?? []).filter((c) => c.type === "cta_click").length;
  const lineConnected = (lineAccounts ?? []).length > 0;

  return (
    <>
      <PageHeader
        title="AI広報部ホーム"
        description="AI広報部が本日判断した内容と、承認をお待ちしている案件です。"
        action={
          <>
            <AgentButton
              label="今日の広報活動を実行"
              body={{ action: "daily_cycle", subjectId }}
              successMessage="AI広報部が本日の活動を実行しました"
            />
            <AgentButton
              label="今日の判断を見る"
              body={{ action: "decide_today", subjectId }}
              variant="secondary"
              successMessage="AIストラテジストの判断を取得しました"
            />
          </>
        }
      />

      {!lineConnected && (
        <div className="card p-4 mb-5 border-brand-300 bg-brand-50/60 dark:bg-brand-900/20">
          <div className="flex items-start gap-3">
            <span className="text-[color:var(--color-writer)] mt-0.5 shrink-0">
              <LineIcon size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">LINEを連携すると、AI秘書からのヒアリングが始まります</p>
              <p className="muted text-xs mt-1">
                設定画面で連携コードを発行し、LINEのトークに送信してください。以降は出来事を送るだけで広報が回ります。
              </p>
              <Link
                href="/dashboard/settings#line"
                className="inline-block mt-2 text-xs text-brand-600 font-medium hover:underline"
              >
                LINE連携の設定へ →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- 成果指標 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 stagger">
        <StatTile
          label="今月の成果 (問い合わせ等)"
          value={outcomes.length}
          unit="件"
          accent="var(--color-analyst)"
          hint="問い合わせ・予約・購入・成約など"
        />
        <StatTile
          label="CTAクリック"
          value={clicks}
          unit="回"
          accent="var(--color-marketer)"
          hint="専用リンク経由"
        />
        <StatTile
          label="成約金額"
          value={`¥${revenue.toLocaleString("ja-JP")}`}
          accent="var(--color-writer)"
          hint="今月の記録分"
        />
        <StatTile
          label="承認待ち"
          value={pending?.length ?? 0}
          unit="件"
          accent="var(--color-secretary)"
          hint="LINEからも承認できます"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* ------------------------------------------------------ 左カラム */}
        <div className="lg:col-span-2 space-y-5">
          {/* 承認待ち */}
          <Card>
            <CardHeader
              title="承認をお待ちしています"
              subtitle="発信理由・目的・CTA・期待効果を確認して、承認 / 修正 / 保留 / 投稿しない を選べます。"
              icon={
                <span className="text-[color:var(--color-secretary)]">
                  <AgentIcon agent="secretary" size={30} />
                </span>
              }
              action={
                <Link href="/dashboard/content" className="text-xs text-brand-600 hover:underline">
                  すべて見る
                </Link>
              }
            />

            {!pending?.length ? (
              <EmptyState
                icon={<SparkIcon size={30} />}
                title="承認待ちの広報案はありません"
                body="AI秘書が新しい広報材料を集めると、ここに提案が並びます。"
              />
            ) : (
              <ul className="space-y-2 stagger">
                {pending.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/dashboard/content/${c.id}`}
                      className="block p-3.5 rounded-xl border border-[var(--border)] hover:border-brand-300 hover:bg-[var(--surface-2)] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium leading-snug line-clamp-2">{c.title}</p>
                        <div className="flex gap-1.5 shrink-0">
                          <Badge tone={statusTone(c.status)}>{STATUS_LABEL[c.status] ?? c.status}</Badge>
                          {c.risk !== "none" && (
                            <Badge tone={riskTone(c.risk)}>{RISK_LABEL[c.risk]}</Badge>
                          )}
                        </div>
                      </div>
                      {c.summary && (
                        <p className="muted text-xs mt-1.5 line-clamp-2 leading-relaxed">{c.summary}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-[11px] muted">
                        <span>{CONTENT_TYPE_LABEL[c.type as keyof typeof CONTENT_TYPE_LABEL] ?? c.type}</span>
                        {c.goal && <span>· {GOAL_LABEL[c.goal as keyof typeof GOAL_LABEL]}</span>}
                        <span className="ml-auto tabular-nums">{formatDateTime(c.created_at)}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* 本日の提案 */}
          <Card>
            <CardHeader
              title="AIストラテジストの提案"
              subtitle="「なぜ今日これを発信するか」の理由つきで提示されます。"
              icon={
                <span className="text-[color:var(--color-strategist)]">
                  <AgentIcon agent="strategist" size={30} />
                </span>
              }
            />

            {!proposals?.length ? (
              <EmptyState
                title="まだ提案がありません"
                body="「今日の広報活動を実行」を押すと、AIが本日発信すべきかを判断します。"
              />
            ) : (
              <ul className="space-y-2.5 stagger">
                {proposals.map((p) => (
                  <li key={p.id} className="p-3.5 rounded-xl border border-[var(--border)]">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">{p.theme}</p>
                      <Badge tone={statusTone(p.status)}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
                    </div>
                    <p className="muted text-xs mt-1.5 leading-relaxed">{p.reason}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                      {p.goal && <Badge tone="brand">{GOAL_LABEL[p.goal as keyof typeof GOAL_LABEL]}</Badge>}
                      {(p.channels ?? []).map((ch: string) => (
                        <Badge key={ch}>{CHANNEL_LABEL[ch as keyof typeof CHANNEL_LABEL] ?? ch}</Badge>
                      ))}
                      {p.cta && <span className="text-[11px] muted">CTA: {p.cta}</span>}
                    </div>
                    {p.expected_effect && (
                      <p className="text-[11px] text-emerald-600 mt-2">期待効果: {p.expected_effect}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* 収集した広報材料 */}
          <Card>
            <CardHeader
              title="収集した広報材料"
              subtitle="LINEでのヒアリングから集まった、まだ発信に使っていない情報です。"
              icon={
                <span className="text-[color:var(--color-secretary)]">
                  <LineIcon size={26} />
                </span>
              }
              action={
                <Link href="/dashboard/intake" className="text-xs text-brand-600 hover:underline">
                  すべて見る
                </Link>
              }
            />
            {!intake?.length ? (
              <EmptyState
                title="未使用の広報材料はありません"
                body="LINEに出来事を送ると、AI秘書が1問ずつ聞き取って材料に変えます。"
              />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {intake.map((i) => (
                  <li key={i.id} className="py-2.5 flex items-center gap-3">
                    <span className="text-sm truncate flex-1">{i.title}</span>
                    <span className="text-[11px] muted tabular-nums shrink-0">
                      ニュース性 {i.newsworthiness}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* ------------------------------------------------------ 右カラム */}
        <div className="space-y-5">
          {/* スコア */}
          <Card>
            <CardHeader
              title="AI広報スコア"
              subtitle={score?.period ? `${score.period} 時点` : "月末に算出されます"}
              icon={
                <span className="text-[color:var(--color-analyst)]">
                  <AgentIcon agent="analyst" size={28} />
                </span>
              }
            />
            <div className="flex flex-col items-center">
              <ScoreRing value={score?.total ?? 0} />
              {(score?.improvements as Array<{ action?: string }> | null)?.length ? (
                <ul className="mt-4 space-y-1.5 w-full">
                  {(score!.improvements as Array<{ action?: string }>).slice(0, 3).map((im, i) => (
                    <li key={i} className="text-xs flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5 shrink-0">→</span>
                      <span className="leading-relaxed">{im.action}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted text-xs mt-3 text-center leading-relaxed">
                  スコアは10観点で算出し、点数の根拠と改善方法まで表示します。
                </p>
              )}
              <Link
                href="/dashboard/score"
                className="mt-4 text-xs text-brand-600 hover:underline"
              >
                内訳と改善提案を見る →
              </Link>
            </div>
          </Card>

          {/* KPI */}
          <Card>
            <CardHeader title="KPI進捗" subtitle="広報目的から逆算した指標" />
            {!kpis?.length ? (
              <p className="muted text-xs">
                KPIが未設定です。設定画面から目標を登録してください。
              </p>
            ) : (
              <ul className="space-y-3">
                {kpis.map((k) => {
                  const pct = k.target_value
                    ? Math.min(100, Math.round((k.current_value / k.target_value) * 100))
                    : 0;
                  return (
                    <li key={k.name}>
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <span className="text-xs font-medium truncate">{k.name}</span>
                        <span className="text-xs tabular-nums muted shrink-0">
                          {k.current_value}/{k.target_value}
                          {k.unit ?? ""}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-[width] duration-700"
                          style={{
                            width: `${pct}%`,
                            background: pct >= 80 ? "var(--color-good)" : "var(--color-brand-500)",
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* 投稿予定 */}
          <Card>
            <CardHeader
              title="投稿予定"
              icon={
                <span className="text-[color:var(--color-marketer)]">
                  <AgentIcon agent="marketer" size={28} />
                </span>
              }
              action={
                <Link href="/dashboard/calendar" className="text-xs text-brand-600 hover:underline">
                  一覧
                </Link>
              }
            />
            {!scheduled?.length ? (
              <p className="muted text-xs">予約されている投稿はありません。</p>
            ) : (
              <ul className="space-y-2.5">
                {scheduled.map((p) => (
                  <li key={p.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <Badge tone="info">
                        {CHANNEL_LABEL[p.channel as keyof typeof CHANNEL_LABEL] ?? p.channel}
                      </Badge>
                      <span className="muted tabular-nums">{formatDateTime(p.scheduled_for)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 leading-relaxed">{p.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* 市場シグナル */}
          <Card>
            <CardHeader
              title="市場・競合の変化"
              action={
                <Link href="/dashboard/monitoring" className="text-xs text-brand-600 hover:underline">
                  一覧
                </Link>
              }
            />
            {!signals?.length ? (
              <p className="muted text-xs">検知された変化はありません。</p>
            ) : (
              <ul className="space-y-2">
                {signals.map((s) => (
                  <li key={s.id} className="text-xs flex items-start gap-2">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                      style={{
                        background:
                          s.importance >= 4
                            ? "var(--color-bad)"
                            : s.importance >= 3
                              ? "var(--color-warn)"
                              : "var(--color-ink-400)",
                      }}
                    />
                    <span className="leading-relaxed">{s.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* AI広報部の稼働 */}
          <Card>
            <CardHeader
              title="AI広報部の稼働状況"
              icon={
                <span className="text-brand-600">
                  <LoopIcon size={24} />
                </span>
              }
            />
            <ul className="space-y-2">
              {AGENTS.map((a) => (
                <li key={a.key} className="flex items-center gap-2.5">
                  <span style={{ color: a.color }} className="shrink-0">
                    <AgentIcon agent={a.key} size={22} />
                  </span>
                  <span className="text-xs font-medium flex-1">{a.name}</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="稼働中" />
                </li>
              ))}
            </ul>
            {latestNote && (
              <p className="muted text-[11px] mt-4 pt-3 border-t border-[var(--border)] leading-relaxed">
                最新: {latestNote.title}
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
