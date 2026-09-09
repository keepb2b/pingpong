import { handle, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { parseSignupRequest } from "@/lib/signup-input";
import { provisionOwnerOrg, saveAvatarForUser } from "@/lib/provision";

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
    await confirmEmailWithoutMail(user.id);

    let avatarUrl: string | null = null;
    if (fields.avatar) {
      avatarUrl = await saveAvatarForUser(user.id, fields.avatar);
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

/** 確認メールを出さず、メールアドレスを確定済みにする。 */
async function confirmEmailWithoutMail(userId: string) {
  const sb = supabaseAdmin();
  const { error } = await sb.auth.admin.updateUserById(userId, { email_confirm: true });
  if (error) throw new ApiError(error.message, 500);
}

async function establishSession(email: string, password: string) {
  const sb = await supabaseServer();
  let { error } = await sb.auth.signInWithPassword({ email, password });
  if (error && /confirm|not confirmed/i.test(error.message)) {
    const listed = await findAuthUserByEmail(email);
    if (listed) await confirmEmailWithoutMail(listed.id);
    ({ error } = await sb.auth.signInWithPassword({ email, password }));
  }
  if (error) throw new ApiError(error.message, 500);
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
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    if (updateError) throw new ApiError(updateError.message, 500);
    return existing;
  }

  throw new ApiError(error?.message ?? "アカウントの作成に失敗しました", 500);
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
