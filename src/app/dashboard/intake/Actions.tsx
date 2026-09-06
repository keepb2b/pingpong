"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, Field, Input, Textarea, Select, callApi, toast } from "@/components/ui";
import { CONTENT_TYPES, GOALS } from "@/lib/constants";

/** 収集した材料から、AIライターに制作を依頼する。 */
export function IntakeActions({
  id,
  subjectId,
  title,
}: {
  id: string;
  subjectId: string;
  title: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("case_study");
  const [goal, setGoal] = useState("inquiry");

  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          この材料で制作
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            const res = await callApi("/api/workflow", {
              action: "update_intake",
              id,
              status: "archived",
            });
            if (!res) return;
            toast("アーカイブしました");
            router.refresh();
          }}
        >
          使わない
        </Button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="この材料からコンテンツを制作">
        <p className="text-sm font-medium">{title}</p>
        <div className="mt-4 space-y-4">
          <Field label="コンテンツ種別">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {CONTENT_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="広報目的">
            <Select value={goal} onChange={(e) => setGoal(e.target.value)}>
              {GOALS.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
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
                const res = await callApi<{ id: string }>("/api/agents", {
                  action: "write_content",
                  subjectId,
                  intakeItemId: id,
                  type,
                  goal,
                  theme: title,
                });
                if (!res) return;
                await callApi("/api/workflow", { action: "update_intake", id, status: "used" });
                toast("AIライターが制作しました");
                setOpen(false);
                router.push(`/dashboard/content/${res.id}`);
                router.refresh();
              }}
            >
              制作する
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/** 管理画面から直接、広報材料を登録する。 */
export function AddIntake({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    raw_text: "",
    kind: "event",
    newsworthiness: 60,
    occurred_on: "",
  });

  return (
    <>
      <Button onClick={() => setOpen(true)}>広報材料を追加</Button>

      <Modal open={open} onClose={() => setOpen(false)} title="広報材料を追加">
        <div className="space-y-4">
          <Field label="見出し" required>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="新しい施設への導入が決まりました"
            />
          </Field>

          <Field label="内容" hint="分かっている範囲で構いません。不足はAI秘書が聞き取ります。">
            <Textarea
              value={form.raw_text}
              onChange={(e) => setForm({ ...form, raw_text: e.target.value })}
              rows={5}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="種別">
              <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="event">出来事</option>
                <option value="achievement">成果・評価</option>
                <option value="new_service">新サービス</option>
                <option value="customer_voice">顧客の声</option>
                <option value="number">数値</option>
                <option value="other">その他</option>
              </Select>
            </Field>
            <Field label="発生日">
              <Input
                type="date"
                value={form.occurred_on}
                onChange={(e) => setForm({ ...form, occurred_on: e.target.value })}
              />
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={async () => {
                if (!form.title) return toast("見出しを入力してください", "err");
                const res = await callApi("/api/workflow", {
                  action: "add_intake",
                  subjectId,
                  ...form,
                  occurred_on: form.occurred_on || null,
                });
                if (!res) return;
                toast("登録しました");
                setOpen(false);
                setForm({ title: "", raw_text: "", kind: "event", newsworthiness: 60, occurred_on: "" });
                router.refresh();
              }}
            >
              登録する
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
