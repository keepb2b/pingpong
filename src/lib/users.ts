import { ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

export function mapAuthError(message: string, fallback = "アカウント処理に失敗しました") {
  if (/already|exists|registered|duplicate/i.test(message)) {
    return "このメールアドレスは既に登録されています";
  }
  if (/password/i.test(message) && /weak|least|character/i.test(message)) {
    return "パスワードは8文字以上にしてください";
  }
  if (/rate limit|too many/i.test(message)) {
    return "操作が集中しています。しばらくしてから再度お試しください";
  }
  if (/invalid.*(login|credentials)|invalid email or password/i.test(message)) {
    return "メールアドレスまたはパスワードが正しくありません";
  }
  if (/banned|disabled/i.test(message)) {
    return "このアカウントは現在ご利用いただけません";
  }
  return message || fallback;
}

export async function findAuthUserByEmail(email: string) {
  const sb = supabaseAdmin();
  const normalized = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new ApiError(mapAuthError(error.message), 500);
    const found = data?.users?.find((u) => u.email?.toLowerCase() === normalized);
    if (found) return found;
    if (!data?.users?.length) break;
  }
  return null;
}

/** 確認メールを送らず、未確認なら確定する。既に確定済みなら何もしない。 */
export async function confirmEmailWithoutMail(userId: string) {
  const sb = supabaseAdmin();
  const { data, error } = await sb.auth.admin.getUserById(userId);
  if (error) throw new ApiError(mapAuthError(error.message), 500);
  if (data.user?.email_confirmed_at) return;
  const { error: updateError } = await sb.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });
  if (updateError) throw new ApiError(mapAuthError(updateError.message), 500);
}

export async function acceptInvitation(opts: {
  token: string;
  userId: string;
  email: string;
}) {
  const sb = supabaseAdmin();
  const { data: invite, error } = await sb
    .from("invitations")
    .select("id, org_id, email, role, accepted_at, expires_at")
    .eq("token", opts.token)
    .maybeSingle();

  if (error) throw new ApiError(error.message, 500);
  if (!invite) throw new ApiError("招待リンクが無効です");
  if (invite.accepted_at) throw new ApiError("この招待はすでに使用されています");
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    throw new ApiError("招待の有効期限が切れています");
  }
  if (invite.email.trim().toLowerCase() !== opts.email.trim().toLowerCase()) {
    throw new ApiError("招待されたメールアドレスで登録してください");
  }

  const { error: memError } = await sb.from("memberships").upsert(
    { org_id: invite.org_id, user_id: opts.userId, role: invite.role },
    { onConflict: "org_id,user_id" },
  );
  if (memError) throw new ApiError(memError.message, 500);

  await sb
    .from("invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  await sb.from("profiles").upsert(
    { id: opts.userId, email: opts.email },
    { onConflict: "id" },
  );

  return { orgId: invite.org_id as string };
}

/**
 * Auth ユーザーを削除する。単独オーナーの組織はまとめて削除し、
 * 孤立データとアバターファイルを残さない。
 */
export async function deleteUserAccount(userId: string) {
  const sb = supabaseAdmin();

  const { data: memberships, error: memErr } = await sb
    .from("memberships")
    .select("org_id, role")
    .eq("user_id", userId);
  if (memErr) throw new ApiError(memErr.message, 500);

  for (const row of memberships ?? []) {
    if (row.role !== "owner") continue;
    const { count } = await sb
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("org_id", row.org_id)
      .eq("role", "owner");
    if ((count ?? 0) <= 1) {
      const { error } = await sb.from("organizations").delete().eq("id", row.org_id);
      if (error) throw new ApiError(error.message, 500);
    }
  }

  await removeAvatarFolder(userId);

  const { error } = await sb.auth.admin.deleteUser(userId);
  if (error) throw new ApiError(mapAuthError(error.message, "ユーザーの削除に失敗しました"), 500);
}

async function removeAvatarFolder(userId: string) {
  const sb = supabaseAdmin();
  try {
    const { data: files } = await sb.storage.from("avatars").list(userId, { limit: 100 });
    if (!files?.length) return;
    await sb.storage.from("avatars").remove(files.map((f) => `${userId}/${f.name}`));
  } catch {
    // バケット未作成でも削除自体は続行する
  }
}
