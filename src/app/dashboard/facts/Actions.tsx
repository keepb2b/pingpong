"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge, Modal, Field, Input, Select, Textarea, callApi, toast } from "@/components/ui";

type Fact = {
  id: string;
  category: string;
  categoryLabel: string;
  key: string;
  value: string;
  status: string;
  visibility: string;
  source: string | null;
  sourceUrl: string | null;
  verifiedAt: string;
  expiresAt: string | null;
  isExpired: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: "確定",
  planned: "予定",
  hypothesis: "仮説",
};

const CATEGORIES = [
  { key: "pricing", label: "料金" },
  { key: "product", label: "商品・機能" },
  { key: "clients", label: "導入実績" },
  { key: "area", label: "対応地域" },
  { key: "leader", label: "代表者情報" },
  { key: "metric", label: "数値" },
  { key: "award", label: "受賞歴" },
  { key: "other", label: "その他" },
];

export function FactTable({ subjectId, facts }: { subjectId: string; facts: Fact[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Fact | null>(null);

  const grouped = facts.reduce<Record<string, Fact[]>>((acc, f) => {
    (acc[f.categoryLabel] ??= []).push(f);
    return acc;
  }, {});

  return (
    <>
      <div className="space-y-5">
        {Object.entries(grouped).map(([category, list]) => (
          <div key={category}>
            <p className="text-xs font-semibold mb-2">{category}</p>
            <ul className="divide-y divide-[var(--border)]">
              {list.map((f) => (
                <li key={f.id} className="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="text-sm font-medium">{f.key}</span>
                  <span className="text-sm">{f.value}</span>

                  <div className="flex items-center gap-1.5">
                    {f.status !== "confirmed" && (
                      <Badge tone="warn">{STATUS_LABEL[f.status] ?? f.status}</Badge>
                    )}
                    {f.visibility === "internal" && <Badge tone="bad">社内限定</Badge>}
                    {f.isExpired && <Badge tone="bad">期限切れ</Badge>}
                  </div>

                  <span className="muted text-[11px] tabular-nums ml-auto">
                    確認 {f.verifiedAt}
                    {f.expiresAt && ` · 期限 ${f.expiresAt}`}
                  </span>

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setEditing(f)}
                      className="text-[11px] text-brand-600 hover:underline"
                    >
                      編集
                    </button>
                    <button
                      onClick={async () => {
                        if (!window.confirm(`「${f.key}」を削除しますか。`)) return;
                        const res = await callApi("/api/setup", { action: "delete_fact", id: f.id });
                        if (!res) return;
                        toast("削除しました");
                        router.refresh();
                      }}
                      className="text-[11px] muted hover:text-red-600"
                    >
                      削除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {editing && (
        <FactModal
          subjectId={subjectId}
          fact={editing}
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

export function AddFact({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>公式事実を登録</Button>
      {open && (
        <FactModal
          subjectId={subjectId}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function FactModal({
  subjectId,
  fact,
  onClose,
  onSaved,
}: {
  subjectId: string;
  fact?: Fact;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    category: fact?.category ?? "pricing",
    key: fact?.key ?? "",
    value: fact?.value ?? "",
    status: fact?.status ?? "confirmed",
    visibility: fact?.visibility ?? "public",
    source: fact?.source ?? "",
    source_url: fact?.sourceUrl ?? "",
    expires_at: "",
    notes: "",
  });

  return (
    <Modal open onClose={onClose} title={fact ? "公式事実を編集" : "公式事実を登録"}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="カテゴリ">
            <Select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="確度">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="confirmed">確定</option>
              <option value="planned">予定</option>
              <option value="hypothesis">仮説</option>
            </Select>
          </Field>
        </div>

        <Field label="項目名" required>
          <Input
            value={form.key}
            onChange={(e) => setForm({ ...form, key: e.target.value })}
            placeholder="月額料金"
          />
        </Field>

        <Field label="値" required>
          <Input
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            placeholder="39,800円"
          />
        </Field>

        <Field
          label="公開範囲"
          hint="社内限定にすると、AIは外部発信に一切含めません。"
        >
          <Select
            value={form.visibility}
            onChange={(e) => setForm({ ...form, visibility: e.target.value })}
          >
            <option value="public">公開可能</option>
            <option value="internal">社内限定</option>
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="出典">
            <Input
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              placeholder="料金表 2026年版"
            />
          </Field>
          <Field label="有効期限" hint="期限を過ぎると警告されます">
            <Input
              type="date"
              value={form.expires_at}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
            />
          </Field>
        </div>

        <Field label="出典URL">
          <Input
            value={form.source_url}
            onChange={(e) => setForm({ ...form, source_url: e.target.value })}
          />
        </Field>

        <Field label="備考">
          <Textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            onClick={async () => {
              if (!form.key || !form.value) return toast("項目名と値を入力してください", "err");
              const res = await callApi("/api/setup", {
                action: "save_fact",
                subjectId,
                id: fact?.id,
                ...form,
                expires_at: form.expires_at || null,
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
