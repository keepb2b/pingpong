"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, Field, Input, Textarea, callApi, toast } from "@/components/ui";

export function AddCompetitor({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    website: "",
    positioning: "",
    strengths: "",
    weaknesses: "",
    watch_urls: "",
  });

  const split = (s: string) =>
    s
      .split(/[,、\n]/)
      .map((x) => x.trim())
      .filter(Boolean);

  return (
    <>
      <Button onClick={() => setOpen(true)}>競合を登録</Button>

      <Modal open={open} onClose={() => setOpen(false)} title="競合を登録">
        <div className="space-y-4">
          <Field label="競合名" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>

          <Field label="Webサイト" hint="更新を検知するため定期的に確認します">
            <Input
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://competitor.example.com"
            />
          </Field>

          <Field label="ポジショニング">
            <Input
              value={form.positioning}
              onChange={(e) => setForm({ ...form, positioning: e.target.value })}
              placeholder="低価格帯で中小企業向け"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="強み" hint="読点区切り">
              <Textarea
                value={form.strengths}
                onChange={(e) => setForm({ ...form, strengths: e.target.value })}
                rows={2}
              />
            </Field>
            <Field label="弱み" hint="読点区切り">
              <Textarea
                value={form.weaknesses}
                onChange={(e) => setForm({ ...form, weaknesses: e.target.value })}
                rows={2}
              />
            </Field>
          </div>

          <Field label="追加の監視URL" hint="改行区切り。お知らせページ、料金ページなど。">
            <Textarea
              value={form.watch_urls}
              onChange={(e) => setForm({ ...form, watch_urls: e.target.value })}
              rows={2}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={async () => {
                if (!form.name) return toast("競合名を入力してください", "err");
                const res = await callApi("/api/setup", {
                  action: "save_competitor",
                  subjectId,
                  name: form.name,
                  website: form.website,
                  positioning: form.positioning,
                  strengths: split(form.strengths),
                  weaknesses: split(form.weaknesses),
                  watch_urls: split(form.watch_urls),
                });
                if (!res) return;
                toast("登録しました。次回の監視から反映されます。");
                setOpen(false);
                setForm({
                  name: "",
                  website: "",
                  positioning: "",
                  strengths: "",
                  weaknesses: "",
                  watch_urls: "",
                });
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
