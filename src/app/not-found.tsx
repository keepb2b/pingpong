import Link from "next/link";
import { PublicShell } from "@/components/dashboard/PublicShell";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return <PublicShell>
    <main className="min-h-dvh flex items-center justify-center p-5">
      <div className="card w-full max-w-md p-6 sm:p-8 text-center">
        <FileQuestion size={36} className="mx-auto mb-4 text-brand-600" />
        <p className="muted text-xs mb-2">404</p>
        <h1 className="text-xl font-semibold">ページが見つかりません</h1>
        <p className="muted text-sm mt-3">URLをご確認いただくか、ホームへお戻りください。</p>
        <Link href="/" className="btn btn-primary mt-6 px-5 py-2">ホームへ戻る</Link>
      </div>
    </main>
  </PublicShell>;
}
