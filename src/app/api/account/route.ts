import { handle, ApiError } from "@/lib/api";
import { supabaseServer, getSessionUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** アカウント情報の閲覧・編集 */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await getSessionUser();
    if (!user) throw new ApiError("認証が必要です", 401);

    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const sb = supabaseAdmin();

    switch (action) {
      // ------------------------------------------------ プロフィール更新 --
      case "update_profile": {
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const key of [
          "display_name",
          "avatar_url",
          "phone",
          "company_name",
          "department",
          "job_title",
          "bio",
        ]) {
          if (key in body) {
            const raw = body[key];
            patch[key] = raw === "" ? null : raw;
          }
        }

        if ("display_name" in patch && !patch.display_name) {
          throw new ApiError("お名前を入力してください");
        }

        const { error } = await sb.from("profiles").update(patch).eq("id", user.id);
        if (error) throw new ApiError(error.message, 500);

        return { ok: true };
      }

      // ---------------------------------------------------- パスワード ----
      case "update_password": {
        const next = String(body.password ?? "");
        if (next.length < 8) throw new ApiError("パスワードは8文字以上にしてください");
        if (next !== String(body.password_confirm ?? "")) {
          throw new ApiError("確認用パスワードが一致しません");
        }

        // 現在のパスワードで本人確認をしてから変更する
        const current = String(body.current_password ?? "");
        if (!current) throw new ApiError("現在のパスワードを入力してください");

        const authClient = await supabaseServer();
        const { error: signInError } = await authClient.auth.signInWithPassword({
          email: user.email!,
          password: current,
        });
        if (signInError) throw new ApiError("現在のパスワードが正しくありません", 403);

        const { error } = await sb.auth.admin.updateUserById(user.id, { password: next });
        if (error) throw new ApiError(error.message, 500);

        return { ok: true };
      }

      // ------------------------------------------------ 最終ログイン記録 --
      case "touch": {
        await sb
          .from("profiles")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", user.id);
        return { ok: true };
      }

      // ---------------------------- サインアップ直後のプロフィール補完 ----
      // (メール確認が必要な設定では、確認前にアバターURLだけ先に保存する)
      case "attach_avatar": {
        const url = String(body.avatar_url ?? "");
        if (!url) throw new ApiError("avatar_url が必要です");
        await sb.from("profiles").update({ avatar_url: url }).eq("id", user.id);
        return { ok: true };
      }

      default:
        throw new ApiError(`不明なアクション: ${action}`);
    }
  });
}
