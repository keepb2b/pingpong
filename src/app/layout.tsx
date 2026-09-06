import type { Metadata, Viewport } from "next";
import { ToastHost } from "@/components/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AI広報 — LINEで一言送るだけの、成果を出すAI広報部",
    template: "%s | AI広報",
  },
  description:
    "6人の専門AIがチームとなって、企業・サービス・商品・ブランド・店舗・個人の広報活動を支援します。情報収集から戦略立案、制作、投稿、効果分析、改善までを継続。",
  openGraph: {
    title: "AI広報 — 成果を出すAI広報部",
    description: "LINEで一言送るだけ。使うほど会社を理解し、成果を出す「AI広報部」。",
    locale: "ja_JP",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0e18" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="antialiased">
        {children}
        <ToastHost />
      </body>
    </html>
  );
}
