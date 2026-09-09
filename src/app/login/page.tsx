"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Field, Input, PasswordInput, callApi, toast } from "@/components/ui";
import { takePendingAvatar } from "@/lib/upload";
import { Logo } from "@/components/Logo";

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
    const loggedIn = await callApi("/api/login", { email, password });
    if (!loggedIn) return;

    // 登録時にメール確認待ちだった場合、控えておいたアバターをここで紐づける
    const pending = takePendingAvatar();
    if (pending) {
      await callApi("/api/account", { action: "attach_avatar", avatar_url: pending });
    }
    await callApi("/api/account", { action: "touch" });

    router.push(params.get("next") ?? "/dashboard");
    router.refresh();
  }

  return (
    <form
      className="space-y-5"
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
          placeholder="you@example.co.jp"
        />
      </Field>

      <Field label="パスワード" required>
        <PasswordInput
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder="パスワード"
        />
      </Field>

      <Button type="submit" className="w-full" size="lg">
        ログイン
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-dvh bg-[var(--surface-2)]">
      <header className="bg-[var(--surface)] border-b-[3px] border-brand-600">
        <div className="mx-auto max-w-5xl px-5 h-16 flex items-center">
          <Link href="/">
            <Logo size={30} />
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-md px-5 py-12">
        <h1 className="section-title text-[18px]">ログイン</h1>

        <div className="card p-6">
          <Suspense fallback={<div className="h-56 skeleton rounded-[3px]" />}>
            <LoginForm />
          </Suspense>
        </div>

        <div className="card mt-4 p-4 bg-[var(--surface)]">
          <p className="text-[13px] font-semibold mb-1.5">アカウントをお持ちでない方</p>
          <p className="muted text-[12px] leading-relaxed mb-3">
            ご登録後、6人の専門AIによる広報部の初期設定にお進みいただけます。
          </p>
          <Link href="/signup" className="btn btn-secondary h-9 px-4 text-[13px] w-full">
            <span>新規登録はこちら</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
