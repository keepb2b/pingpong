"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Button, callApi, toast } from "@/components/ui";
import { AgentIcon } from "@/components/icons/AgentIcons";
import { AGENTS, type AgentKey } from "@/lib/constants";

export function PageHeader({
  title,
  description,
  agent,
  action,
}: {
  title: string;
  description?: string;
  agent?: AgentKey;
  action?: ReactNode;
}) {
  const meta = agent ? AGENTS.find((a) => a.key === agent) : null;

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div className="flex items-start gap-3 min-w-0">
        {meta && (
          <span style={{ color: meta.color }} className="shrink-0">
            <AgentIcon agent={meta.key} size={38} />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="muted text-xs mt-1 leading-relaxed max-w-2xl">{description}</p>
          )}
          {meta && (
            <p className="text-[11px] mt-1.5" style={{ color: meta.color }}>
              担当: {meta.name}
            </p>
          )}
        </div>
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

/** AIエージェントを起動して結果を反映するボタン。 */
export function AgentButton({
  label,
  body,
  variant = "primary",
  size = "md",
  successMessage,
  onDone,
}: {
  label: string;
  body: Record<string, unknown>;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  successMessage?: string;
  onDone?: (data: unknown) => void;
}) {
  const router = useRouter();

  return (
    <Button
      variant={variant}
      size={size}
      onClick={async () => {
        const data = await callApi("/api/agents", body);
        if (data === null) return;
        toast(successMessage ?? "AIの処理が完了しました");
        onDone?.(data);
        router.refresh();
      }}
    >
      {label}
    </Button>
  );
}

/** 一覧・詳細から呼ぶ汎用の更新ボタン。 */
export function ActionButton({
  label,
  path,
  body,
  variant = "secondary",
  size = "sm",
  successMessage,
  confirm,
}: {
  label: string;
  path: string;
  body: Record<string, unknown>;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  successMessage?: string;
  confirm?: string;
}) {
  const router = useRouter();

  return (
    <Button
      variant={variant}
      size={size}
      onClick={async () => {
        if (confirm && !window.confirm(confirm)) return;
        const data = await callApi(path, body);
        if (data === null) return;
        toast(successMessage ?? "更新しました");
        router.refresh();
      }}
    >
      {label}
    </Button>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold">{children}</h2>
      {hint && <p className="muted text-xs mt-0.5 leading-relaxed">{hint}</p>}
    </div>
  );
}

export { formatDate, formatDateTime } from "@/lib/format-date";
