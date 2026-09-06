"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Badge, Button, Input, Select, Modal, callApi, toast, type BadgeTone } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/constants";
import type { AdminUserRow } from "@/lib/admin";

const PLAN_META: Record<string, { label: string; tone: BadgeTone }> = {
  active: { label: "ご利用中", tone: "good" },
  trialing: { label: "トライアル", tone: "info" },
  past_due: { label: "支払い確認中", tone: "warn" },
  unpaid: { label: "未払い", tone: "bad" },
  canceled: { label: "解約済み", tone: "neutral" },
  incomplete: { label: "手続き未完了", tone: "warn" },
  none: { label: "未契約", tone: "neutral" },
};

function fmt(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
}

type Detail = {
  profile: Record<string, unknown>;
  membership: { role: string; organizations?: { name: string; industry: string | null } } | null;
  subjects: Array<{ id: string; name: string; type: string; active: boolean }>;
  subscription: Record<string, unknown> | null;
  payments: Array<{ amount: number; status: string; paid_at: string; description: string | null }>;
  runs: Array<{ agent: string; task: string; cost_usd: number; ok: boolean; created_at: string }>;
  auth: {
    last_sign_in_at: string | null;
    email_confirmed_at: string | null;
    banned_until: string | null;
    created_at: string;
  } | null;
};

export function UserTable({ rows }: { rows: AdminUserRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState("");
  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (plan && (r.plan_status ?? "none") !== plan) return false;
      if (!needle) return true;
      return [r.email, r.display_name, r.org_name, r.company_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [rows, q, plan]);

  async function openDetail(row: AdminUserRow) {
    setSelected(row);
    setDetail(null);
    setLoading(true);
    const res = await callApi<Detail>("/api/admin", { action: "user_detail", userId: row.user_id });
    setDetail(res);
    setLoading(false);
  }

  return (
    <>
      {/* 検索・絞り込み */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="氏名・メール・会社名で検索"
          className="max-w-xs"
        />
        <Select value={plan} onChange={(e) => setPlan(e.target.value)} className="max-w-[12rem]">
          <option value="">すべての契約状態</option>
          {Object.entries(PLAN_META).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
        <span className="ml-auto self-center text-[12px] muted tabular-nums">
          {filtered.length} / {rows.length} 名
        </span>
      </div>

      <div className="overflow-x-auto scroll-thin">
        <table className="data-table">
          <thead>
            <tr>
              <th>ユーザー</th>
              <th>組織</th>
              <th>権限</th>
              <th>契約状態</th>
              <th className="text-right">広報対象</th>
              <th className="text-right">コンテンツ</th>
              <th className="text-right">売上</th>
              <th>最終利用</th>
              <th>登録日</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const meta = PLAN_META[r.plan_status ?? "none"] ?? PLAN_META.none;
              return (
                <tr key={r.user_id} className="cursor-pointer" onClick={() => openDetail(r)}>
                  <td>
                    <div className="flex items-center gap-2.5 min-w-[13rem]">
                      <Avatar src={r.avatar_url} name={r.display_name ?? r.email} size={28} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold truncate">{r.display_name ?? "—"}</span>
                          {r.is_platform_admin && <Badge tone="bad">運営</Badge>}
                        </div>
                        <div className="muted text-[11.5px] truncate">{r.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="max-w-[12rem]">
                    <div className="truncate">{r.org_name ?? "—"}</div>
                    {r.industry && <div className="muted text-[11px] truncate">{r.industry}</div>}
                  </td>
                  <td>{r.org_role ? (ROLE_LABEL[r.org_role] ?? r.org_role) : "—"}</td>
                  <td>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    {!r.onboarded_at && (
                      <div className="mt-1">
                        <Badge tone="warn">初期設定未完了</Badge>
                      </div>
                    )}
                  </td>
                  <td className="text-right tabular-nums">{r.subject_count}</td>
                  <td className="text-right tabular-nums">{r.content_count}</td>
                  <td className="text-right tabular-nums">
                    ¥{Number(r.revenue_total ?? 0).toLocaleString("ja-JP")}
                  </td>
                  <td className="tabular-nums whitespace-nowrap">{fmtDate(r.last_seen_at)}</td>
                  <td className="tabular-nums whitespace-nowrap">{fmtDate(r.registered_at)}</td>
                  <td>
                    <span className="text-[var(--link)] text-[12px] whitespace-nowrap">詳細 ›</span>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr>
                <td colSpan={10} className="text-center muted py-8">
                  該当するユーザーがいません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ------------------------------------------------------ 詳細 ---- */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={`ユーザー詳細 — ${selected?.display_name ?? selected?.email ?? ""}`}
        wide
      >
        {loading && <div className="h-40 skeleton rounded-[3px]" />}

        {!loading && detail && selected && (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <Avatar src={selected.avatar_url} name={selected.display_name ?? selected.email} size={64} />
              <div className="min-w-0">
                <p className="text-[15px] font-bold">{selected.display_name ?? "—"}</p>
                <p className="muted text-[12px] break-all">{selected.email}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {selected.org_role && <Badge tone="brand">{ROLE_LABEL[selected.org_role]}</Badge>}
                  {selected.is_platform_admin && <Badge tone="bad">運営管理者</Badge>}
                  {detail.auth?.banned_until && <Badge tone="bad">利用停止中</Badge>}
                </div>
              </div>
            </div>

            <table className="spec-table">
              <tbody>
                <tr>
                  <th>組織</th>
                  <td>{selected.org_name ?? "—"}</td>
                </tr>
                <tr>
                  <th>電話番号</th>
                  <td>{selected.phone ?? "—"}</td>
                </tr>
                <tr>
                  <th>契約状態</th>
                  <td>{(PLAN_META[selected.plan_status ?? "none"] ?? PLAN_META.none).label}</td>
                </tr>
                <tr>
                  <th>次回請求日</th>
                  <td className="tabular-nums">{fmtDate(selected.current_period_end)}</td>
                </tr>
                <tr>
                  <th>登録日</th>
                  <td className="tabular-nums">{fmt(selected.registered_at)}</td>
                </tr>
                <tr>
                  <th>最終ログイン</th>
                  <td className="tabular-nums">{fmt(detail.auth?.last_sign_in_at)}</td>
                </tr>
                <tr>
                  <th>メール確認</th>
                  <td>{detail.auth?.email_confirmed_at ? "確認済み" : "未確認"}</td>
                </tr>
                <tr>
                  <th>広報対象</th>
                  <td>
                    {detail.subjects.length
                      ? detail.subjects.map((s) => s.name).join("、")
                      : "—"}
                  </td>
                </tr>
              </tbody>
            </table>

            {detail.payments.length > 0 && (
              <div>
                <p className="heading-bar text-[13px] mb-2">直近の決済</p>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>日付</th>
                      <th>内容</th>
                      <th className="text-right">金額</th>
                      <th>状態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.payments.map((p, i) => (
                      <tr key={i}>
                        <td className="tabular-nums whitespace-nowrap">{fmtDate(p.paid_at)}</td>
                        <td className="max-w-[16rem] truncate">{p.description ?? "—"}</td>
                        <td className="text-right tabular-nums">
                          ¥{Number(p.amount).toLocaleString("ja-JP")}
                        </td>
                        <td>
                          <Badge tone={p.status === "succeeded" ? "good" : "warn"}>
                            {p.status === "succeeded" ? "成功" : p.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {detail.runs.length > 0 && (
              <div>
                <p className="heading-bar text-[13px] mb-2">直近のAI実行</p>
                <ul className="space-y-1">
                  {detail.runs.slice(0, 8).map((r, i) => (
                    <li key={i} className="text-[12px] flex items-center gap-2">
                      <Badge tone={r.ok ? "good" : "bad"}>{r.ok ? "成功" : "失敗"}</Badge>
                      <span className="truncate flex-1">
                        {r.agent} / {r.task}
                      </span>
                      <span className="muted tabular-nums shrink-0">
                        ${Number(r.cost_usd ?? 0).toFixed(5)}
                      </span>
                      <span className="muted tabular-nums shrink-0">{fmtDate(r.created_at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 運営操作 */}
            <div className="pt-4 border-t border-[var(--border)] flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={async () => {
                  const res = await callApi("/api/admin", {
                    action: "set_platform_admin",
                    userId: selected.user_id,
                    value: !selected.is_platform_admin,
                  });
                  if (!res) return;
                  toast(
                    selected.is_platform_admin
                      ? "運営管理者権限を解除しました"
                      : "運営管理者権限を付与しました",
                  );
                  setSelected(null);
                  router.refresh();
                }}
              >
                {selected.is_platform_admin ? "運営管理者を解除" : "運営管理者にする"}
              </Button>

              <Button
                variant={detail.auth?.banned_until ? "success" : "danger"}
                onClick={async () => {
                  const banned = !detail.auth?.banned_until;
                  if (
                    banned &&
                    !window.confirm("このユーザーのログインを停止します。よろしいですか。")
                  ) {
                    return;
                  }
                  const res = await callApi("/api/admin", {
                    action: "set_user_banned",
                    userId: selected.user_id,
                    banned,
                  });
                  if (!res) return;
                  toast(banned ? "利用を停止しました" : "利用停止を解除しました");
                  setSelected(null);
                  router.refresh();
                }}
              >
                {detail.auth?.banned_until ? "利用停止を解除" : "利用を停止する"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
