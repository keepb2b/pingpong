"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Modal, Field, Input, Select, Textarea, callApi, toast } from "@/components/ui";
import { CONTENT_TYPES, GOALS, STATUS_LABEL } from "@/lib/constants";

const FILTERS = [
  { key: "", label: "すべて" },
  { key: "pending_approval", label: STATUS_LABEL.pending_approval },
  { key: "approved", label: STATUS_LABEL.approved },
  { key: "scheduled", label: STATUS_LABEL.scheduled },
  { key: "published", label: STATUS_LABEL.published },
  { key: "on_hold", label: STATUS_LABEL.on_hold },
  { key: "draft", label: STATUS_LABEL.draft },
];

export function ContentToolbar({
  counts,
  total,
  subjectId,
}: {
  counts: Record<string, number>;
  total: number;
  subjectId: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const active = params.get("status") ?? "";
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: "sns_post",
    theme: "",
    goal: "inquiry",
    audience: "",
    cta: "",
    instructions: "",
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5 flex-1">
          {FILTERS.map((f) => {
            const on = active === f.key;
            const count = f.key ? (counts[f.key] ?? 0) : total;
            return (
              <button
                key={f.key || "all"}
                onClick={() =>
                  router.push(f.key ? `/dashboard/content?status=${f.key}` : "/dashboard/content")
                }
                className={`px-3 py-1.5 rounded-[3px] text-xs font-medium border transition-colors
                  ${on ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200" : "border-[var(--border)] muted hover:border-brand-300"}`}
              >
                {f.label}
                <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        <Button onClick={() => setOpen(true)}>AIライターに制作を依頼</Button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="AIライターに制作を依頼">
        <div className="space-y-4">
          <Field label="コンテンツ種別" required>
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {CONTENT_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="テーマ" hint="何について書くか" required>
            <Input
              value={form.theme}
              onChange={(e) => setForm({ ...form, theme: e.target.value })}
              placeholder="新しい施設への導入が決まりました"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="広報目的">
              <Select value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })}>
                {GOALS.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="対象読者">
              <Input
                value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value })}
                placeholder="検討中の見込み顧客"
              />
            </Field>
          </div>

          <Field label="誘導したい行動 (CTA)">
            <Input
              value={form.cta}
              onChange={(e) => setForm({ ...form, cta: e.target.value })}
              placeholder="資料請求へ誘導"
            />
          </Field>

          <Field label="追加の指示" hint="含めたい内容、避けたい表現など">
            <Textarea
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              rows={3}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={async () => {
                if (!form.theme) return toast("テーマを入力してください", "err");
                const res = await callApi<{ id: string }>("/api/agents", {
                  action: "write_content",
                  subjectId,
                  ...form,
                });
                if (!res) return;
                toast("AIライターが制作しました");
                setOpen(false);
                router.push(`/dashboard/content/${res.id}`);
                router.refresh();
              }}
            >
              制作を依頼する
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
