"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardHeader,
  Badge,
  Field,
  Input,
  Textarea,
  Modal,
  callApi,
  toast,
} from "@/components/ui";
import { CHANNELS, CHANNEL_LABEL, CHANNEL_LIMIT, type ChannelKey } from "@/lib/constants";

/* ============================================================== 承認操作 == */
const ROLE_RANK: Record<string, number> = {
  viewer: 0,
  editor: 1,
  legal: 2,
  brand: 2,
  approver: 3,
  admin: 4,
  owner: 5,
};

export function ApprovalPanel({
  contentId,
  status,
  blocked,
  role,
}: {
  contentId: string;
  status: string;
  blocked: boolean;
  role: string;
}) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const canApprove = (ROLE_RANK[role] ?? 0) >= ROLE_RANK.approver;
  const decided = ["approved", "scheduled", "published", "rejected"].includes(status);

  async function act(action: "approve" | "revise" | "hold" | "reject") {
    const res = await callApi(`/api/content/${contentId}/approve`, { action, comment });
    if (!res) return;
    toast(
      {
        approve: "承認しました。投稿を予約します。",
        revise: "修正として差し戻しました。",
        hold: "保留にしました。",
        reject: "投稿しない設定にしました。",
      }[action],
    );
    setComment("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader
        title="承認"
        subtitle={
          blocked
            ? "重大なリスクが検出されたため投稿を停止しています。修正後に再検査してください。"
            : "承認すると、媒体ごとに投稿が予約されます。"
        }
      />

      {decided ? (
        <p className="text-xs muted">
          この案件は判断済みです。現在の状態: <span className="font-medium">{status}</span>
        </p>
      ) : (
        <>
          <Field label="コメント (任意)">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="修正してほしい点など"
            />
          </Field>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant="primary"
              onClick={() => act("approve")}
              disabled={!canApprove || blocked}
              title={
                blocked
                  ? "リスク検出のため承認できません"
                  : !canApprove
                    ? "承認には最終承認者以上の権限が必要です"
                    : undefined
              }
            >
              承認
            </Button>
            <Button variant="secondary" onClick={() => act("revise")}>
              修正
            </Button>
            <Button variant="ghost" onClick={() => act("hold")}>
              保留
            </Button>
            <Button variant="ghost" onClick={() => act("reject")}>
              投稿しない
            </Button>
          </div>

          {!canApprove && (
            <p className="muted text-[11px] mt-3 leading-relaxed">
              承認には「最終承認者」以上の権限が必要です。設定画面から権限を確認してください。
            </p>
          )}
        </>
      )}

      <div className="mt-4 pt-3 border-t border-[var(--border)] space-y-2">
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={async () => {
            const res = await callApi("/api/agents", { action: "fact_check", contentId });
            if (!res) return;
            toast("再検査しました");
            router.refresh();
          }}
        >
          ファクトチェックを再実行
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={async () => {
            const res = await callApi("/api/agents", {
              action: "generate_creative",
              contentId,
              kind: "sns_image",
            });
            if (!res) return;
            toast("クリエイティブを生成しました");
            router.refresh();
          }}
        >
          画像を生成する
        </Button>
      </div>
    </Card>
  );
}

/* ============================================================== 本文編集 == */
export function ContentEditor({
  id,
  title,
  body,
  cta,
  canEdit,
}: {
  id: string;
  title: string;
  body: string;
  cta: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title, body, cta });

  if (!editing) {
    return (
      <div>
        <article className="prose-sm max-w-none text-sm leading-relaxed whitespace-pre-wrap">
          {body || <span className="muted">本文がありません</span>}
        </article>
        {cta && (
          <p className="mt-4 pt-3 border-t border-[var(--border)] text-xs">
            <span className="muted">CTA: </span>
            {cta}
          </p>
        )}
        {canEdit && (
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => setEditing(true)}>
            編集する
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Field label="タイトル">
        <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      </Field>
      <Field label="本文">
        <Textarea
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          rows={16}
          className="font-mono text-[13px]"
        />
      </Field>
      <Field label="CTA">
        <Input value={draft.cta} onChange={(e) => setDraft({ ...draft, cta: e.target.value })} />
      </Field>
      <div className="flex gap-2">
        <Button
          onClick={async () => {
            const res = await callApi("/api/workflow", { action: "update_content", id, ...draft });
            if (!res) return;
            toast("保存しました。再検査をおすすめします。");
            setEditing(false);
            router.refresh();
          }}
        >
          保存
        </Button>
        <Button variant="ghost" onClick={() => setEditing(false)}>
          キャンセル
        </Button>
      </div>
    </div>
  );
}

/* ========================================================== 媒体別の編集 == */
type Variant = {
  id: string;
  channel: string;
  body: string;
  hashtags: string[];
  cta: string | null;
  char_count: number | null;
  optimized_for: string | null;
  ab_group: string | null;
};

export function VariantEditor({
  contentId,
  subjectId,
  variants,
}: {
  contentId: string;
  subjectId: string;
  variants: Variant[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ChannelKey[]>(["x", "instagram"]);
  const [edits, setEdits] = useState<Record<string, string>>({});

  const grouped = variants.reduce<Record<string, Variant[]>>((acc, v) => {
    (acc[v.channel] ??= []).push(v);
    return acc;
  }, {});

  return (
    <>
      {variants.length === 0 ? (
        <div className="text-center py-6">
          <p className="muted text-xs">まだ媒体別の投稿文がありません。</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => setOpen(true)}>
            媒体別に最適化する
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {Object.entries(grouped).map(([channel, list]) => (
              <div key={channel}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge tone="info">{CHANNEL_LABEL[channel as ChannelKey] ?? channel}</Badge>
                  {list[0]?.optimized_for && (
                    <span className="muted text-[11px] truncate">{list[0].optimized_for}</span>
                  )}
                </div>

                {list.map((v) => {
                  const limit = CHANNEL_LIMIT[v.channel as ChannelKey] || 0;
                  const value = edits[v.id] ?? v.body;
                  const over = limit > 0 && value.length > limit;

                  return (
                    <div key={v.id} className="mb-2.5">
                      {v.ab_group && list.length > 1 && (
                        <p className="text-[11px] muted mb-1">{v.ab_group}案</p>
                      )}
                      <Textarea
                        value={value}
                        onChange={(e) => setEdits({ ...edits, [v.id]: e.target.value })}
                        rows={4}
                        className={over ? "border-red-400" : ""}
                      />
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span className={`text-[11px] tabular-nums ${over ? "text-red-600" : "muted"}`}>
                          {value.length}
                          {limit > 0 && ` / ${limit}`} 文字
                          {v.hashtags.length > 0 && ` · ${v.hashtags.join(" ")}`}
                        </span>
                        {edits[v.id] !== undefined && edits[v.id] !== v.body && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={async () => {
                              const res = await callApi("/api/workflow", {
                                action: "update_variant",
                                id: v.id,
                                body: value,
                              });
                              if (!res) return;
                              toast("保存しました");
                              router.refresh();
                            }}
                          >
                            保存
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <Button variant="ghost" size="sm" className="mt-3" onClick={() => setOpen(true)}>
            媒体を追加・再生成する
          </Button>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="媒体別に最適化する">
        <p className="muted text-xs leading-relaxed">
          選んだ媒体ごとに、冒頭の一文・文字数・CTAを作り分けます。A/Bテスト用のB案も同時に生成します。
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {CHANNELS.filter((c) => ["x", "instagram", "facebook", "gbp", "line", "email"].includes(c.key)).map(
            (c) => {
              const on = selected.includes(c.key as ChannelKey);
              return (
                <button
                  key={c.key}
                  onClick={() =>
                    setSelected((prev) =>
                      on ? prev.filter((x) => x !== c.key) : [...prev, c.key as ChannelKey],
                    )
                  }
                  className={`px-3 py-2.5 rounded-[4px] border text-xs text-left transition-colors
                  ${on ? "border-brand-500 bg-brand-50 dark:bg-brand-900/25" : "border-[var(--border)] hover:border-brand-300"}`}
                >
                  <span className="font-medium block">{c.label}</span>
                  {c.limit > 0 && <span className="muted">{c.limit}文字まで</span>}
                </button>
              );
            },
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            キャンセル
          </Button>
          <Button
            onClick={async () => {
              if (!selected.length) return toast("媒体を選んでください", "err");
              const res = await callApi("/api/agents", {
                action: "adapt_channels",
                subjectId,
                contentId,
                channels: selected,
                abTest: true,
              });
              if (!res) return;
              toast("AIマーケターが媒体別に最適化しました");
              setOpen(false);
              router.refresh();
            }}
          >
            最適化する
          </Button>
        </div>
      </Modal>
    </>
  );
}
