import { handle, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { parseSignupRequest } from "@/lib/signup-input";
import { provisionOwnerOrg, saveAvatarForUser } from "@/lib/provision";
import { confirmEmailWithoutMail, findAuthUserByEmail, mapAuthError } from "@/lib/users";

export const runtime = "nodejs";

/**
 * 会員登録をサーバー側で完結させる。
 * Auth ユーザーは最初から確定済みにし、確認メールは送らない。
 */
export async function POST(request: Request) {
  return handle(async () => {
    const fields = await parseSignupRequest(request);
    if (!fields.orgName) {
      throw new ApiError("会社名・組織名を入力してください");
    }

    const user = await createOrRecoverUser(fields.email, fields.password, fields.displayName);
    try {
      await confirmEmailWithoutMail(user.id);
    } catch (err) {
      console.error("[signup] confirm", err);
    }

    let avatarUrl: string | null = null;
    if (fields.avatar) {
      avatarUrl = await saveAvatarForUser(user.id, fields.avatar);
      await supabaseAdmin()
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", user.id);
    }

    const provisioned = await provisionOwnerOrg({
      userId: user.id,
      email: user.email ?? fields.email,
      displayName: fields.displayName,
      orgName: fields.orgName,
      website: fields.website,
      subjectName: fields.subjectName,
      subjectType: fields.subjectType,
      avatarUrl,
    });

    await establishSession(fields.email, fields.password);

    return {
      userId: user.id,
      orgId: provisioned.orgId,
      avatarUrl,
    };
  });
}

async function establishSession(email: string, password: string) {
  const listed = await findAuthUserByEmail(email);
  if (listed) {
    try {
      await confirmEmailWithoutMail(listed.id);
    } catch (err) {
      console.error("[signup] confirm", err);
    }
  }

  const sb = await supabaseServer();
  let { error } = await sb.auth.signInWithPassword({ email, password });
  if (error && /confirm|not confirmed|email is not configured/i.test(error.message)) {
    if (listed) await confirmEmailWithoutMail(listed.id);
    ({ error } = await sb.auth.signInWithPassword({ email, password }));
  }
  if (error) {
    console.error("[signup] session", error.message);
    return;
  }
}

async function createOrRecoverUser(email: string, password: string, displayName: string) {
  const sb = supabaseAdmin();
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (data?.user) return data.user;

  if (error && /already|exists|registered/i.test(error.message)) {
    const existing = await findAuthUserByEmail(email);
    if (!existing) throw new ApiError("このメールアドレスは既に登録されています");

    const { data: membership } = await sb
      .from("memberships")
      .select("org_id")
      .eq("user_id", existing.id)
      .maybeSingle();

    if (existing.email_confirmed_at && membership) {
      throw new ApiError("このメールアドレスは既に登録されています");
    }

    const { error: updateError } = await sb.auth.admin.updateUserById(existing.id, {
      password,
      user_metadata: { display_name: displayName },
    });
    if (updateError) throw new ApiError(mapAuthError(updateError.message), 500);
    return existing;
  }

  throw new ApiError(mapAuthError(error?.message ?? "", "アカウントの作成に失敗しました"), 500);
}
