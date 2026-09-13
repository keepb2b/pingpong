/** バッジ色。サーバー／クライアントのどちらからでも呼べる。 */

export type BadgeTone = "neutral" | "brand" | "good" | "warn" | "bad" | "info";

export function riskTone(risk: string): BadgeTone {
  return risk === "critical" || risk === "high"
    ? "bad"
    : risk === "medium"
      ? "warn"
      : risk === "low"
        ? "info"
        : "good";
}

export function statusTone(status: string): BadgeTone {
  if (["published", "approved"].includes(status)) return "good";
  if (status === "scheduled") return "brand";
  if (["pending_approval", "fact_check", "proposed"].includes(status)) return "warn";
  if (["rejected", "failed"].includes(status)) return "bad";
  return "neutral";
}
