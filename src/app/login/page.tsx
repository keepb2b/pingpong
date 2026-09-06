"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button, Field, Input, toast } from "@/components/ui";
import { SparkIcon } from "@/components/icons/AgentIcons";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function signIn() {
    if (!email || !password) {
      toast("メールアドレスとパスワードを入力してください", "err");
      return;
    }
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    if (error) {
      toast(
        error.message.includes("Invalid login")
          ? "メールアドレスまたはパスワードが正しくありません"
          : error.message,
        "err",
      );
      return;
    }
    router.push(params.get("next") ?? "/dashboard");
    router.refresh();
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void signIn();
      }}
    >
      <Field label="メールアドレス" required>
        <Input
          type="email"
          value={email}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </Field>
      <Field label="パスワード" required>
        <Input
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </Field>
      <Button type="submit" onClick={signIn} className="w-full" size="lg">
        ログイン
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-dvh grid place-items-center px-5 py-12 relative">
      <div className="absolute inset-0 aurora" aria-hidden />
      <div className="relative w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 justify-center font-bold mb-6">
          <span className="text-brand-600">
            <SparkIcon size={20} />
          </span>
          AI広報
        </Link>

        <div className="card p-6">
          <h1 className="text-lg font-semibold">ログイン</h1>
          <p className="muted text-xs mt-1">AI広報部の管理画面へ</p>
          <div className="mt-5">
            <Suspense fallback={<div className="h-48 skeleton rounded-xl" />}>
              <LoginForm />
            </Suspense>
          </div>
        </div>

        <p className="mt-4 text-center text-xs muted">
          アカウントをお持ちでない場合は{" "}
          <Link href="/signup" className="text-brand-600 hover:underline">
            新規登録
          </Link>
        </p>
      </div>
    </main>
  );
}
