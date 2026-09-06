#!/usr/bin/env node
/**
 * 運営管理者アカウントを作成する。
 *
 *   npm run db:seed:admin
 *   npm run db:seed:admin -- other@example.com "OtherPassw0rd"
 *
 * 既定: admin@gmail.com / Admin@gmail.com
 * 既に存在する場合はパスワードを再設定し、管理者権限を付与し直す。
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const file of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(join(root, file), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // 任意
  }
}

const EMAIL = process.argv[2] || "admin@gmail.com";
const PASSWORD = process.argv[3] || "Admin@gmail.com";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function main() {
  // スキーマ確認
  {
    const { error } = await sb.from("profiles").select("id").limit(1);
    if (error) {
      throw new Error(
        "スキーマが未適用です。supabase/schema.sql を Supabase の SQL editor で実行してください。\n  " +
          error.message,
      );
    }
  }
  {
    const { error } = await sb.from("profiles").select("is_platform_admin").limit(1);
    if (error) {
      throw new Error(
        "0004_accounts_admin.sql が未適用です。supabase/schema.sql を再実行してください。\n  " +
          error.message,
      );
    }
  }

  // ユーザーの作成 (既存ならパスワードを再設定)
  let userId = null;

  const { data: created, error: createError } = await sb.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: "運営管理者" },
  });

  if (created?.user) {
    userId = created.user.id;
    console.log(`→ 管理者ユーザーを作成しました: ${EMAIL}`);
  } else if (createError && /already|exists|registered/i.test(createError.message)) {
    // 既存ユーザーを探してパスワードを揃える
    let page = 1;
    while (!userId && page <= 10) {
      const { data: list } = await sb.auth.admin.listUsers({ page, perPage: 200 });
      userId = list?.users?.find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase())?.id ?? null;
      if (!list?.users?.length) break;
      page++;
    }
    if (!userId) throw new Error(`既存ユーザー ${EMAIL} を特定できませんでした`);

    const { error } = await sb.auth.admin.updateUserById(userId, {
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`パスワードの更新に失敗しました: ${error.message}`);
    console.log(`→ 既存の管理者ユーザーを更新しました: ${EMAIL}`);
  } else {
    throw new Error(`ユーザー作成に失敗しました: ${createError?.message}`);
  }

  // プロフィールに管理者権限を付与
  const { error: profileError } = await sb.from("profiles").upsert(
    {
      id: userId,
      email: EMAIL,
      display_name: "運営管理者",
      company_name: "AI広報 運営事務局",
      job_title: "システム管理者",
      is_platform_admin: true,
    },
    { onConflict: "id" },
  );
  if (profileError) throw new Error(`プロフィールの更新に失敗しました: ${profileError.message}`);

  const { data: check } = await sb
    .from("profiles")
    .select("email, is_platform_admin")
    .eq("id", userId)
    .single();

  console.log(`
✓ 運営管理者を登録しました

  ログインID   ${EMAIL}
  パスワード   ${PASSWORD}
  管理者権限   ${check?.is_platform_admin ? "有効" : "無効"}

  ログイン後、ヘッダーのアバター →「運営管理ページ」から
  http://localhost:3000/admin にアクセスできます。
`);
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}`);
  process.exitCode = 1;
});
