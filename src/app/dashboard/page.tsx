import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Megaphone,
  MousePointerClick,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  CalendarDays,
  LineChart,
  Inbox,
} from "lucide-react";
import { getOrgContext, supabaseServer } from "@/lib/supabase/server";
import { Card, CardHeader, Badge, StatTile, EmptyState } from "@/components/ui";
import { statusTone, riskTone } from "@/lib/badge-tone";
import { PageHeader, AgentButton } from "@/components/dashboard/shared";
import { ProposalActions } from "@/components/dashboard/ProposalActions";
import { formatDateTime } from "@/lib/format-date";
import { ScoreRing } from "@/components/charts";
import {
  CHANNEL_LABEL,
  CONTENT_TYPE_LABEL,
  GOAL_LABEL,
  STATUS_LABEL,
  RISK_LABEL,
  OUTCOME_CONVERSIONS,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

function momDelta(current: number, previous: number): number | undefined {
  if (current === 0 && previous === 0) return undefined;
  if (previous === 0) return current > 0 ? 100 : undefined;
  return Math.round(((current - previous) / previous) * 100);
}

export default async function DashboardHome() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/onboarding");
  if (!ctx.subjectId) redirect("/onboarding");

  const sb = await supabaseServer();
  const subjectId = ctx.subjectId;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

  const [
    { data: pending },
    { data: proposals },
    { data: scheduled },
    { data: score },
    { data: kpis },
    { data: conversions },
    { data: prevConversions },
    { data: signals },
    { data: intake },
    { data: lineAccounts },
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
      .from("conversions")
      .select("type, amount")
      .eq("subject_id", subjectId)
      .gte("occurred_at", prevStart)
      .lt("occurred_at", monthStart),
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
  ]);

  const proposalIds = (proposals ?? []).map((p) => p.id);
  const { data: proposalContents } = proposalIds.length
    ? await sb.from("content_items").select("id, proposal_id, status").in("proposal_id", proposalIds)
    : { data: [] as Array<{ id: string; proposal_id: string; status: string }> };
  const contentByProposal = new Map(
    (proposalContents ?? []).map((c) => [c.proposal_id, { id: c.id, status: c.status }]),
  );

  const outcomes = (conversions ?? []).filter((c) => OUTCOME_CONVERSIONS.includes(c.type));
  const prevOutcomes = (prevConversions ?? []).filter((c) => OUTCOME_CONVERSIONS.includes(c.type));
  const revenue = (conversions ?? []).reduce((a, c) => a + Number(c.amount ?? 0), 0);
  const prevRevenue = (prevConversions ?? []).reduce((a, c) => a + Number(c.amount ?? 0), 0);
  const clicks = (conversions ?? []).filter((c) => c.type === "cta_click").length;
  const prevClicks = (prevConversions ?? []).filter((c) => c.type === "cta_click").length;
  const lineConnected = (lineAccounts ?? []).length > 0;
  const pendingCount = pending?.length ?? 0;

  return (
    <>
      <PageHeader
        title="AI広報部ホーム"
        description="収集・分析した情報をもとに、最適な広報活動を確認し、次の判断と承認を行います。"
        action={
          <>
            <AgentButton
              label="今日の広報活動を実行"
              body={{ action: "daily_cycle", subjectId }}
              successMessage="本日の広報活動を開始しました。完了するとお知らせに表示されます"
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
        <div className="card p-4 mb-6">
          <p className="text-sm font-medium">LINEを連携すると、AI秘書からのヒアリングが始まります</p>
          <p className="muted text-[13px] mt-1">
            設定画面で連携コードを発行し、公式アカウントとの1対1トークに送信してください。
          </p>
          <Link href="/dashboard/settings#line" className="inline-block mt-2 text-[13px] text-brand-700 font-medium hover:underline">
            LINE連携の設定へ
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatTile
          label="今月の成果（問い合わせ等）"
          value={outcomes.length}
          unit="件"
          hint="問い合わせ・予約・購入・成約"
          delta={momDelta(outcomes.length, prevOutcomes.length)}
          accent="var(--color-brand-600)"
          icon={<Megaphone size={18} strokeWidth={1.75} />}
        />
        <StatTile
          label="CTAクリック"
          value={clicks}
          unit="回"
          hint="専用リンク経由"
          delta={momDelta(clicks, prevClicks)}
          accent="var(--color-brand-500)"
          icon={<MousePointerClick size={18} strokeWidth={1.75} />}
        />
        <StatTile
          label="成約金額"
          value={`¥${revenue.toLocaleString("ja-JP")}`}
          hint="今月の記録分"
          delta={momDelta(revenue, prevRevenue)}
          accent="var(--color-good)"
          icon={<CircleDollarSign size={18} strokeWidth={1.75} />}
        />
        <StatTile
          label="承認待ち"
          value={pendingCount}
          unit="件"
          hint="確認して承認 / 修正できます"
          accent="var(--color-warn)"
          icon={<ClipboardCheck size={18} strokeWidth={1.75} />}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader
              title="承認をお待ちしています"
              subtitle="発信理由・目的・CTA・期待効果を確認し、承認 / 修正 / 保留を選べます。"
              icon={<ClipboardCheck size={16} strokeWidth={1.75} />}
              action={
                <Link href="/dashboard/content?status=pending_approval" className="text-[13px] text-brand-700 font-medium hover:underline">
                  すべて見る
                </Link>
              }
            />

            {!pending?.length ? (
              <EmptyState
                icon={<FileText size={28} strokeWidth={1.5} />}
                title="現在、承認待ちの案件はありません"
                body="新しい広報材料が登録され、制作が進むと、ここに確認依頼が表示されます。"
              />
            ) : (
              <ul className="space-y-3">
                {pending.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/dashboard/content/${c.id}`}
                      className="block p-4 rounded-xl border border-[var(--border)] hover:border-brand-200 hover:bg-brand-50/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[14px] font-medium leading-snug line-clamp-2">{c.title}</p>
                        <div className="flex gap-1.5 shrink-0">
                          <Badge tone={statusTone(c.status)}>{STATUS_LABEL[c.status] ?? c.status}</Badge>
                          {c.risk !== "none" && (
                            <Badge tone={riskTone(c.risk)}>{RISK_LABEL[c.risk]}</Badge>
                          )}
                        </div>
                      </div>
                      {c.summary && (
                        <p className="muted text-[13px] mt-2 line-clamp-2 leading-relaxed">{c.summary}</p>
                      )}
                      <div className="flex items-center gap-2 mt-3 text-[12px] muted">
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

          <Card>
            <CardHeader
              title="AIストラテジストの提案"
              subtitle="なぜ今日この発信が必要かを、根拠と期待効果つきで示します。"
              icon={<LineChart size={16} strokeWidth={1.75} />}
            />

            {!proposals?.length ? (
              <EmptyState
                title="まだ提案がありません"
                body="「今日の広報活動を実行」を押すと、本日発信すべきかを判断します。"
              />
            ) : (
              <ul className="space-y-4">
                {proposals.map((p) => {
                  const linked = contentByProposal.get(p.id);
                  const channels = Array.isArray(p.channels) ? p.channels : [];
                  return (
                    <li key={p.id} className="p-4 rounded-xl border border-[var(--border)]">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[15px] font-semibold leading-snug">{p.theme}</p>
                        <Badge tone={statusTone(p.status)}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
                      </div>
                      <p className="text-[13px] mt-2 leading-relaxed text-ink-700">{p.reason}</p>
                      {p.expected_effect && (
                        <p className="text-[13px] mt-2 text-ink-700">
                          <span className="font-medium text-ink-800">期待される効果：</span>
                          {p.expected_effect}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5 mt-3">
                        {p.goal && (
                          <Badge tone="brand">{GOAL_LABEL[p.goal as keyof typeof GOAL_LABEL]}</Badge>
                        )}
                        {channels.map((ch: string) => (
                          <Badge key={ch}>{CHANNEL_LABEL[ch as keyof typeof CHANNEL_LABEL] ?? ch}</Badge>
                        ))}
                      </div>
                      {p.cta && <p className="text-[12px] muted mt-2">CTA：{p.cta}</p>}
                      <ProposalActions contentId={linked?.id} status={linked?.status ?? p.status} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="収集した広報材料"
              subtitle="まだ発信に使っていない、ヒアリングから集まった情報です。"
              icon={<Inbox size={16} strokeWidth={1.75} />}
              action={
                <Link href="/dashboard/intake" className="text-[13px] text-brand-700 font-medium hover:underline">
                  すべて見る
                </Link>
              }
            />
            {!intake?.length ? (
              <EmptyState
                title="未使用の広報材料はありません"
                body="出来事をLINEに送ると、AI秘書が聞き取って材料に変えます。"
              />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {intake.map((i) => (
                  <li key={i.id} className="py-3 flex items-center gap-3">
                    <span className="text-[14px] truncate flex-1">{i.title}</span>
                    <span className="text-[12px] muted tabular-nums shrink-0">ニュース性 {i.newsworthiness}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="AI広報スコア"
              subtitle={score?.period ? `${score.period} 時点` : "月末に算出されます"}
              icon={<LineChart size={16} strokeWidth={1.75} />}
            />
            <div className="flex flex-col items-center">
              <ScoreRing value={score?.total ?? 0} />
              <p className="muted text-[13px] mt-3 text-center leading-relaxed">
                10観点で算出し、点数の根拠と改善方法まで表示します。
              </p>
              <Link href="/dashboard/score" className="mt-3 text-[13px] text-brand-700 font-medium hover:underline">
                内訳と改善提案を見る
              </Link>
            </div>
          </Card>

          <Card>
            <CardHeader title="KPI進捗" subtitle="広報目的から逆算した指標" />
            {!kpis?.length ? (
              <p className="muted text-[13px]">KPIが未設定です。設定画面から目標を登録してください。</p>
            ) : (
              <ul className="space-y-4">
                {kpis.map((k) => {
                  const pct = k.target_value
                    ? Math.min(100, Math.round((k.current_value / k.target_value) * 100))
                    : 0;
                  return (
                    <li key={k.name}>
                      <div className="flex items-baseline justify-between gap-2 mb-1.5">
                        <span className="text-[13px] font-medium truncate">{k.name}</span>
                        <span className="text-[12px] tabular-nums muted shrink-0">
                          {k.current_value}/{k.target_value}
                          {k.unit ?? ""}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden">
                        <div
                          className="h-full rounded-full"
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

          <Card>
            <CardHeader
              title="投稿予定"
              icon={<CalendarDays size={16} strokeWidth={1.75} />}
              action={
                <Link href="/dashboard/calendar" className="text-[13px] text-brand-700 font-medium hover:underline">
                  一覧
                </Link>
              }
            />
            {!scheduled?.length ? (
              <p className="muted text-[13px]">予約されている投稿はありません。</p>
            ) : (
              <ul className="space-y-3">
                {scheduled.map((p) => (
                  <li key={p.id} className="text-[13px]">
                    <div className="flex items-center gap-2">
                      <Badge tone="info">
                        {CHANNEL_LABEL[p.channel as keyof typeof CHANNEL_LABEL] ?? p.channel}
                      </Badge>
                      <span className="muted tabular-nums text-[12px]">{formatDateTime(p.scheduled_for)}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 leading-relaxed">{p.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="市場・競合の変化"
              action={
                <Link href="/dashboard/monitoring" className="text-[13px] text-brand-700 font-medium hover:underline">
                  一覧
                </Link>
              }
            />
            {!signals?.length ? (
              <p className="muted text-[13px]">検知された変化はありません。</p>
            ) : (
              <ul className="space-y-2.5">
                {signals.map((s) => (
                  <li key={s.id} className="text-[13px] flex items-start gap-2">
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
        </div>
      </div>
    </>
  );
}
