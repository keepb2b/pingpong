"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Field,
  Input,
  Textarea,
  PasswordInput,
  AvatarPicker,
  callApi,
  toast,
} from "@/components/ui";
import { uploadAvatar } from "@/lib/upload";

type Profile = {
  display_name: string;
  avatar_url: string | null;
  email: string;
  phone: string;
  company_name: string;
  department: string;
  job_title: string;
  bio: string;
};

export function AccountForm({ userId, initial }: { userId: string; initial: Profile }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(initial.avatar_url);

  const set = (k: keyof Profile) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.display_name.trim()) {
      toast("お名前を入力してください", "err");
      return;
    }

    let avatarUrl = form.avatar_url;

    // 新しい画像が選ばれていれば先に保存する
    if (avatarFile) {
      try {
        avatarUrl = await uploadAvatar(avatarFile, userId);
      } catch (err) {
        toast(err instanceof Error ? err.message : "画像の保存に失敗しました", "err");
        return;
      }
    } else if (preview === null) {
      avatarUrl = null; // 削除された
    }

    const res = await callApi("/api/account", {
      action: "update_profile",
      display_name: form.display_name,
      avatar_url: avatarUrl,
      phone: form.phone,
      company_name: form.company_name,
      department: form.department,
      job_title: form.job_title,
      bio: form.bio,
    });
    if (!res) return;

    toast("アカウント情報を保存しました");
    setForm((f) => ({ ...f, avatar_url: avatarUrl }));
    setAvatarFile(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div>
        <span className="text-[13px] font-semibold block mb-2">プロフィール画像</span>
        <AvatarPicker
          value={preview}
          name={form.display_name || form.email}
          onSelect={(file, previewUrl) => {
            setAvatarFile(file);
            setPreview(file ? previewUrl : null);
          }}
        />
      </div>

      <Field label="お名前" required>
        <Input value={form.display_name} onChange={(e) => set("display_name")(e.target.value)} />
      </Field>

      <Field label="メールアドレス" hint="変更はサポートまでお問い合わせください。">
        <Input value={form.email} disabled />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="電話番号" optional>
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone")(e.target.value)}
            placeholder="03-1234-5678"
          />
        </Field>
        <Field label="会社名" optional>
          <Input value={form.company_name} onChange={(e) => set("company_name")(e.target.value)} />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="部署" optional>
          <Input
            value={form.department}
            onChange={(e) => set("department")(e.target.value)}
            placeholder="広報部"
          />
        </Field>
        <Field label="役職" optional>
          <Input
            value={form.job_title}
            onChange={(e) => set("job_title")(e.target.value)}
            placeholder="広報担当"
          />
        </Field>
      </div>

      <Field label="自己紹介" hint="社内メンバーに表示されます。" optional>
        <Textarea value={form.bio} onChange={(e) => set("bio")(e.target.value)} rows={3} />
      </Field>

      <div className="pt-2 border-t border-[var(--border)]">
        <Button onClick={save} size="lg" className="w-full sm:w-auto sm:min-w-[14rem]">
          変更を保存する
        </Button>
      </div>
    </div>
  );
}

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const mismatch = confirm.length > 0 && next !== confirm;
  const tooShort = next.length > 0 && next.length < 8;

  async function save() {
    if (!current || !next || !confirm) {
      toast("すべての項目を入力してください", "err");
      return;
    }
    if (next.length < 8) {
      toast("新しいパスワードは8文字以上にしてください", "err");
      return;
    }
    if (next !== confirm) {
      toast("確認用パスワードが一致しません", "err");
      return;
    }

    const res = await callApi("/api/account", {
      action: "update_password",
      current_password: current,
      password: next,
      password_confirm: confirm,
    });
    if (!res) return;

    toast("パスワードを変更しました");
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  return (
    <div className="space-y-5">
      <Field label="現在のパスワード" required>
        <PasswordInput value={current} onChange={setCurrent} autoComplete="current-password" />
      </Field>

      <Field label="新しいパスワード" hint="8文字以上。" required>
        <PasswordInput
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          invalid={tooShort}
        />
        {tooShort && (
          <p className="text-[11.5px] text-[#c8102e] mt-1.5">8文字以上で入力してください。</p>
        )}
      </Field>

      <Field label="新しいパスワード（確認）" required>
        <PasswordInput
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          invalid={mismatch}
        />
        {mismatch && <p className="text-[11.5px] text-[#c8102e] mt-1.5">パスワードが一致しません。</p>}
        {!mismatch && confirm.length > 0 && !tooShort && (
          <p className="text-[11.5px] text-[#1d6f4a] mt-1.5">パスワードが一致しました。</p>
        )}
      </Field>

      <div className="pt-2 border-t border-[var(--border)]">
        <Button onClick={save} variant="secondary" size="lg" className="w-full sm:w-auto sm:min-w-[14rem]">
          パスワードを変更する
        </Button>
      </div>
    </div>
  );
}
