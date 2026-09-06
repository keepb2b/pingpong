"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge, Modal, Field, Input, Textarea, Select, callApi, toast } from "@/components/ui";

type MentionView = {
  id: string;
  source: string;
  author: string | null;
  body: string;
  rating: number | null;
  sentiment: string;
  urgency: number;
  flareRisk: string;
  riskLabel: string;
  riskTone: "neutral" | "brand" | "good" | "warn" | "bad" | "info";
  occurredAt: string;
  url: string | null;
  needsHuman: boolean;
};

const SENTIMENT_LABEL: Record<string, string> = {
  positive: "好意的",
  neutral: "中立",
  negative: "否定的",
};

export function MentionRow({
  mention,
  reply,
  subjectId,
}: {
  mention: MentionView;
  reply: { id: string; draft: string; approved: boolean; sent_at: string | null } | null;
  subjectId: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(reply?.draft ?? "");

  return (
    <li className="p-4 rounded-[4px] border border-[var(--border)]">
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <Badge>{mention.source}</Badge>
        {mention.rating != null && <Badge tone={mention.rating >= 4 ? "good" : "warn"}>★{mention.rating}</Badge>}
        <Badge tone={mention.sentiment === "negative" ? "bad" : mention.sentiment === "positive" ? "good" : "neutral"}>
          {SENTIMENT_LABEL[mention.sentiment] ?? mention.sentiment}
        </Badge>
        {mention.flareRisk !== "none" && (
          <Badge tone={mention.riskTone}>炎上リスク: {mention.riskLabel}</Badge>
        )}
        {mention.needsHuman && <Badge tone="bad">要担当者判断</Badge>}
        <span className="ml-auto muted text-[11px] tabular-nums">{mention.occurredAt}</span>
      </div>

      {mention.author && <p className="text-[11px] muted">{mention.author}</p>}
      <p className="text-sm mt-1 leading-relaxed whitespace-pre-wrap">{mention.body}</p>

      {mention.url && (
        <a
          href={mention.url}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-brand-600 hover:underline mt-1 inline-block"
        >
          元の投稿を開く →
        </a>
      )}

      <div className="mt-3 pt-3 border-t border-[var(--border)]">
        {reply ? (
          <>
            <p className="text-[11px] font-medium mb-1.5">返信案</p>
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} />
            <div className="flex justify-end gap-2 mt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  const res = await callApi("/api/agents", {
                    action: "draft_reply",
                    subjectId,
                    mentionId: mention.id,
                  });
                  if (!res) return;
                  toast("返信案を作り直しました");
                  router.refresh();
                }}
              >
                作り直す
              </Button>
              <Button
                size="sm"
                disabled={Boolean(reply.sent_at)}
                onClick={async () => {
                  const res = await callApi("/api/reputation", {
                    action: "send_reply",
                    replyId: reply.id,
                    draft,
                  });
                  if (!res) return;
                  toast("返信を確定しました");
                  router.refresh();
                }}
              >
                {reply.sent_at ? "送信済み" : "この内容で返信"}
              </Button>
            </div>
          </>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              const res = await callApi("/api/agents", {
                action: "draft_reply",
                subjectId,
                mentionId: mention.id,
              });
              if (!res) return;
              toast("AIマーケターが返信案を作成しました");
              router.refresh();
            }}
          >
            返信案をAIに作らせる
          </Button>
        )}
      </div>
    </li>
  );
}

export function AddMention({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    source: "google_review",
    author: "",
    body: "",
    rating: "",
    url: "",
  });

  return (
    <>
      <Button onClick={() => setOpen(true)}>コメント・口コミを登録</Button>

      <Modal open={open} onClose={() => setOpen(false)} title="コメント・口コミを登録">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="媒体">
              <Select
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              >
                <option value="google_review">Google口コミ</option>
                <option value="x">X</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="line">LINE</option>
                <option value="email">メール</option>
                <option value="web">Web</option>
              </Select>
            </Field>
            <Field label="評価 (1-5)">
              <Input
                type="number"
                min={1}
                max={5}
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: e.target.value })}
              />
            </Field>
          </div>

          <Field label="投稿者">
            <Input
              value={form.author}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
              placeholder="匿名"
            />
          </Field>

          <Field label="本文" required>
            <Textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={4}
            />
          </Field>

          <Field label="元のURL">
            <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={async () => {
                if (!form.body) return toast("本文を入力してください", "err");
                const created = await callApi<{ id: string }>("/api/reputation", {
                  action: "add_mention",
                  subjectId,
                  ...form,
                  rating: form.rating ? Number(form.rating) : null,
                });
                if (!created) return;
                // 登録と同時にAIが判定と返信案を作る
                await callApi("/api/agents", {
                  action: "draft_reply",
                  subjectId,
                  mentionId: created.id,
                });
                toast("登録し、AIが返信案を作成しました");
                setOpen(false);
                setForm({ source: "google_review", author: "", body: "", rating: "", url: "" });
                router.refresh();
              }}
            >
              登録してAIに判定させる
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
