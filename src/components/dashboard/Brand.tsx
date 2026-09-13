export function DashboardMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M14 3 26 24H16l-4-7h6l-4-7-8 14H2L14 3Z" fill="#2875ff" />
    </svg>
  );
}

export function DashboardBrand() {
  return <span className="inline-flex items-center gap-2.5 font-semibold text-lg"><DashboardMark />AI広報部</span>;
}
