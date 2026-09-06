"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button, Field, Input, Select, toast, callApi } from "@/components/ui";
import { SparkIcon } from "@/components/icons/AgentIcons";
import { SUBJECT_TYPE_LABEL } from "@/lib/constants";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
    orgName: "",
    subjectName: "",
    subjectType: "company",
    website: "",
  });

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function signUp() {
    if (!form.email || !form.password || !form.orgName) {
      toast("必須項目を入力してください", "err");
      return;
    }
    if (form.password.length < 8) {
      toast("パスワードは8文字以上にしてください", "err");
      return;
    }

    const sb = supabaseBrowser();
    const { data, error } = await sb.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { display_name: form.displayName || form.email.split("@")[0] } },
    });

    if (error) {
      toast(
        error.message.includes("already registered")
          ? "このメールアドレスは既に登録されています"
          : error.message,
        "err",
      );
      return;
    }

    // メール確認が必須の設定ではセッションが張られない
    if (!data.session) {
      toast("確認メールを送信しました。メール内のリンクから認証してください。");
      router.push("/login");
      return;
    }

    const created = await callApi<{ orgId: string }>("/api/setup", {
      action: "create_org",
      orgName: form.orgName,
      displayName: form.displayName,
      website: form.website,
      subjectName: form.subjectName || form.orgName,
      subjectType: form.subjectType,
    });

    if (!created) return;

    toast("登録が完了しました");
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <main className="min-h-dvh grid place-items-center px-5 py-12 relative">
      <div className="absolute inset-0 aurora" aria-hidden />
      <div className="relative w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 justify-center font-bold mb-6">
          <span className="text-brand-600">
            <SparkIcon size={20} />
          </span>
          AI広報
        </Link>

        <div className="card p-6">
          <h1 className="text-lg font-semibold">新規登録</h1>
          <p className="muted text-xs mt-1">
            登録後、AI広報カルテの初期設定へ進みます。
          </p>

          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void signUp();
            }}
          >
            <Field label="お名前">
              <Input
                value={form.displayName}
                onChange={(e) => set("displayName")(e.target.value)}
                placeholder="山田 太郎"
              />
            </Field>

            <Field label="メールアドレス" required>
              <Input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => set("email")(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>

            <Field label="パスワード" hint="8文字以上" required>
              <Input
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => set("password")(e.target.value)}
                placeholder="••••••••"
              />
            </Field>

            <div className="pt-2 border-t border-[var(--border)]">
              <p className="text-xs font-medium mb-3 muted">広報対象の情報</p>

              <div className="space-y-4">
                <Field label="会社名・組織名" required>
                  <Input
                    value={form.orgName}
                    onChange={(e) => set("orgName")(e.target.value)}
                    placeholder="株式会社◯◯"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="広報対象の名称" hint="空欄なら会社名">
                    <Input
                      value={form.subjectName}
                      onChange={(e) => set("subjectName")(e.target.value)}
                      placeholder="自社"
                    />
                  </Field>
                  <Field label="種別">
                    <Select
                      value={form.subjectType}
                      onChange={(e) => set("subjectType")(e.target.value)}
                    >
                      {Object.entries(SUBJECT_TYPE_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <Field label="Webサイト">
                  <Input
                    value={form.website}
                    onChange={(e) => set("website")(e.target.value)}
                    placeholder="https://example.com"
                  />
                </Field>
              </div>
            </div>

            <Button type="submit" onClick={signUp} className="w-full" size="lg">
              登録してはじめる
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs muted">
          既にアカウントをお持ちの場合は{" "}
          <Link href="/login" className="text-brand-600 hover:underline">
            ログイン
          </Link>
        </p>
      </div>
    </main>
  );
}
