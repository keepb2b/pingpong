import { redirect } from "next/navigation";
import { getOrgContext, supabaseServer } from "@/lib/supabase/server";
import { Card, CardHeader, Badge, Breadcrumb } from "@/components/ui";
import { PageHeader, formatDateTime } from "@/components/dashboard/shared";
import { AccountForm, PasswordForm, DeleteAccountForm } from "./Forms";
import { ROLE_LABEL, SUBJECT_TYPE_LABEL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");

  const sb = await supabaseServer();

  const [{ data: profile }, { data: org }, { data: subjects }, { data: subscription }] =
    await Promise.all([
      sb.from("profiles").select("*").eq("id", ctx.userId).maybeSingle(),
      sb.from("organizations").select("*").eq("id", ctx.orgId).maybeSingle(),
      sb
        .from("subjects")
        .select("id,name,type,active")
        .eq("org_id", ctx.orgId)
        .order("is_primary", { ascending: false }),
      sb.from("subscriptions").select("status, current_period_end").eq("org_id", ctx.orgId).maybeSingle(),
    ]);

  return (
    <>
      <Breadcrumb
        items={[{ label: "ホーム", href: "/dashboard" }, { label: "アカウント情報" }]}
      />

      <PageHeader
        title="アカウント情報"
        description="お客様の登録情報とパスワードを変更できます。プロフィール画像はヘッダーに表示されます。"
      />

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader
              title="登録情報の編集"
              subtitle="お名前とプロフィール画像は、承認履歴や社内の表示に使用されます。"
            />
            <AccountForm
              userId={ctx.userId}
              initial={{
                display_name: profile?.display_name ?? "",
                avatar_url: profile?.avatar_url ?? null,
                email: profile?.email ?? "",
                phone: profile?.phone ?? "",
                company_name: profile?.company_name ?? "",
                department: profile?.department ?? "",
                job_title: profile?.job_title ?? "",
                bio: profile?.bio ?? "",
              }}
            />
          </Card>

          <Card>
            <CardHeader
              title="パスワードの変更"
              subtitle="安全のため、現在のパスワードを確認したうえで変更します。"
            />
            <PasswordForm />
          </Card>

          <Card>
            <CardHeader
              title="アカウントの削除"
              subtitle="この操作は取り消せません。"
            />
            <DeleteAccountForm />
          </Card>
        </div>

        {/* ------------------------------------------------ プロフィール詳細 */}
        <div className="space-y-5" id="profile">
          <Card>
            <CardHeader title="プロフィール詳細" />
            <table className="spec-table">
              <tbody>
                <tr>
                  <th>お名前</th>
                  <td>{profile?.display_name ?? "—"}</td>
                </tr>
                <tr>
                  <th>メールアドレス</th>
                  <td className="break-all">{profile?.email ?? "—"}</td>
                </tr>
                <tr>
                  <th>電話番号</th>
                  <td>{profile?.phone ?? "—"}</td>
                </tr>
                <tr>
                  <th>会社名</th>
                  <td>{profile?.company_name ?? org?.name ?? "—"}</td>
                </tr>
                <tr>
                  <th>部署</th>
                  <td>{profile?.department ?? "—"}</td>
                </tr>
                <tr>
                  <th>役職</th>
                  <td>{profile?.job_title ?? "—"}</td>
                </tr>
                <tr>
                  <th>権限</th>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <Badge tone="brand">{ROLE_LABEL[ctx.role] ?? ctx.role}</Badge>
                      {profile?.is_platform_admin && <Badge tone="bad">運営管理者</Badge>}
                    </div>
                  </td>
                </tr>
                <tr>
                  <th>登録日</th>
                  <td className="tabular-nums">{formatDateTime(profile?.created_at)}</td>
                </tr>
                <tr>
                  <th>最終利用</th>
                  <td className="tabular-nums">{formatDateTime(profile?.last_seen_at)}</td>
                </tr>
              </tbody>
            </table>

            {profile?.bio && (
              <div className="mt-4">
                <p className="text-[12px] font-semibold mb-1">自己紹介</p>
                <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap muted">
                  {profile.bio}
                </p>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="所属組織" />
            <table className="spec-table">
              <tbody>
                <tr>
                  <th>組織名</th>
                  <td>{org?.name ?? "—"}</td>
                </tr>
                <tr>
                  <th>業種</th>
                  <td>{org?.industry ?? "—"}</td>
                </tr>
                <tr>
                  <th>Webサイト</th>
                  <td className="break-all">
                    {org?.website ? (
                      <a
                        href={org.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--link)] hover:underline"
                      >
                        {org.website}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
                <tr>
                  <th>ご契約</th>
                  <td>{subscription?.status === "active" ? "ご利用中" : "未契約"}</td>
                </tr>
              </tbody>
            </table>

            <p className="text-[12px] font-semibold mt-4 mb-1.5">広報対象</p>
            <ul className="space-y-1">
              {(subjects ?? []).map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-[12.5px]">
                  <Badge>{SUBJECT_TYPE_LABEL[s.type] ?? s.type}</Badge>
                  <span className="truncate">{s.name}</span>
                  {!s.active && <span className="muted text-[11px]">停止中</span>}
                </li>
              ))}
              {!subjects?.length && <li className="muted text-[12px]">登録がありません</li>}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
