import { handle, ApiError } from "@/lib/api";
import { supabaseServer } from "@/lib/supabase/server";
import { confirmEmailWithoutMail, findAuthUserByEmail, mapAuthError } from "@/lib/users";

export const runtime = "nodejs";

/** パスワードログイン。未確認ユーザーは SMTP なしで確定してからセッションを作る。 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = (await request.json()) as Record<string, unknown>;
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) {
      throw new ApiError("メールアドレスとパスワードを入力してください");
    }

    const existing = await findAuthUserByEmail(email);
    if (existing && !existing.email_confirmed_at) {
      try {
        await confirmEmailWithoutMail(existing.id);
      } catch (err) {
        console.error("[login] confirm", err);
      }
    }

    const sb = await supabaseServer();
    let { error } = await sb.auth.signInWithPassword({ email, password });

    if (error && /email is not configured|not confirmed|confirm/i.test(error.message)) {
      const again = existing ?? (await findAuthUserByEmail(email));
      if (again) {
        await confirmEmailWithoutMail(again.id);
        ({ error } = await sb.auth.signInWithPassword({ email, password }));
      }
    }

    if (error) {
      throw new ApiError(mapAuthError(error.message, "ログインに失敗しました"), 401);
    }

    return { ok: true };
  });
}
