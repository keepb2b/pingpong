import { redirect } from "next/navigation";
import { getOrgContext, supabaseServer } from "@/lib/supabase/server";
import { Card, CardHeader, Badge, EmptyState } from "@/components/ui";
import { PageHeader, ActionButton } from "@/components/dashboard/shared";
import { formatDateTime } from "@/lib/format-date";
import { AddOutlet, CreatePitch } from "./Actions";

export const dynamic = "force-dynamic";

const PITCH_STATUS: Record<string, { label: string; tone: "neutral" | "warn" | "good" | "info" }> = {
  draft: { label: "下書き", tone: "neutral" },
  sent: { label: "送付済み", tone: "warn" },
  replied: { label: "返信あり", tone: "info" },
  covered: { label: "掲載", tone: "good" },
  declined: { label: "見送り", tone: "neutral" },
};

export default async function MediaPage() {
  const ctx = await getOrgContext();
  if (!ctx?.subjectId) redirect("/onboarding");

  const sb = await supabaseServer();

  const [{ data: outlets }, { data: pitches }, { data: releases }] = await Promise.all([
    sb
      .from("media_outlets")
      .select("*")
      .eq("org_id", ctx.orgId)
      .order("fit_score", { ascending: false }),
    sb
      .from("media_pitches")
      .select("*, media_outlets(name)")
      .eq("subject_id", ctx.subjectId)
      .order("created_at", { ascending: false })
      .limit(30),
    sb
      .from("content_items")
      .select("id, title, status, created_at")
      .eq("subject_id", ctx.subjectId)
      .in("type", ["press_release", "media_pitch"])
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const covered = (pitches ?? []).filter((p) => p.coverage_url);

  return (
    <>
      <PageHeader
        title="メディアリレーション"
        description="プレスリリースを作るだけでなく、掲載につながる活動を支援します。同じ媒体への過剰送信は自動的に防止されます。"
        agent="writer"
        action={
          <>
            <CreatePitch subjectId={ctx.subjectId} outlets={outlets ?? []} releases={releases ?? []} />
            <AddOutlet />
          </>
        }
      />

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader title="提案の状況" subtitle="送付履歴・返信・取材・掲載実績を管理します。" />

            {!pitches?.length ? (
              <EmptyState
                title="まだ提案がありません"
                body="プレスリリースやメディア向け提案文を作成し、相性のよい媒体へ送付します。"
              />
            ) : (
              <ul className="space-y-3">
                {pitches.map((p) => {
                  const outlet = p.media_outlets as unknown as { name: string } | null;
                  const st = PITCH_STATUS[p.status] ?? PITCH_STATUS.draft;
                  return (
                    <li key={p.id} className="p-4 rounded-[4px] border border-[var(--border)]">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Badge tone={st.tone}>{st.label}</Badge>
                        {outlet && <span className="text-xs font-medium">{outlet.name}</span>}
                        <span className="ml-auto muted text-[11px] tabular-nums">
                          {p.sent_at ? `送付 ${formatDateTime(p.sent_at)}` : formatDateTime(p.created_at)}
                        </span>
                      </div>

                      <p className="text-sm font-medium leading-snug">{p.subject_line}</p>
                      <p className="muted text-xs mt-1.5 leading-relaxed line-clamp-4 whitespace-pre-wrap">
                        {p.body}
                      </p>

                      {p.coverage_url && (
                        <a
                          href={p.coverage_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-brand-600 hover:underline mt-2 inline-block break-all"
                        >
                          掲載記事を開く →
                        </a>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        {p.status === "draft" && (
                          <ActionButton
                            label="送付済みにする"
                            path="/api/reputation"
                            body={{
                              action: "update_pitch",
                              id: p.id,
                              status: "sent",
                              outletId: p.outlet_id,
                            }}
                          />
                        )}
                        {p.status === "sent" && (
                          <>
                            <ActionButton
                              label="返信あり"
                              path="/api/reputation"
                              body={{ action: "update_pitch", id: p.id, status: "replied" }}
                            />
                            <ActionButton
                              label="見送り"
                              path="/api/reputation"
                              body={{ action: "update_pitch", id: p.id, status: "declined" }}
                              variant="ghost"
                            />
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {releases && releases.length > 0 && (
            <Card>
              <CardHeader title="プレスリリース・提案文" subtitle="AIライターが制作した原稿です。" />
              <ul className="divide-y divide-[var(--border)]">
                {releases.map((r) => (
                  <li key={r.id} className="py-2.5">
                    <a
                      href={`/dashboard/content/${r.id}`}
                      className="text-xs hover:text-brand-600 flex items-center gap-3"
                    >
                      <span className="truncate flex-1">{r.title}</span>
                      <span className="muted tabular-nums shrink-0">
                        {formatDateTime(r.created_at)}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="媒体リスト" subtitle="相性スコアの高い順" />
            {!outlets?.length ? (
              <p className="muted text-xs">媒体が未登録です。業界誌・地域メディアを登録してください。</p>
            ) : (
              <ul className="space-y-3">
                {outlets.map((o) => (
                  <li key={o.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{o.name}</span>
                      {o.fit_score > 0 && (
                        <Badge tone="brand" className="ml-auto shrink-0">
                          相性 {o.fit_score}
                        </Badge>
                      )}
                    </div>
                    <p className="muted mt-0.5">
                      {[o.category, o.region].filter(Boolean).join(" · ") || "—"}
                    </p>
                    {o.last_contacted_at && (
                      <p className="muted mt-0.5 tabular-nums">
                        最終連絡: {formatDateTime(o.last_contacted_at)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="掲載実績" />
            {!covered.length ? (
              <p className="muted text-xs">掲載実績はまだありません。</p>
            ) : (
              <ul className="space-y-2">
                {covered.map((p) => (
                  <li key={p.id} className="text-xs">
                    <a
                      href={p.coverage_url!}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-600 hover:underline"
                    >
                      {p.subject_line}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="過剰送信の防止" />
            <p className="text-xs leading-relaxed muted">
              同じ媒体へ30日以内に提案を送ろうとすると警告し、送付を止めます。
              関係を損なわない間隔を保ちます。
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
