"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge, Input, callApi, toast } from "@/components/ui";

/**
 * AIが学習した内容に対するユーザーの判断。
 * 正しい / 修正する / 今回だけ使用する / 長期的に記憶する / 忘れさせる
 */
export function LearningRow({
  id,
  statement,
  evidence,
  category,
  createdAt,
  compact,
}: {
  id: string;
  statement: string;
  evidence: string | null;
  category: string;
  createdAt: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [correcting, setCorrecting] = useState(false);
  const [correction, setCorrection] = useState(statement);

  async function decide(decision: string, correctedTo?: string) {
    const res = await callApi("/api/workflow", {
      action: "review_learning",
      id,
      decision,
      corrected_to: correctedTo ?? null,
    });
    if (!res) return;
    toast(
      {
        correct: "正しい内容として記憶します",
        correct_to: "修正して記憶しました",
        once: "今回だけ使用します",
        long_term: "長期的に記憶します",
        forget: "忘れさせました",
      }[decision] ?? "更新しました",
    );
    setCorrecting(false);
    router.refresh();
  }

  const buttons = (
    <div className="flex flex-wrap gap-1.5">
      <Button size="sm" variant="success" onClick={() => decide("correct")}>
        正しい
      </Button>
      <Button size="sm" variant="secondary" onClick={() => setCorrecting(true)}>
        修正する
      </Button>
      <Button size="sm" variant="ghost" onClick={() => decide("once")}>
        今回だけ
      </Button>
      <Button size="sm" variant="ghost" onClick={() => decide("long_term")}>
        長期記憶
      </Button>
      <Button size="sm" variant="ghost" onClick={() => decide("forget")}>
        忘れさせる
      </Button>
    </div>
  );

  if (compact) {
    return (
      <div className="shrink-0">
        <Button size="sm" variant="ghost" onClick={() => decide("forget")}>
          忘れさせる
        </Button>
      </div>
    );
  }

  return (
    <li className="p-4 rounded-[4px] border border-[var(--border)]">
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <Badge>{category}</Badge>
        <span className="ml-auto muted text-[11px] tabular-nums">{createdAt}</span>
      </div>

      <p className="text-sm leading-relaxed">{statement}</p>

      {evidence && (
        <p className="muted text-[11px] mt-1.5 leading-relaxed">
          根拠: 「{evidence.slice(0, 140)}
          {evidence.length > 140 ? "…" : ""}」
        </p>
      )}

      <div className="mt-3">
        {correcting ? (
          <div className="flex flex-wrap gap-2">
            <Input
              value={correction}
              onChange={(e) => setCorrection(e.target.value)}
              className="flex-1 min-w-[16rem]"
              placeholder="正しい内容に書き換えてください"
            />
            <Button size="sm" onClick={() => decide("correct_to", correction)}>
              保存
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCorrecting(false)}>
              キャンセル
            </Button>
          </div>
        ) : (
          buttons
        )}
      </div>
    </li>
  );
}
