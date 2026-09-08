import { handle, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** メール確認なしで Auth ユーザーを作成する（サービスロールで確定済みにする）。 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = (await request.json()) as Record<string, unknown>;
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(body.password ?? "");
    const displayName = String(body.displayName ?? "").trim();

    if (!email || !password || !displayName) {
      throw new ApiError("必須項目を入力してください");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiError("メールアドレスの形式が正しくありません");
    }
    if (password.length < 8) {
      throw new ApiError("パスワードは8文字以上にしてください");
    }

    const sb = supabaseAdmin();
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });

    if (data?.user) {
      return { userId: data.user.id };
    }

    if (error && /already|exists|registered/i.test(error.message)) {
      const existing = await findAuthUserByEmail(email);
      if (!existing) throw new ApiError("このメールアドレスは既に登録されています");

      if (existing.email_confirmed_at) {
        throw new ApiError("このメールアドレスは既に登録されています");
      }

      // 以前の「確認待ち」ユーザーを確定し、今回のパスワードで入れるようにする
      const { error: updateError } = await sb.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      });
      if (updateError) throw new ApiError(updateError.message, 500);
      return { userId: existing.id };
    }

    throw new ApiError(error?.message ?? "アカウントの作成に失敗しました", 500);
  });
}

async function findAuthUserByEmail(email: string) {
  const sb = supabaseAdmin();
  for (let page = 1; page <= 10; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    const found = data?.users?.find((u) => u.email?.toLowerCase() === email);
    if (found) return found;
    if (!data?.users?.length) break;
  }
  return null;
}
