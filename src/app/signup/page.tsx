"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { uploadAvatar } from "@/lib/upload";
import {
  Button,
  Field,
  Input,
  Select,
  PasswordInput,
  AvatarPicker,
  callApi,
  toast,
} from "@/components/ui";
import { Logo } from "@/components/Logo";
import { SUBJECT_TYPE_LABEL } from "@/lib/constants";

export default function SignupPage() {
  const router = useRouter();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
    passwordConfirm: "",
    orgName: "",
    subjectName: "",
    subjectType: "company",
    website: "",
  });
  const [agreed, setAgreed] = useState(false);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const passwordMismatch =
    form.passwordConfirm.length > 0 && form.password !== form.passwordConfirm;
  const passwordTooShort = form.password.length > 0 && form.password.length < 8;

  async function signUp() {
    if (!form.displayName || !form.email || !form.password || !form.orgName) {
      toast("必須項目を入力してください", "err");
      return;
    }
    if (form.password.length < 8) {
      toast("パスワードは8文字以上にしてください", "err");
      return;
    }
    if (form.password !== form.passwordConfirm) {
      toast("確認用パスワードが一致しません", "err");
      return;
    }
    if (!agreed) {
      toast("利用規約への同意が必要です", "err");
      return;
    }

    const registered = await callApi<{ userId: string }>("/api/signup", {
      email: form.email,
      password: form.password,
      displayName: form.displayName,
    });
    if (!registered) return;

    const { data, error } = await supabaseBrowser().auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });
    if (error || !data.session) {
      toast(error?.message ?? "ログインに失敗しました", "err");
      return;
    }

    let avatarUrl: string | null = null;
    if (avatarFile) {
      try {
        avatarUrl = await uploadAvatar(avatarFile, data.user?.id);
      } catch (err) {
        toast(err instanceof Error ? err.message : "画像の保存に失敗しました", "err");
      }
    }

    const created = await callApi("/api/setup", {
      action: "create_org",
      orgName: form.orgName,
      displayName: form.displayName,
      website: form.website,
      subjectName: form.subjectName || form.orgName,
      subjectType: form.subjectType,
    });
    if (!created) return;

    if (avatarUrl) {
      await callApi("/api/account", { action: "attach_avatar", avatar_url: avatarUrl });
    }

    toast("登録が完了しました");
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <main className="min-h-dvh bg-[var(--surface-2)]">
      {/* ヘッダー */}
      <header className="bg-[var(--surface)] border-b-[3px] border-brand-600">
        <div className="mx-auto max-w-5xl px-5 h-16 flex items-center justify-between">
          <Link href="/">
            <Logo size={30} />
          </Link>
          <Link href="/login" className="text-[13px] text-[var(--link)] hover:underline">
            すでにご登録の方はこちら
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-8">
        <nav className="breadcrumb mb-3" aria-label="パンくず">
          <Link href="/">ホーム</Link>
          <span className="mx-1.5 opacity-60">›</span>
          <span className="text-[var(--text)]">新規登録</span>
        </nav>

        <h1 className="section-title text-[20px]">新規登録</h1>

        {/* 手順表示 — 日本のサイトでよく使われるステップ表示 */}
        <ol className="flex mb-6 border border-[var(--border)] rounded-[4px] overflow-hidden bg-[var(--surface)]">
          {["お客様情報の入力", "初期設定", "利用開始"].map((label, i) => (
            <li
              key={label}
              className={`flex-1 text-center py-2.5 text-[12px] font-semibold border-r border-[var(--border)] last:border-r-0
                ${i === 0 ? "band" : "muted"}`}
            >
              <span className="tabular-nums mr-1.5">STEP {i + 1}</span>
              {label}
            </li>
          ))}
        </ol>

        <form
          className="card p-5 sm:p-7"
          onSubmit={(e) => {
            e.preventDefault();
            void signUp();
          }}
        >
          {/* --------------------------------------------------- ご担当者 -- */}
          <h2 className="heading-bar text-[15px] mb-4">ご担当者さまの情報</h2>

          <div className="space-y-5">
            <div>
              <span className="flex items-center gap-1.5 text-[13px] font-semibold mb-2">
                プロフィール画像
                <span className="badge-optional">任意</span>
              </span>
              <AvatarPicker
                value={avatarPreview}
                name={form.displayName || form.email}
                onSelect={(file, preview) => {
                  setAvatarFile(file);
                  setAvatarPreview(preview);
                }}
              />
            </div>

            <Field label="お名前" required>
              <Input
                value={form.displayName}
                autoComplete="name"
                onChange={(e) => set("displayName")(e.target.value)}
                placeholder="山田 太郎"
              />
            </Field>

            <Field label="メールアドレス" hint="ログインIDとして使用します。" required>
              <Input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => set("email")(e.target.value)}
                placeholder="you@example.co.jp"
              />
            </Field>

            <Field label="パスワード" hint="8文字以上。英字と数字を組み合わせてください。" required>
              <PasswordInput
                value={form.password}
                onChange={set("password")}
                autoComplete="new-password"
                placeholder="8文字以上"
                invalid={passwordTooShort}
              />
              {passwordTooShort && (
                <p className="text-[11.5px] text-[#c8102e] mt-1.5">
                  パスワードは8文字以上で入力してください。
                </p>
              )}
            </Field>

            <Field label="パスワード（確認）" hint="確認のため、もう一度入力してください。" required>
              <PasswordInput
                value={form.passwordConfirm}
                onChange={set("passwordConfirm")}
                autoComplete="new-password"
                placeholder="もう一度入力"
                invalid={passwordMismatch}
              />
              {passwordMismatch && (
                <p className="text-[11.5px] text-[#c8102e] mt-1.5">
                  パスワードが一致しません。
                </p>
              )}
              {!passwordMismatch && form.passwordConfirm.length > 0 && !passwordTooShort && (
                <p className="text-[11.5px] text-[#1d6f4a] mt-1.5">パスワードが一致しました。</p>
              )}
            </Field>
          </div>

          {/* ----------------------------------------------------- 広報対象 */}
          <h2 className="heading-bar text-[15px] mt-8 mb-4">広報対象の情報</h2>

          <div className="space-y-5">
            <Field label="会社名・組織名" required>
              <Input
                value={form.orgName}
                autoComplete="organization"
                onChange={(e) => set("orgName")(e.target.value)}
                placeholder="株式会社◯◯"
              />
            </Field>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="広報対象の名称" hint="未入力の場合は会社名を使用します。" optional>
                <Input
                  value={form.subjectName}
                  onChange={(e) => set("subjectName")(e.target.value)}
                  placeholder="自社"
                />
              </Field>
              <Field label="種別" optional>
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

            <Field label="Webサイト" optional>
              <Input
                type="url"
                value={form.website}
                onChange={(e) => set("website")(e.target.value)}
                placeholder="https://example.co.jp"
              />
            </Field>
          </div>

          {/* ------------------------------------------------------- 同意 -- */}
          <div className="mt-7 pt-5 border-t border-[var(--border)]">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--color-brand-600)]"
              />
              <span className="text-[13px] leading-relaxed">
                <span className="badge-required mr-1.5">必須</span>
                利用規約およびプライバシーポリシーに同意します。
              </span>
            </label>

            <div className="mt-5 flex flex-col sm:flex-row gap-3 sm:justify-center">
              <Button type="submit" onClick={signUp} size="lg" className="sm:min-w-[16rem]">
                上記の内容で登録する
              </Button>
              <Link
                href="/"
                className="btn btn-secondary h-11 px-6 text-[15px] sm:min-w-[10rem]"
              >
                <span>戻る</span>
              </Link>
            </div>
          </div>
        </form>

        <p className="mt-5 text-center text-[13px] muted">
          既にアカウントをお持ちの場合は{" "}
          <Link href="/login" className="text-[var(--link)] hover:underline font-medium">
            ログイン
          </Link>
        </p>
      </div>
    </main>
  );
}
