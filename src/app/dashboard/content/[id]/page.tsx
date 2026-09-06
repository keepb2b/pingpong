import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getOrgContext, supabaseServer } from "@/lib/supabase/server";
import { Card, CardHeader, Badge, statusTone, riskTone } from "@/components/ui";
import { PageHeader, formatDateTime } from "@/components/dashboard/shared";
import { ApprovalPanel, VariantEditor, ContentEditor } from "./Panels";
import { AgentIcon, ShieldCheckIcon, AlertIcon } from "@/components/icons/AgentIcons";
import {
  CONTENT_TYPE_LABEL,
  STATUS_LABEL,
  RISK_LABEL,
  GOAL_LABEL,
  CHANNEL_LABEL,
  type ChannelKey,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

type Finding = {
  checkpoint: string;
  severity: string;
  quote: string;
  problem: string;
  fix: string;
};

export default async function ContentDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");

  const { id } = await params;
  const sb = await supabaseServer();

  const { data: content } = await sb
    .from("content_items")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (!content) notFound();

  const [{ data: variants }, { data: check }, { data: creatives }, { data: approvals }, { data: proposal }, { data: posts }, { data: link }] =
    await Promise.all([
      sb.from("content_variants").select("*").eq("content_id", id).order("channel"),
      sb
        .from("risk_checks")
        .select("*")
        .eq("content_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb.from("creatives").select("id, svg, kind, channel, width, height").eq("content_id", id),
      sb
        .from("approvals")
        .select("action, comment, acted_via, acted_at")
        .eq("content_id", id)
        .order("created_at", { ascending: false }),
      content.proposal_id
        ? sb.from("proposals").select("*").eq("id", content.proposal_id).maybeSingle()
        : Promise.resolve({ data: null }),
      sb.from("posts").select("id, channel, status, scheduled_for, external_url, error").eq("content_id", id),
      sb.from("tracking_links").select("code, clicks").eq("content_id", id).is("post_id", null).maybeSingle(),
    ]);

  const findings = (check?.findings ?? []) as Finding[];
  const unverified = (check?.unverified_claims ?? []) as Array<{
    claim: string;
    why: string;
    how_to_verify: string;
  }>;

  return (
    <>
      <Link href="/dashboard/content" className="text-xs muted hover:text-[var(--text)] mb-3 inline-block">
        ← コンテンツ一覧
      </Link>

      <PageHeader
        title={content.title}
        description={content.summary ?? undefined}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={statusTone(content.status)}>
              {STATUS_LABEL[content.status] ?? content.status}
            </Badge>
            {content.risk !== "none" && (
              <Badge tone={riskTone(content.risk)}>{RISK_LABEL[content.risk]}</Badge>
            )}
            <Badge>{CONTENT_TYPE_LABEL[content.type as keyof typeof CONTENT_TYPE_LABEL] ?? content.type}</Badge>
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* 提案の背景 */}
          {proposal && (
            <Card>
              <CardHeader
                title="この発信をする理由"
                icon={
                  <span className="text-[color:var(--color-strategist)]">
                    <AgentIcon agent="strategist" size={28} />
                  </span>
                }
              />
              <p className="text-sm leading-relaxed">{proposal.reason}</p>
              <dl className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
                <Row label="広報目的" value={GOAL_LABEL[proposal.goal as keyof typeof GOAL_LABEL] ?? "—"} />
                <Row label="対象顧客" value={proposal.audience ?? "—"} />
                <Row
                  label="推奨媒体"
                  value={(proposal.channels ?? [])
                    .map((c: string) => CHANNEL_LABEL[c as ChannelKey] ?? c)
                    .join("・")}
                />
                <Row label="CTA" value={proposal.cta ?? "—"} />
                <Row label="投稿予定" value={formatDateTime(proposal.scheduled_for)} />
                <Row label="期待効果" value={proposal.expected_effect ?? "—"} />
                {proposal.cautions && <Row label="注意点" value={proposal.cautions} />}
              </dl>
            </Card>
          )}

          {/* 本文 */}
          <Card>
            <CardHeader
              title="本文"
              subtitle={`v${content.version} · AIライター制作`}
              icon={
                <span className="text-[color:var(--color-writer)]">
                  <AgentIcon agent="writer" size={28} />
                </span>
              }
            />
            <ContentEditor
              id={content.id}
              title={content.title}
              body={content.body ?? ""}
              cta={content.cta ?? ""}
              canEdit={["draft", "pending_approval", "on_hold", "fact_check"].includes(content.status)}
            />
          </Card>

          {/* 媒体別 */}
          <Card>
            <CardHeader
              title="媒体別の投稿文"
              subtitle="同じ文章を使い回さず、媒体・読者・文字数に合わせて作り分けています。"
              icon={
                <span className="text-[color:var(--color-marketer)]">
                  <AgentIcon agent="marketer" size={28} />
                </span>
              }
            />
            <VariantEditor
              contentId={content.id}
              subjectId={content.subject_id}
              variants={(variants ?? []).map((v) => ({
                id: v.id,
                channel: v.channel,
                body: v.body,
                hashtags: v.hashtags ?? [],
                cta: v.cta,
                char_count: v.char_count,
                optimized_for: v.optimized_for,
                ab_group: v.ab_group,
              }))}
            />
          </Card>

          {/* クリエイティブ */}
          {creatives && creatives.length > 0 && (
            <Card>
              <CardHeader
                title="クリエイティブ"
                subtitle="ブランドに合わせて生成した画像です。媒体別のサイズで書き出されます。"
                icon={
                  <span className="text-[color:var(--color-creator)]">
                    <AgentIcon agent="creator" size={28} />
                  </span>
                }
              />
              <div className="grid sm:grid-cols-2 gap-3">
                {creatives.map((cr) => (
                  <figure key={cr.id} className="rounded-[4px] overflow-hidden border border-[var(--border)]">
                    <div
                      className="w-full [&>svg]:w-full [&>svg]:h-auto [&>svg]:block"
                      dangerouslySetInnerHTML={{ __html: cr.svg ?? "" }}
                    />
                    <figcaption className="px-3 py-2 text-[11px] muted flex items-center justify-between">
                      <span>{cr.channel ? (CHANNEL_LABEL[cr.channel as ChannelKey] ?? cr.channel) : cr.kind}</span>
                      <span className="tabular-nums">
                        {cr.width}×{cr.height}
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* ------------------------------------------------------- 右カラム */}
        <div className="space-y-5">
          <ApprovalPanel
            contentId={content.id}
            status={content.status}
            blocked={Boolean(check?.blocked)}
            role={ctx.role}
          />

          {/* ファクトチェック */}
          <Card>
            <CardHeader
              title="ファクトチェックとリスク判定"
              icon={
                <span className={check?.passed ? "text-emerald-600" : "text-amber-600"}>
                  {check?.passed ? <ShieldCheckIcon size={24} /> : <AlertIcon size={24} />}
                </span>
              }
            />

            {!check ? (
              <p className="muted text-xs">まだ検査されていません。</p>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Badge tone={riskTone(check.overall)}>{RISK_LABEL[check.overall]}</Badge>
                  {check.blocked && <Badge tone="bad">投稿停止中</Badge>}
                </div>

                {findings.length === 0 ? (
                  <p className="text-xs text-emerald-600">問題は検出されませんでした。</p>
                ) : (
                  <ul className="space-y-3">
                    {findings.map((f, i) => (
                      <li key={i} className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <Badge tone={riskTone(f.severity)}>{f.checkpoint}</Badge>
                        </div>
                        {f.quote && (
                          <p className="mt-1.5 px-2 py-1 rounded bg-[var(--surface-3)] font-mono text-[11px]">
                            {f.quote}
                          </p>
                        )}
                        <p className="mt-1.5 leading-relaxed">{f.problem}</p>
                        <p className="mt-1 leading-relaxed text-emerald-700 dark:text-emerald-400">
                          修正案: {f.fix}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}

                {unverified.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-[var(--border)]">
                    <p className="text-xs font-medium mb-2">未確認の主張</p>
                    <ul className="space-y-2">
                      {unverified.map((u, i) => (
                        <li key={i} className="text-[11px] leading-relaxed">
                          <span className="font-medium">{u.claim}</span>
                          <span className="muted"> — {u.why}</span>
                          <Link
                            href="/dashboard/facts"
                            className="block mt-0.5 text-brand-600 hover:underline"
                          >
                            公式事実に登録する →
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </Card>

          {/* 計測 */}
          {link && (
            <Card>
              <CardHeader title="計測リンク" subtitle="この専用リンク経由の行動を追跡します。" />
              <p className="text-xs font-mono break-all px-2 py-1.5 rounded bg-[var(--surface-3)]">
                /t/{link.code}
              </p>
              <p className="mt-2 text-xs muted">
                クリック数: <span className="tabular-nums font-semibold">{link.clicks}</span>
              </p>
            </Card>
          )}

          {/* 投稿状況 */}
          {posts && posts.length > 0 && (
            <Card>
              <CardHeader title="投稿状況" />
              <ul className="space-y-2.5">
                {posts.map((p) => (
                  <li key={p.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <Badge tone="info">{CHANNEL_LABEL[p.channel as ChannelKey] ?? p.channel}</Badge>
                      <Badge tone={statusTone(p.status)}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
                    </div>
                    <p className="muted mt-1 tabular-nums">{formatDateTime(p.scheduled_for)}</p>
                    {p.external_url && (
                      <a
                        href={p.external_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-600 hover:underline break-all"
                      >
                        投稿を開く
                      </a>
                    )}
                    {p.error && <p className="text-red-600 mt-1 leading-relaxed">{p.error}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* 承認履歴 */}
          {approvals && approvals.length > 0 && (
            <Card>
              <CardHeader title="承認履歴" />
              <ul className="space-y-2">
                {approvals.map((a, i) => (
                  <li key={i} className="text-xs flex items-start gap-2">
                    <span className="muted tabular-nums shrink-0">{formatDateTime(a.acted_at)}</span>
                    <span>
                      {
                        { approve: "承認", revise: "修正", hold: "保留", reject: "投稿しない" }[
                          a.action as string
                        ]
                      }
                      <span className="muted"> ({a.acted_via})</span>
                      {a.comment && <span className="block muted mt-0.5">{a.comment}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="muted">{label}</dt>
      <dd className="mt-0.5 leading-relaxed">{value}</dd>
    </div>
  );
}
