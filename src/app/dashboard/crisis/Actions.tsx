"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, Field, Input, Textarea, Select, callApi, toast } from "@/components/ui";

export function OpenCrisis({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "incident",
    severity: "high",
    facts: "",
  });

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        危機広報モードを開始
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="危機広報モードを開始">
        <div className="p-3 rounded-[4px] bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 mb-4">
          <p className="text-xs leading-relaxed">
            開始すると、この広報対象の<strong>予約投稿がすべて停止</strong>されます。
            通常運用への復帰には、担当者の承認が必要です。
          </p>
        </div>

        <div className="space-y-4">
          <Field label="件名" required>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="システム障害の発生"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="分類">
              <Select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="incident">事故・障害</option>
                <option value="flare">炎上</option>
                <option value="leak">情報漏洩</option>
                <option value="complaint">重大なクレーム</option>
                <option value="legal">法的問題</option>
                <option value="other">その他</option>
              </Select>
            </Field>
            <Field label="深刻度">
              <Select
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
              >
                <option value="medium">中</option>
                <option value="high">高</option>
                <option value="critical">重大</option>
              </Select>
            </Field>
          </div>

          <Field
            label="現時点で把握している事実"
            hint="確認できていないことは書かないでください。AIは未確認の内容を断定しません。"
          >
            <Textarea
              value={form.facts}
              onChange={(e) => setForm({ ...form, facts: e.target.value })}
              rows={5}
              placeholder="◯時◯分頃、△△が発生。影響範囲は調査中。"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!form.title) return toast("件名を入力してください", "err");
                const res = await callApi<{ id: string; pausedPosts: number }>("/api/reputation", {
                  action: "open_crisis",
                  subjectId,
                  title: form.title,
                  category: form.category,
                  severity: form.severity,
                  facts: form.facts
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((fact) => ({ fact, confirmed: false })),
                });
                if (!res) return;
                toast(`危機広報モードを開始し、${res.pausedPosts}件の投稿を停止しました`);
                // 続けて初動一式を作成する
                await callApi("/api/agents", {
                  action: "crisis_response",
                  subjectId,
                  incidentId: res.id,
                });
                setOpen(false);
                router.refresh();
              }}
            >
              開始して投稿を停止する
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
