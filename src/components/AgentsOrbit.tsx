"use client";

import type { AgentKey } from "@/lib/constants";
import { AgentIcon } from "@/components/icons/AgentIcons";

const MODULES: {
  key: AgentKey;
  label: string;
  title: string;
  body: string;
  deg: number;
}[] = [
  {
    key: "secretary",
    label: "AI秘書",
    title: "聞き取る",
    body: "チャットでヒアリングし、広報に必要な情報と予定を集めます。",
    deg: 240,
  },
  {
    key: "strategist",
    label: "AIストラテジスト",
    title: "方向を決める",
    body: "市場と競合を読み、広報の進むべき方向を定めます。",
    deg: 300,
  },
  {
    key: "writer",
    label: "AIライター",
    title: "言葉をつくる",
    body: "記事・PR・SNSなど、届く言葉をブランドに合わせて書きます。",
    deg: 0,
  },
  {
    key: "creator",
    label: "AIクリエイター",
    title: "魅せる",
    body: "SNS画像やバナーなど、視覚でブランドを伝えます。",
    deg: 60,
  },
  {
    key: "marketer",
    label: "AIマーケター",
    title: "届ける",
    body: "媒体・時間・CTAを整え、必要な人へ確実に届けます。",
    deg: 120,
  },
  {
    key: "analyst",
    label: "AIアナリスト",
    title: "結果を読む",
    body: "PV・SNS・CVを分析し、次の改善につなげます。",
    deg: 180,
  },
];

export function AgentsOrbit() {
  return (
    <div>
      <div className="text-center max-w-3xl mx-auto">
        <p className="flex items-center justify-center gap-3 text-[11px] font-bold tracking-[0.28em] text-[#3b82f6]">
          <span className="h-px w-10 bg-[#93c5fd]" />
          AI PR TEAM
          <span className="h-px w-10 bg-[#93c5fd]" />
        </p>
        <h2 className="mt-4 font-serif text-[26px] sm:text-[32px] font-bold leading-[1.45] text-[#0f2a5c] tracking-tight">
          6人の専門AIが、ひとつの広報チームになる。
        </h2>
        <p className="mt-4 text-[13px] sm:text-[14px] leading-[1.95] text-[#5b6b82]">
          情報を集め、戦略を立て、言葉をつくり、ビジュアルで魅せ、届け、結果を読んで次に活かす。
          <br className="hidden sm:block" />
          6つの専門AIが、ひとつの広報チームとして動きます。
        </p>
      </div>

      {/* モバイル */}
      <ul className="mt-10 grid gap-8 lg:hidden">
        {MODULES.map((m) => (
          <li key={m.key} className="flex items-center gap-4">
            <OrbitIcon agent={m.key} />
            <ModuleCopy m={m} />
          </li>
        ))}
      </ul>

      {/* デスクトップ円環 */}
      <div className="relative mx-auto mt-6 hidden lg:block w-full max-w-[1080px] aspect-square max-h-[820px]">
        <svg className="absolute inset-[12%] w-[76%] h-[76%] pointer-events-none" viewBox="0 0 100 100" aria-hidden>
          <defs>
            <radialGradient id="orbit-glow" cx="50%" cy="50%" r="50%">
              <stop offset="70%" stopColor="#60a5fa" stopOpacity="0" />
              <stop offset="88%" stopColor="#60a5fa" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.55" />
            </radialGradient>
            <filter id="orbit-blur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.8" />
            </filter>
          </defs>
          <circle cx="50" cy="50" r="42" fill="url(#orbit-glow)" />
          <circle
            cx="50"
            cy="50"
            r="41.2"
            fill="none"
            stroke="#7dd3fc"
            strokeWidth="0.55"
            opacity="0.85"
            filter="url(#orbit-blur)"
          />
          <circle cx="50" cy="50" r="40.4" fill="none" stroke="#bfdbfe" strokeWidth="0.25" />
        </svg>

        <div className="absolute left-1/2 top-1/2 z-[2] w-[220px] -translate-x-1/2 -translate-y-1/2 text-center">
          <p className="font-serif text-[28px] font-bold text-[#0f2a5c] tracking-tight">AI広報部</p>
          <p className="mt-2 text-[12px] leading-[1.85] text-[#5b6b82]">
            6人の専門AIがチームとなって、広報活動を情報収集から戦略・制作・投稿・分析まで支援します。
          </p>
        </div>

        {MODULES.map((m) => {
          const rad = (m.deg * Math.PI) / 180;
          const r = 38;
          const x = 50 + r * Math.cos(rad);
          const y = 50 + r * Math.sin(rad);
          const onLeft = m.deg > 90 && m.deg < 270;
          return (
            <div
              key={m.key}
              className={`absolute z-[3] w-[280px] flex items-center gap-3 ${onLeft ? "flex-row-reverse text-right" : "text-left"}`}
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <OrbitIcon agent={m.key} />
              <ModuleCopy m={m} align={onLeft ? "right" : "left"} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModuleCopy({
  m,
  align = "left",
}: {
  m: (typeof MODULES)[number];
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <p
        className={`flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-[#3b82f6] ${
          align === "right" ? "justify-end" : ""
        }`}
      >
        {align === "left" && <AgentIcon agent={m.key} size={14} />}
        {m.label}
        {align === "right" && <AgentIcon agent={m.key} size={14} />}
      </p>
      <h3 className="mt-1 font-serif text-[20px] font-bold text-[#0f2a5c] leading-snug">{m.title}</h3>
      <p className="mt-1.5 text-[12px] leading-[1.8] text-[#5b6b82]">{m.body}</p>
    </div>
  );
}

function OrbitIcon({ agent }: { agent: AgentKey }) {
  return (
    <span
      className="relative shrink-0 grid place-items-center h-[92px] w-[92px]"
      style={{
        filter: "drop-shadow(0 8px 16px rgba(37,99,235,0.18))",
      }}
    >
      <span
        className="absolute inset-[-10px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(125,211,252,0.45) 0%, rgba(125,211,252,0) 70%)",
        }}
      />
      <Glyph agent={agent} />
    </span>
  );
}

function Glyph({ agent }: { agent: AgentKey }) {
  switch (agent) {
    case "secretary":
      return <PhoneGlyph />;
    case "strategist":
      return <CompassGlyph />;
    case "writer":
      return <PenGlyph />;
    case "creator":
      return <PaletteGlyph />;
    case "marketer":
      return <MegaGlyph />;
    default:
      return <ChartGlyph />;
  }
}

function PhoneGlyph() {
  return (
    <svg width="78" height="78" viewBox="0 0 78 78" aria-hidden>
      <defs>
        <linearGradient id="ph-b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
      </defs>
      <rect x="24" y="8" width="30" height="58" rx="6" fill="url(#ph-b)" />
      <rect x="27" y="14" width="24" height="42" rx="2" fill="#ecfdf5" />
      <rect x="30" y="18" width="18" height="10" rx="2" fill="#22c55e" />
      <rect x="30" y="31" width="14" height="7" rx="2" fill="#fff" />
      <circle cx="39" cy="60" r="2.2" fill="#cbd5e1" />
    </svg>
  );
}

function CompassGlyph() {
  return (
    <svg width="78" height="78" viewBox="0 0 78 78" aria-hidden>
      <defs>
        <linearGradient id="cp" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
      </defs>
      <circle cx="39" cy="39" r="24" fill="url(#cp)" stroke="#94a3b8" strokeWidth="2" />
      <circle cx="39" cy="39" r="18" fill="#eff6ff" />
      <path d="M39 24 L44 39 L39 54 L34 39 Z" fill="#2563eb" />
      <path d="M39 24 L42 39 L39 39 Z" fill="#f8fafc" />
      <circle cx="39" cy="39" r="3.5" fill="#1e3a8a" />
    </svg>
  );
}

function PenGlyph() {
  return (
    <svg width="78" height="78" viewBox="0 0 78 78" aria-hidden>
      <rect x="18" y="50" width="44" height="16" rx="1.5" fill="#f1f5f9" stroke="#e2e8f0" />
      <rect x="20" y="46" width="40" height="14" rx="1.5" fill="#fff" stroke="#e2e8f0" />
      <g transform="rotate(-28 40 36)">
        <rect x="18" y="32" width="42" height="8" rx="2" fill="#111827" />
        <rect x="18" y="32" width="10" height="8" fill="#d4af37" />
        <path d="M60 32 L70 36 L60 40 Z" fill="#d4af37" />
      </g>
    </svg>
  );
}

function PaletteGlyph() {
  return (
    <svg width="78" height="78" viewBox="0 0 78 78" aria-hidden>
      <ellipse cx="36" cy="42" rx="24" ry="18" fill="#b45309" />
      <ellipse cx="36" cy="40" rx="20" ry="14" fill="#fef3c7" />
      <circle cx="26" cy="36" r="4" fill="#ef4444" />
      <circle cx="36" cy="33" r="4" fill="#3b82f6" />
      <circle cx="46" cy="36" r="4" fill="#22c55e" />
      <circle cx="32" cy="46" r="3.5" fill="#f59e0b" />
      <rect x="50" y="18" width="4" height="32" rx="2" fill="#78716c" transform="rotate(28 52 34)" />
    </svg>
  );
}

function MegaGlyph() {
  return (
    <svg width="78" height="78" viewBox="0 0 78 78" aria-hidden>
      <defs>
        <linearGradient id="mg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <path d="M18 32 L46 22 L46 56 L18 46 Z" fill="url(#mg)" />
      <rect x="14" y="32" width="8" height="14" rx="1.5" fill="#1e40af" />
      <path d="M22 46 L22 58 L30 58 L32 46" fill="#2563eb" />
      <path d="M52 28a16 16 0 0 1 0 22" fill="none" stroke="#7dd3fc" strokeWidth="2" />
      <path d="M57 24a22 22 0 0 1 0 30" fill="none" stroke="#93c5fd" strokeWidth="2" opacity="0.8" />
    </svg>
  );
}

function ChartGlyph() {
  return (
    <svg width="78" height="78" viewBox="0 0 78 78" aria-hidden>
      <rect x="18" y="44" width="10" height="18" rx="2" fill="#93c5fd" />
      <rect x="32" y="32" width="10" height="30" rx="2" fill="#3b82f6" />
      <rect x="46" y="24" width="10" height="38" rx="2" fill="#1d4ed8" />
      <circle cx="50" cy="28" r="14" fill="none" stroke="#64748b" strokeWidth="4" />
      <path d="M60 38 L70 48" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
