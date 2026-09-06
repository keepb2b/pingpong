import Link from "next/link";
import { redirect } from "next/navigation";
import { getOrgContext, supabaseServer } from "@/lib/supabase/server";
import { Card, CardHeader, Badge, EmptyState, statusTone } from "@/components/ui";
import { PageHeader, ActionButton, formatDateTime } from "@/components/dashboard/shared";
import { CHANNEL_LABEL, STATUS_LABEL, type ChannelKey } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const ctx = await getOrgContext();
  if (!ctx?.subjectId) redirect("/onboarding");

  const sb = await supabaseServer();

  const { data: posts } = await sb
    .from("posts")
    .select("id, channel, body, status, scheduled_for, published_at, external_url, error, content_id")
    .eq("subject_id", ctx.subjectId)
    .order("scheduled_for", { ascending: true, nullsFirst: false })
    .limit(120);

  const now = Date.now();
  const upcoming = (posts ?? []).filter(
    (p) => p.status === "scheduled" && new Date(p.scheduled_for ?? 0).getTime() >= now,
  );
  const overdue = (posts ?? []).filter(
    (p) => p.status === "scheduled" && new Date(p.scheduled_for ?? 0).getTime() < now,
  );
  const published = (posts ?? [])
    .filter((p) => p.status === "published")
    .sort((a, b) => new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime());
  const failed = (posts ?? []).filter((p) => p.status === "failed" || p.status === "on_hold");

  // 日付ごとにまとめる
  const byDay = upcoming.reduce<Record<string, typeof upcoming>>((acc, p) => {
    const day = new Date(p.scheduled_for!).toLocaleDateString("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
    (acc[day] ??= []).push(p);
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="投稿予定"
        description="承認済みのコンテンツが、媒体ごとに最適な曜日・時間帯で予約されています。"
        agent="marketer"
      />

      {overdue.length > 0 && (
        <Card className="mb-5 border-amber-300">
          <CardHeader
            title="配信待ちの投稿"
            subtitle="予定時刻を過ぎています。配信ジョブが動くと自動的に投稿されます。"
            action={<Badge tone="warn">{overdue.length}件</Badge>}
          />
          <ul className="space-y-2">
            {overdue.map((p) => (
              <li key={p.id} className="flex items-center gap-3 text-xs">
                <Badge tone="info">{CHANNEL_LABEL[p.channel as ChannelKey] ?? p.channel}</Badge>
                <span className="truncate flex-1">{p.body}</span>
                <span className="muted tabular-nums shrink-0">{formatDateTime(p.scheduled_for)}</span>
                <ActionButton
                  label="今すぐ投稿"
                  path="/api/workflow"
                  body={{ action: "publish_now", id: p.id }}
                  variant="primary"
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader title="これからの投稿" action={<Badge tone="brand">{upcoming.length}件</Badge>} />

            {!upcoming.length ? (
              <EmptyState
                title="予約されている投稿はありません"
                body="コンテンツを承認すると、媒体ごとに投稿が予約されます。"
              />
            ) : (
              <div className="space-y-5">
                {Object.entries(byDay).map(([day, list]) => (
                  <div key={day}>
                    <p className="text-xs font-semibold mb-2 sticky top-16 bg-[var(--surface)] py-1">
                      {day}
                    </p>
                    <ul className="space-y-2">
                      {list.map((p) => (
                        <li
                          key={p.id}
                          className="p-3.5 rounded-[4px] border border-[var(--border)] hover:border-brand-300 transition-colors"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-semibold tabular-nums">
                              {new Date(p.scheduled_for!).toLocaleTimeString("ja-JP", {
                                timeZone: "Asia/Tokyo",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <Badge tone="info">
                              {CHANNEL_LABEL[p.channel as ChannelKey] ?? p.channel}
                            </Badge>
                          </div>
                          <p className="text-xs leading-relaxed whitespace-pre-wrap line-clamp-4">
                            {p.body}
                          </p>
                          <div className="mt-2.5 flex items-center gap-2">
                            {p.content_id && (
                              <Link
                                href={`/dashboard/content/${p.content_id}`}
                                className="text-[11px] text-brand-600 hover:underline"
                              >
                                コンテンツを見る
                              </Link>
                            )}
                            <div className="ml-auto flex gap-2">
                              <ActionButton
                                label="今すぐ投稿"
                                path="/api/workflow"
                                body={{ action: "publish_now", id: p.id }}
                              />
                              <ActionButton
                                label="停止"
                                path="/api/workflow"
                                body={{ action: "cancel_post", id: p.id }}
                                variant="ghost"
                              />
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {failed.length > 0 && (
            <Card>
              <CardHeader title="停止・失敗した投稿" />
              <ul className="space-y-2">
                {failed.map((p) => (
                  <li key={p.id} className="text-xs p-3 rounded-[4px] bg-[var(--surface-2)]">
                    <div className="flex items-center gap-2">
                      <Badge tone="info">{CHANNEL_LABEL[p.channel as ChannelKey] ?? p.channel}</Badge>
                      <Badge tone={statusTone(p.status)}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
                    </div>
                    <p className="mt-1.5 line-clamp-2">{p.body}</p>
                    {p.error && <p className="text-red-600 mt-1 leading-relaxed">{p.error}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div>
          <Card>
            <CardHeader title="投稿済み" action={<Badge tone="good">{published.length}件</Badge>} />
            {!published.length ? (
              <p className="muted text-xs">まだ投稿はありません。</p>
            ) : (
              <ul className="space-y-3">
                {published.slice(0, 15).map((p) => (
                  <li key={p.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <Badge tone="info">{CHANNEL_LABEL[p.channel as ChannelKey] ?? p.channel}</Badge>
                      <span className="muted tabular-nums">{formatDateTime(p.published_at)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 leading-relaxed">{p.body}</p>
                    {p.external_url && (
                      <a
                        href={p.external_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-600 hover:underline"
                      >
                        投稿を開く →
                      </a>
                    )}
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
