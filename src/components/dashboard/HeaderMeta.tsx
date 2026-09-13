export function HeaderMeta() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const date = `${get("year")}年${get("month")}月${get("day")}日 ${get("weekday")}`;
  const time = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  return (
    <div className="hidden xl:block text-right pl-3 ml-1 border-l border-[var(--border)] leading-tight shrink-0">
      <p className="text-[12px] font-medium text-ink-800 tabular-nums whitespace-nowrap">{date}</p>
      <p className="text-[11px] muted mt-0.5 whitespace-nowrap">最終更新 {time}</p>
    </div>
  );
}
