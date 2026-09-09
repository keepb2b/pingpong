import { ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { KARTE_SECTIONS } from "@/lib/constants";

const AVATAR_BUCKET = "avatars";
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);

export type ProvisionInput = {
  userId: string;
  email: string | null;
  displayName: string;
  orgName: string;
  website?: string | null;
  subjectName?: string | null;
  subjectType?: string | null;
  industry?: string | null;
  avatarUrl?: string | null;
};

/** 新規ユーザーの組織・広報対象・プロフィールを service role で一括作成する。 */
export async function provisionOwnerOrg(input: ProvisionInput) {
  const sb = supabaseAdmin();

  const { data: existing } = await sb
    .from("memberships")
    .select("org_id")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (existing) {
    if (input.avatarUrl) {
      await sb.from("profiles").update({ avatar_url: input.avatarUrl }).eq("id", input.userId);
    }
    return { orgId: existing.org_id as string, existed: true as const };
  }

  const { data: org, error } = await sb
    .from("organizations")
    .insert({
      name: input.orgName || "新しい会社",
      industry: input.industry ?? null,
      website: input.website ?? null,
    })
    .select("id")
    .single();

  if (error || !org) throw new ApiError(error?.message ?? "組織の作成に失敗しました", 500);

  await sb.from("memberships").insert({
    org_id: org.id,
    user_id: input.userId,
    role: "owner",
  });

  await sb.from("profiles").upsert(
    {
      id: input.userId,
      email: input.email,
      display_name: input.displayName || input.email,
      avatar_url: input.avatarUrl ?? null,
      company_name: input.orgName || null,
    },
    { onConflict: "id" },
  );

  await sb.from("subscriptions").insert({ org_id: org.id, status: "none" });

  const { data: subject } = await sb
    .from("subjects")
    .insert({
      org_id: org.id,
      name: input.subjectName || input.orgName || "自社",
      type: input.subjectType || "company",
      website: input.website ?? null,
      is_primary: true,
    })
    .select("id")
    .single();

  if (subject) await scaffoldSubject(org.id, subject.id);

  return { orgId: org.id as string, subjectId: subject?.id as string | undefined, existed: false as const };
}

export async function scaffoldSubject(orgId: string, subjectId: string) {
  const sb = supabaseAdmin();

  await sb.from("karte_sections").upsert(
    KARTE_SECTIONS.map((s) => ({
      org_id: orgId,
      subject_id: subjectId,
      key: s.key,
      label: s.label,
      content: null,
      confidence: 0,
      source: "user",
    })),
    { onConflict: "subject_id,key" },
  );

  await sb.from("brand_voice").upsert(
    { org_id: orgId, subject_id: subjectId, emoji_policy: "minimal" },
    { onConflict: "subject_id" },
  );

  await sb.from("dialogue_settings").upsert(
    { org_id: orgId, subject_id: subjectId, frequency: "daily", send_hour: 9 },
    { onConflict: "subject_id" },
  );

  for (const type of ["x", "instagram", "facebook", "gbp", "wordpress"]) {
    await sb.from("channels").upsert(
      { org_id: orgId, subject_id: subjectId, type, frequency_mode: "ai_auto" },
      { onConflict: "subject_id,type" },
    );
  }

  await sb.from("approval_rules").insert({
    org_id: orgId,
    subject_id: subjectId,
    min_risk: "none",
    required_roles: ["approver"],
    auto_approve: false,
  });
}

function extensionOf(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^(png|jpe?g|webp|gif)$/.test(fromName)) return fromName === "jpeg" ? "jpg" : fromName;
  if (file.type.includes("png")) return "png";
  if (file.type.includes("webp")) return "webp";
  if (file.type.includes("gif")) return "gif";
  return "jpg";
}

/** service role でアバターを保存する。Storage RLS を通らない。 */
export async function saveAvatarForUser(userId: string, file: File): Promise<string> {
  if (file.size > AVATAR_MAX_BYTES) {
    throw new ApiError("画像は5MB以下にしてください");
  }
  const type = (file.type || "").toLowerCase();
  if (type && !AVATAR_TYPES.has(type) && !type.startsWith("image/")) {
    throw new ApiError("対応していない画像形式です（PNG / JPEG / WebP / GIF）");
  }

  const sb = supabaseAdmin();
  await ensureAvatarsBucket();

  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionOf(file)}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await sb.storage.from(AVATAR_BUCKET).upload(path, buffer, {
    contentType: file.type || "image/jpeg",
    upsert: true,
    cacheControl: "3600",
  });
  if (error) {
    throw new ApiError(
      error.message.includes("Bucket not found")
        ? "アバター用のストレージ(avatars)が未作成です。supabase/schema.sql を適用してください。"
        : `画像のアップロードに失敗しました: ${error.message}`,
      500,
    );
  }

  const {
    data: { publicUrl },
  } = sb.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return publicUrl;
}

export async function ensureAvatarsBucket() {
  const sb = supabaseAdmin();
  const { data, error } = await sb.storage.getBucket(AVATAR_BUCKET);
  if (data && !error) {
    if (!data.public) {
      await sb.storage.updateBucket(AVATAR_BUCKET, { public: true });
    }
    return;
  }
  const created = await sb.storage.createBucket(AVATAR_BUCKET, {
    public: true,
    fileSizeLimit: AVATAR_MAX_BYTES,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  });
  if (created.error && !/already exists/i.test(created.error.message)) {
    throw new ApiError(`ストレージの準備に失敗しました: ${created.error.message}`, 500);
  }
}
