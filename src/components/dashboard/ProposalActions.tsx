"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, callApi, toast } from "@/components/ui";

export function ProposalActions({
  contentId,
  status,
}: {
  contentId?: string | null;
  status: string;
}) {
  const router = useRouter();
  const decided = ["approved", "scheduled", "published", "rejected"].includes(status);

  if (!contentId) {
    return (
      <p className="text-[12px] muted mt-3">制作後に承認操作ができます。</p>
    );
  }

  if (decided) {
    return (
      <Link href={`/dashboard/content/${contentId}`} className="inline-block mt-3 text-[12px] text-brand-700 font-medium hover:underline">
        詳細を見る
      </Link>
    );
  }

  async function act(action: "approve" | "revise" | "hold") {
    const res = await callApi(`/api/content/${contentId}/approve`, { action });
    if (!res) return;
    toast(
      {
        approve: "承認しました。投稿を予約します。",
        revise: "修正として差し戻しました。",
        hold: "保留にしました。",
      }[action],
    );
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2 mt-4">
      <Button size="sm" onClick={() => act("approve")}>
        承認
      </Button>
      <Button size="sm" variant="secondary" onClick={() => act("revise")}>
        修正
      </Button>
      <Button size="sm" variant="ghost" onClick={() => act("hold")}>
        保留
      </Button>
      <Link
        href={`/dashboard/content/${contentId}`}
        className="inline-flex items-center text-[12px] text-brand-700 font-medium hover:underline px-1"
      >
        詳細
      </Link>
    </div>
  );
}
