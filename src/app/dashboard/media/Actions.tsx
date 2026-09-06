"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, Field, Input, Textarea, Select, callApi, toast } from "@/components/ui";

export function AddOutlet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "",
    region: "",
    contact_name: "",
    contact_email: "",
    url: "",
    fit_score: 50,
  });

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        媒体を登録
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="媒体を登録">
        <div className="space-y-4">
          <Field label="媒体名" required>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="◯◯業界新聞"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="カテゴリ">
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="業界誌 / 地域紙 / Webメディア"
              />
            </Field>
            <Field label="地域">
              <Input
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                placeholder="全国 / 関東"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="担当者名">
              <Input
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
              />
            </Field>
            <Field label="連絡先メール">
              <Input
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              />
            </Field>
          </div>

          <Field label="URL">
            <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          </Field>

          <Field label="相性スコア" hint="0〜100。発信テーマとの相性の高さ。">
            <Input
              type="number"
              min={0}
              max={100}
              value={form.fit_score}
              onChange={(e) => setForm({ ...form, fit_score: Number(e.target.value) })}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={async () => {
                if (!form.name) return toast("媒体名を入力してください", "err");
                const res = await callApi("/api/reputation", { action: "save_outlet", ...form });
                if (!res) return;
                toast("登録しました");
                setOpen(false);
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

export function CreatePitch({
  subjectId,
  outlets,
  releases,
}: {
  subjectId: string;
  outlets: Array<{ id: string; name: string }>;
  releases: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    outletId: "",
    contentId: "",
    subject_line: "",
    body: "",
  });

  return (
    <>
      <Button onClick={() => setOpen(true)}>メディアへ提案</Button>

      <Modal open={open} onClose={() => setOpen(false)} title="メディアへの提案を作る" wide>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="送付先の媒体">
              <Select
                value={form.outletId}
                onChange={(e) => setForm({ ...form, outletId: e.target.value })}
              >
                <option value="">選択してください</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="元にする原稿" hint="AIが提案文を作る際の素材になります">
              <Select
                value={form.contentId}
                onChange={(e) => setForm({ ...form, contentId: e.target.value })}
              >
                <option value="">なし</option>
                {releases.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="件名" required>
            <Input
              value={form.subject_line}
              onChange={(e) => setForm({ ...form, subject_line: e.target.value })}
              placeholder="【取材のご提案】現場の課題を解決した導入事例のご紹介"
            />
          </Field>

          <div className="flex justify-between items-end gap-3">
            <p className="text-xs muted flex-1 leading-relaxed">
              本文が空の場合は、AIライターがメディア向け提案文を作成します。
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                if (!form.subject_line) return toast("件名を入力してください", "err");
                const res = await callApi<{ content: { body: string } }>("/api/agents", {
                  action: "write_content",
                  subjectId,
                  type: "media_pitch",
                  theme: form.subject_line,
                  goal: "media",
                });
                if (!res) return;
                setForm({ ...form, body: res.content.body });
                toast("提案文を作成しました");
              }}
            >
              AIに提案文を書かせる
            </Button>
          </div>

          <Field label="本文">
            <Textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={10}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={async () => {
                if (!form.subject_line || !form.body) {
                  return toast("件名と本文を入力してください", "err");
                }
                const res = await callApi("/api/reputation", {
                  action: "create_pitch",
                  subjectId,
                  outletId: form.outletId || null,
                  contentId: form.contentId || null,
                  subject_line: form.subject_line,
                  body: form.body,
                });
                if (!res) return;
                toast("提案を保存しました");
                setOpen(false);
                setForm({ outletId: "", contentId: "", subject_line: "", body: "" });
                router.refresh();
              }}
            >
              保存する
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
