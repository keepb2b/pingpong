import { listAllUsers, summarizeUsers } from "@/lib/admin";
import { Card, CardHeader, StatTile } from "@/components/ui";
import { TrendChart, ChannelBars } from "@/components/charts";
import { UserTable } from "./UserTable";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const rows = await listAllUsers();
  const s = summarizeUsers(rows);

  return (
    <>
      <h1 className="section-title text-[18px]">ユーザー管理</h1>

      {/* -------------------------------------------------------- 概況 --- */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
        <StatTile label="総ユーザー数" value={s.total} unit="名" accent="var(--color-brand-600)" />
        <StatTile label="ご利用中" value={s.active} unit="名" accent="#1d6f4a" />
        <StatTile label="未契約" value={s.noPlan} unit="名" accent="#97a2ae" />
        <StatTile
          label="支払い確認中"
          value={s.pastDue + s.unpaid}
          unit="名"
          accent="#c8102e"
          hint="要対応"
        />
        <StatTile
          label="7日以内に利用"
          value={s.activeLast7d}
          unit="名"
          accent="#0f6e8c"
          hint={`30日以内 ${s.activeLast30d}名`}
        />
        <StatTile
          label="初期設定 未完了"
          value={s.notOnboarded}
          unit="名"
          accent="#a5641a"
          hint={`完了 ${s.onboarded}名`}
        />
      </div>

      {/* -------------------------------------------------------- 図表 --- */}
      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        <Card className="lg:col-span-2">
          <CardHeader
            title="新規登録の推移"
            subtitle="直近12か月の月別登録数。"
          />
          <TrendChart series={[{ name: "新規登録", points: s.signupsByMonth }]} unit="名" />
        </Card>

        <Card>
          <CardHeader title="契約状態の内訳" />
          <ChannelBars items={s.planBreakdown} unit="名" />
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        <Card>
          <CardHeader title="最終利用からの経過" subtitle="休眠ユーザーの把握に使います。" />
          <ChannelBars items={s.activityBreakdown} unit="名" />
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="利用規模の上位" subtitle="コンテンツ制作数の多い組織。" />
          <ChannelBars
            items={rows
              .filter((r) => r.org_name)
              .sort((a, b) => b.content_count - a.content_count)
              .slice(0, 6)
              .map((r) => ({ label: r.org_name!, value: r.content_count }))}
            unit="件"
          />
        </Card>
      </div>

      {/* ------------------------------------------------------ 一覧 ----- */}
      <Card padded={false}>
        <div className="p-4 sm:p-5">
          <CardHeader
            title="登録ユーザー一覧"
            subtitle="行をクリックすると詳細を表示します。検索と絞り込みができます。"
          />
          <UserTable rows={rows} />
        </div>
      </Card>
    </>
  );
}
