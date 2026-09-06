import { supabaseAdmin } from "@/lib/supabase/admin";
import { listAllUsers, summarizeUsers } from "@/lib/admin";
import { Card, CardHeader, StatTile, Badge } from "@/components/ui";
import { TrendChart, ChannelBars } from "@/components/charts";
import { AGENT_LABEL, type AgentKey } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AdminActivityPage() {
  const sb = supabaseAdmin();
  const since = new Date(Date.now() - 30 * 864e5).toISOString();

  const [rows, { data: runs }, { data: content }, { data: posts }, { data: risks }] =
    await Promise.all([
      listAllUsers(),
      sb
        .from("ai_runs")
        .select("agent, model, cost_usd, ok, created_at, prompt_tokens, completion_tokens")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(3000),
      sb.from("content_items").select("status, created_at").gte("created_at", since),
      sb.from("posts").select("channel, status").gte("created_at", since),
      sb.from("risk_checks").select("overall, blocked").gte("created_at", since),
    ]);

  const s = summarizeUsers(rows);
  const allRuns = runs ?? [];

  const totalCost = allRuns.reduce((a, r) => a + Number(r.cost_usd ?? 0), 0);
  const failures = allRuns.filter((r) => !r.ok).length;
  const tokens = allRuns.reduce(
    (a, r) => a + Number(r.prompt_tokens ?? 0) + Number(r.completion_tokens ?? 0),
    0,
  );

  // 日別のAI実行回数
  const byDay = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const r of allRuns) {
    const key = String(r.created_at ?? "").slice(0, 10);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }

  // 担当AI別の実行数
  const byAgent = new Map<string, number>();
  for (const r of allRuns) byAgent.set(r.agent, (byAgent.get(r.agent) ?? 0) + 1);

  // 使用モデル別
  const byModel = new Map<string, number>();
  for (const r of allRuns) {
    const m = String(r.model ?? "unknown");
    if (m === "error" || m === "simulated") continue;
    byModel.set(m, (byModel.get(m) ?? 0) + 1);
  }

  const publishedPosts = (posts ?? []).filter((p) => p.status === "published").length;
  const blockedChecks = (risks ?? []).filter((r) => r.blocked).length;

  return (
    <>
      <h1 className="section-title text-[18px]">利用状況</h1>
      <p className="muted text-[12.5px] -mt-3 mb-5">
        直近30日間の、プラットフォーム全体の稼働状況です。
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <StatTile label="AI実行回数" value={allRuns.length} unit="回" accent="var(--color-brand-600)" />
        <StatTile
          label="AI利用料"
          value={`$${totalCost.toFixed(2)}`}
          accent="#0f6e8c"
          hint={`${(tokens / 1000).toFixed(0)}Kトークン`}
        />
        <StatTile
          label="失敗"
          value={failures}
          unit="件"
          accent={failures ? "#c8102e" : "#97a2ae"}
          hint={allRuns.length ? `${((failures / allRuns.length) * 100).toFixed(1)}%` : undefined}
        />
        <StatTile label="制作コンテンツ" value={(content ?? []).length} unit="件" accent="#1d6f4a" />
        <StatTile
          label="投稿停止 (リスク検出)"
          value={blockedChecks}
          unit="件"
          accent={blockedChecks ? "#a5641a" : "#97a2ae"}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        <Card className="lg:col-span-2">
          <CardHeader title="AI実行回数の推移" subtitle="直近30日間の日別。" />
          <TrendChart
            series={[
              {
                name: "AI実行",
                points: [...byDay.entries()].map(([d, n]) => ({
                  x: d.slice(5).replace("-", "/"),
                  y: n,
                })),
              },
            ]}
            unit="回"
          />
        </Card>

        <Card>
          <CardHeader title="担当AI別の実行数" />
          <ChannelBars
            items={[...byAgent.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => ({
                label: AGENT_LABEL[k as AgentKey] ?? k,
                value: v,
              }))}
            unit="回"
          />
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader title="使用モデルの内訳" subtitle="コスト管理の参考にしてください。" />
          <ChannelBars
            items={[...byModel.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([k, v]) => ({ label: k.split("/").pop() ?? k, value: v }))}
            unit="回"
          />
        </Card>

        <Card>
          <CardHeader title="全体サマリー" />
          <table className="spec-table">
            <tbody>
              <tr>
                <th>登録ユーザー</th>
                <td className="tabular-nums">{s.total} 名</td>
              </tr>
              <tr>
                <th>ご利用中</th>
                <td className="tabular-nums">
                  {s.active} 名{" "}
                  {s.pastDue + s.unpaid > 0 && (
                    <Badge tone="warn">要対応 {s.pastDue + s.unpaid}名</Badge>
                  )}
                </td>
              </tr>
              <tr>
                <th>7日以内に利用</th>
                <td className="tabular-nums">{s.activeLast7d} 名</td>
              </tr>
              <tr>
                <th>休眠 (31日以上)</th>
                <td className="tabular-nums">{s.dormant} 名</td>
              </tr>
              <tr>
                <th>公開された投稿</th>
                <td className="tabular-nums">{publishedPosts} 件</td>
              </tr>
              <tr>
                <th>運営管理者</th>
                <td className="tabular-nums">{s.admins} 名</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
