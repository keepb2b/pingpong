"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Badge,
  Field,
  Input,
  Select,
  Textarea,
  Toggle,
  Modal,
  callApi,
  toast,
} from "@/components/ui";
import {
  CHANNELS,
  CHANNEL_LABEL,
  DIALOGUE_FREQUENCIES,
  GOALS,
  POST_FREQUENCY_MODES,
  ROLE_LABEL,
  SUBJECT_TYPE_LABEL,
  WEEKDAYS,
  PRICING,
  yen,
  type ChannelKey,
} from "@/lib/constants";
import { LineIcon } from "@/components/icons/AgentIcons";

/* ============================================================ LINE連携 === */
export function LineLinkPanel({
  accounts,
}: {
  accounts: Array<{ id: string; name: string | null; picture: string | null }>;
}) {
  const [code, setCode] = useState<string | null>(null);

  return (
    <div>
      {accounts.length > 0 ? (
        <ul className="space-y-2 mb-4">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center gap-2.5 text-sm">
              <span className="text-[color:var(--color-writer)]">
                <LineIcon size={18} />
              </span>
              <span>{a.name ?? "連携済みアカウント"}</span>
              <Badge tone="good" className="ml-auto">
                連携済み
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted text-xs mb-4">まだ連携されていません。</p>
      )}

      {code ? (
        <div className="p-4 rounded-xl bg-[var(--surface-2)] text-center">
          <p className="muted text-xs">連携コード</p>
          <p className="mt-1.5 text-3xl font-bold tracking-[0.3em] tabular-nums">{code}</p>
          <p className="muted text-[11px] mt-2 leading-relaxed">
            LINE公式アカウントのトークに送信してください (有効期限3日)
          </p>
        </div>
      ) : (
        <Button
          variant="secondary"
          className="w-full"
          onClick={async () => {
            const res = await callApi<{ code: string }>("/api/setup", {
              action: "create_link_code",
            });
            if (res?.code) setCode(res.code);
          }}
        >
          連携コードを発行
        </Button>
      )}

      <details className="mt-4">
        <summary className="text-xs muted cursor-pointer hover:text-[var(--text)]">
          LINE公式アカウント側の設定
        </summary>
        <div className="mt-2 text-[11px] muted space-y-1.5 leading-relaxed">
          <p>1. LINE Developers でMessaging APIチャネルを作成</p>
          <p>2. Webhook URL に次を設定して「Webhookの利用」をON</p>
          <code className="block p-2 rounded bg-[var(--surface-3)] font-mono break-all">
            {typeof window !== "undefined" ? window.location.origin : ""}/api/line/webhook
          </code>
          <p>3. チャネルシークレットとアクセストークンを環境変数に設定</p>
          <code className="block p-2 rounded bg-[var(--surface-3)] font-mono">
            LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN
          </code>
          <p>4. 応答メッセージをOFF、WebhookをONにする</p>
        </div>
      </details>
    </div>
  );
}

/* ============================================================ 対話頻度 === */
export function DialoguePanel({
  subjectId,
  initial,
}: {
  subjectId: string;
  initial: { frequency: string; custom_days: number[]; send_hour: number; max_questions: number };
}) {
  const router = useRouter();
  const [s, setS] = useState(initial);

  return (
    <div className="space-y-4">
      <Field label="ヒアリング頻度">
        <Select value={s.frequency} onChange={(e) => setS({ ...s, frequency: e.target.value })}>
          {DIALOGUE_FREQUENCIES.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </Select>
      </Field>

      {s.frequency === "custom_days" && (
        <Field label="曜日を指定">
          <div className="flex gap-1.5">
            {WEEKDAYS.map((w, i) => {
              const on = s.custom_days.includes(i);
              return (
                <button
                  key={w}
                  onClick={() =>
                    setS({
                      ...s,
                      custom_days: on
                        ? s.custom_days.filter((d) => d !== i)
                        : [...s.custom_days, i],
                    })
                  }
                  className={`h-9 w-9 rounded-lg border text-xs font-medium transition-colors
                    ${on ? "border-brand-500 bg-brand-600 text-white" : "border-[var(--border)] muted hover:border-brand-300"}`}
                >
                  {w}
                </button>
              );
            })}
          </div>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="送信時刻">
          <Select
            value={String(s.send_hour)}
            onChange={(e) => setS({ ...s, send_hour: Number(e.target.value) })}
          >
            {Array.from({ length: 15 }, (_, i) => i + 7).map((h) => (
              <option key={h} value={h}>
                {h}:00
              </option>
            ))}
          </Select>
        </Field>
        <Field label="1回の最大質問数" hint="相手を疲れさせない上限">
          <Input
            type="number"
            min={1}
            max={10}
            value={s.max_questions}
            onChange={(e) => setS({ ...s, max_questions: Number(e.target.value) })}
          />
        </Field>
      </div>

      <Button
        className="w-full"
        onClick={async () => {
          const res = await callApi("/api/setup", { action: "save_dialogue", subjectId, ...s });
          if (!res) return;
          toast("対話設定を保存しました");
          router.refresh();
        }}
      >
        保存する
      </Button>
    </div>
  );
}

/* ============================================================ 媒体設定 === */
type ChannelState = {
  type: string;
  handle: string | null;
  connected: boolean;
  frequency_mode: string;
  frequency_count: number | null;
  auto_publish: boolean;
  auto_publish_max_risk: string;
  credentials: Record<string, string>;
};

const CREDENTIAL_FIELDS: Record<string, Array<{ key: string; label: string }>> = {
  x: [{ key: "access_token", label: "アクセストークン" }],
  facebook: [
    { key: "page_id", label: "ページID" },
    { key: "access_token", label: "アクセストークン" },
  ],
  instagram: [
    { key: "ig_user_id", label: "InstagramビジネスID" },
    { key: "access_token", label: "アクセストークン" },
  ],
  gbp: [
    { key: "account_id", label: "アカウントID" },
    { key: "location_id", label: "ロケーションID" },
    { key: "access_token", label: "アクセストークン" },
  ],
  wordpress: [
    { key: "site_url", label: "サイトURL" },
    { key: "username", label: "ユーザー名" },
    { key: "app_password", label: "アプリケーションパスワード" },
  ],
};

export function ChannelPanel({
  subjectId,
  channels,
}: {
  subjectId: string;
  channels: ChannelState[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ChannelState | null>(null);

  return (
    <>
      <ul className="space-y-2">
        {channels.map((c) => (
          <li
            key={c.type}
            className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-[var(--border)]"
          >
            <span className="text-sm font-medium">{CHANNEL_LABEL[c.type as ChannelKey] ?? c.type}</span>
            <Badge tone={c.connected ? "good" : "neutral"}>{c.connected ? "連携済み" : "未連携"}</Badge>
            <Badge tone="info">
              {POST_FREQUENCY_MODES.find((m) => m.key === c.frequency_mode)?.label ?? c.frequency_mode}
              {c.frequency_count ? ` ${c.frequency_count}回` : ""}
            </Badge>
            {c.auto_publish && <Badge tone="warn">自動投稿</Badge>}
            <button
              onClick={() => setEditing(c)}
              className="ml-auto text-[11px] text-brand-600 hover:underline"
            >
              設定
            </button>
          </li>
        ))}
      </ul>

      {editing && (
        <ChannelModal
          subjectId={subjectId}
          channel={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function ChannelModal({
  subjectId,
  channel,
  onClose,
  onSaved,
}: {
  subjectId: string;
  channel: ChannelState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [c, setC] = useState(channel);
  const fields = CREDENTIAL_FIELDS[c.type] ?? [];

  return (
    <Modal open onClose={onClose} title={`${CHANNEL_LABEL[c.type as ChannelKey] ?? c.type} の設定`}>
      <div className="space-y-4">
        <Field label="投稿頻度">
          <Select
            value={c.frequency_mode}
            onChange={(e) => setC({ ...c, frequency_mode: e.target.value })}
          >
            {POST_FREQUENCY_MODES.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>

        {["weekly_n", "monthly_n"].includes(c.frequency_mode) && (
          <Field label="回数">
            <Input
              type="number"
              min={1}
              max={30}
              value={c.frequency_count ?? 2}
              onChange={(e) => setC({ ...c, frequency_count: Number(e.target.value) })}
            />
          </Field>
        )}

        {c.frequency_mode === "ai_auto" && (
          <p className="text-xs muted leading-relaxed p-3 rounded-xl bg-[var(--surface-2)]">
            広報目的・KPI・保有する素材・過去の成果・季節・市場・競合・承認負担から、
            AIが最適な頻度を判断します。発信価値の高い情報がない日は投稿しません。
          </p>
        )}

        <div className="pt-2 border-t border-[var(--border)]">
          <Toggle
            checked={c.auto_publish}
            onChange={(v) => setC({ ...c, auto_publish: v })}
            label="承認なしで自動投稿する"
            hint="AIの利用に慣れた後に有効化してください。リスク上限を超える内容は自動投稿されません。"
          />
        </div>

        {c.auto_publish && (
          <Field label="自動投稿を許可するリスク上限">
            <Select
              value={c.auto_publish_max_risk}
              onChange={(e) => setC({ ...c, auto_publish_max_risk: e.target.value })}
            >
              <option value="none">問題なしのみ</option>
              <option value="low">軽微まで</option>
              <option value="medium">要確認まで</option>
            </Select>
          </Field>
        )}

        {fields.length > 0 && (
          <div className="pt-2 border-t border-[var(--border)] space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">連携情報</p>
              <Toggle
                checked={c.connected}
                onChange={(v) => setC({ ...c, connected: v })}
                label="連携を有効にする"
              />
            </div>
            {fields.map((f) => (
              <Field key={f.key} label={f.label}>
                <Input
                  type={f.key.includes("password") || f.key.includes("token") ? "password" : "text"}
                  value={c.credentials[f.key] ?? ""}
                  onChange={(e) =>
                    setC({ ...c, credentials: { ...c.credentials, [f.key]: e.target.value } })
                  }
                />
              </Field>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            onClick={async () => {
              const res = await callApi("/api/setup", {
                action: "save_channel",
                subjectId,
                type: c.type,
                connected: c.connected,
                credentials: c.credentials,
                frequency_mode: c.frequency_mode,
                frequency_count: c.frequency_count,
                auto_publish: c.auto_publish,
                auto_publish_max_risk: c.auto_publish_max_risk,
              });
              if (!res) return;
              toast("保存しました");
              onSaved();
            }}
          >
            保存する
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================== 目的 ===== */
export function ObjectivesPanel({
  subjectId,
  selected,
}: {
  subjectId: string;
  selected: string[];
}) {
  const router = useRouter();
  const [goals, setGoals] = useState(selected);

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {GOALS.map((g) => {
          const idx = goals.indexOf(g.key);
          const on = idx >= 0;
          return (
            <button
              key={g.key}
              onClick={() =>
                setGoals((prev) => (on ? prev.filter((x) => x !== g.key) : [...prev, g.key]))
              }
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-xs transition-colors
                ${on ? "border-brand-500 bg-brand-50 dark:bg-brand-900/25" : "border-[var(--border)] hover:border-brand-300"}`}
            >
              <span
                className={`h-4 w-4 shrink-0 rounded-full grid place-items-center text-[9px] font-bold
                  ${on ? "bg-brand-600 text-white" : "bg-[var(--surface-3)] muted"}`}
              >
                {on ? idx + 1 : ""}
              </span>
              {g.label}
            </button>
          );
        })}
      </div>

      <Button
        className="w-full mt-3"
        onClick={async () => {
          const res = await callApi("/api/setup", { action: "save_objectives", subjectId, goals });
          if (!res) return;
          toast("広報目的を保存しました");
          router.refresh();
        }}
      >
        保存する
      </Button>
    </div>
  );
}

/* =============================================================== KPI ===== */
export function KpiPanel({
  subjectId,
  kpis,
}: {
  subjectId: string;
  kpis: Array<{
    id: string;
    name: string;
    metric: string;
    target_value: number;
    current_value: number;
    unit: string | null;
  }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", metric: "inquiry", target_value: 10, unit: "件" });

  return (
    <>
      {kpis.length === 0 ? (
        <p className="muted text-xs mb-3">KPIが未設定です。</p>
      ) : (
        <ul className="space-y-2 mb-3">
          {kpis.map((k) => (
            <li key={k.id} className="flex items-center gap-2 text-xs">
              <span className="font-medium">{k.name}</span>
              <span className="muted tabular-nums ml-auto">
                {k.current_value} / {k.target_value}
                {k.unit}
              </span>
              <button
                onClick={async () => {
                  const res = await callApi("/api/setup", {
                    action: "delete_row",
                    table: "kpis",
                    id: k.id,
                  });
                  if (!res) return;
                  toast("削除しました");
                  router.refresh();
                }}
                className="muted hover:text-red-600"
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button variant="secondary" size="sm" className="w-full" onClick={() => setOpen(true)}>
        KPIを追加
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="KPIを追加">
        <div className="space-y-4">
          <Field label="KPI名" required>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="月間問い合わせ数"
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="指標">
              <Select
                value={form.metric}
                onChange={(e) => setForm({ ...form, metric: e.target.value })}
              >
                <option value="inquiry">問い合わせ</option>
                <option value="booking">予約</option>
                <option value="purchase">購入</option>
                <option value="contract">成約</option>
                <option value="pageviews">PV</option>
                <option value="impressions">表示</option>
                <option value="cta_click">CTAクリック</option>
              </Select>
            </Field>
            <Field label="目標値">
              <Input
                type="number"
                value={form.target_value}
                onChange={(e) => setForm({ ...form, target_value: Number(e.target.value) })}
              />
            </Field>
            <Field label="単位">
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={async () => {
                if (!form.name) return toast("KPI名を入力してください", "err");
                const res = await callApi("/api/setup", { action: "save_kpi", subjectId, ...form });
                if (!res) return;
                toast("追加しました");
                setOpen(false);
                router.refresh();
              }}
            >
              追加する
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* =========================================================== 広報対象 ==== */
export function SubjectsPanel({
  subjects,
}: {
  subjects: Array<{ id: string; name: string; type: string; is_primary: boolean; active: boolean }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "service", description: "", website: "" });

  const extra = Math.max(0, subjects.filter((s) => s.active).length - 1);

  return (
    <>
      <ul className="space-y-2 mb-3">
        {subjects.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-sm">
            <span className="h-6 w-6 rounded-lg bg-[var(--surface-3)] grid place-items-center text-[11px] font-bold shrink-0">
              {s.name.slice(0, 1)}
            </span>
            <span className="truncate">{s.name}</span>
            <Badge>{SUBJECT_TYPE_LABEL[s.type] ?? s.type}</Badge>
            {s.is_primary && <Badge tone="brand">主</Badge>}
            {!s.active && <Badge tone="neutral">停止中</Badge>}
          </li>
        ))}
      </ul>

      {extra > 0 && (
        <p className="muted text-[11px] mb-3">
          追加広報対象 {extra}件 = 月額 {yen(extra * PRICING.extraSubject)}
        </p>
      )}

      <Button variant="secondary" size="sm" className="w-full" onClick={() => setOpen(true)}>
        広報対象を追加
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="広報対象を追加">
        <p className="text-xs muted leading-relaxed mb-4">
          2件目以降は月額 {yen(PRICING.extraSubject)}／件が加算されます。
          対象ごとにカルテ・公式事実・媒体・頻度を独立して設定できます。
        </p>

        <div className="space-y-4">
          <Field label="名称" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="種別">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(SUBJECT_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="概要">
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </Field>
          <Field label="Webサイト">
            <Input
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={async () => {
                if (!form.name) return toast("名称を入力してください", "err");
                const res = await callApi("/api/setup", { action: "create_subject", ...form });
                if (!res) return;
                toast("広報対象を追加しました");
                setOpen(false);
                setForm({ name: "", type: "service", description: "", website: "" });
                router.refresh();
              }}
            >
              追加する
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ============================================================ メンバー === */
export function MembersPanel({
  members,
  role,
  currentUserId,
}: {
  members: Array<{ id: string; userId: string; role: string; name: string; email: string }>;
  role: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [invite, setInvite] = useState({ email: "", role: "editor" });
  const [token, setToken] = useState<string | null>(null);
  const canManage = ["owner", "admin"].includes(role);

  return (
    <>
      <ul className="space-y-2 mb-3">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-2 text-xs">
            <span className="h-7 w-7 rounded-full bg-[var(--surface-3)] grid place-items-center font-bold shrink-0">
              {m.name.slice(0, 1)}
            </span>
            <span className="min-w-0">
              <span className="block font-medium truncate">{m.name}</span>
              <span className="muted block truncate">{m.email}</span>
            </span>
            <div className="ml-auto shrink-0">
              {canManage && m.userId !== currentUserId ? (
                <Select
                  value={m.role}
                  className="h-8 text-xs py-0"
                  onChange={async (e) => {
                    const res = await callApi("/api/setup", {
                      action: "update_member_role",
                      membershipId: m.id,
                      role: e.target.value,
                    });
                    if (!res) return;
                    toast("権限を変更しました");
                    router.refresh();
                  }}
                >
                  {Object.entries(ROLE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              ) : (
                <Badge tone="brand">{ROLE_LABEL[m.role] ?? m.role}</Badge>
              )}
            </div>
          </li>
        ))}
      </ul>

      {canManage && (
        <Button variant="secondary" size="sm" className="w-full" onClick={() => setOpen(true)}>
          メンバーを招待
        </Button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="メンバーを招待">
        {token ? (
          <div>
            <p className="text-xs muted mb-2">招待リンクを共有してください。</p>
            <code className="block p-3 rounded-xl bg-[var(--surface-3)] text-[11px] font-mono break-all">
              {typeof window !== "undefined" ? window.location.origin : ""}/signup?invite={token}
            </code>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="メールアドレス" required>
              <Input
                type="email"
                value={invite.email}
                onChange={(e) => setInvite({ ...invite, email: e.target.value })}
              />
            </Field>
            <Field label="権限">
              <Select
                value={invite.role}
                onChange={(e) => setInvite({ ...invite, role: e.target.value })}
              >
                {Object.entries(ROLE_LABEL)
                  .filter(([k]) => k !== "owner")
                  .map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
              </Select>
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                キャンセル
              </Button>
              <Button
                onClick={async () => {
                  if (!invite.email) return toast("メールアドレスを入力してください", "err");
                  const res = await callApi<{ token: string }>("/api/setup", {
                    action: "invite_member",
                    ...invite,
                  });
                  if (!res) return;
                  setToken(res.token);
                  toast("招待を作成しました");
                }}
              >
                招待する
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
