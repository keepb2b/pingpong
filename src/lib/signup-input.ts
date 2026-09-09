import { ApiError } from "@/lib/api";

export type SignupFields = {
  email: string;
  password: string;
  displayName: string;
  orgName: string;
  website: string | null;
  subjectName: string;
  subjectType: string;
  avatar: File | null;
};

export async function parseSignupRequest(request: Request): Promise<SignupFields> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const avatar = form.get("avatar");
    return normalize({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      displayName: String(form.get("displayName") ?? ""),
      orgName: String(form.get("orgName") ?? ""),
      website: String(form.get("website") ?? ""),
      subjectName: String(form.get("subjectName") ?? ""),
      subjectType: String(form.get("subjectType") ?? "company"),
      avatar: avatar instanceof File && avatar.size > 0 ? avatar : null,
    });
  }

  const body = (await request.json()) as Record<string, unknown>;
  return normalize({
    email: String(body.email ?? ""),
    password: String(body.password ?? ""),
    displayName: String(body.displayName ?? ""),
    orgName: String(body.orgName ?? ""),
    website: String(body.website ?? ""),
    subjectName: String(body.subjectName ?? ""),
    subjectType: String(body.subjectType ?? "company"),
    avatar: null,
  });
}

function normalize(raw: SignupFields): SignupFields {
  const email = raw.email.trim().toLowerCase();
  const displayName = raw.displayName.trim();
  const orgName = raw.orgName.trim();
  const website = raw.website?.trim() || null;
  const subjectName = raw.subjectName.trim() || orgName;
  const password = raw.password;

  if (!email || !password || !displayName) {
    throw new ApiError("必須項目を入力してください");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError("メールアドレスの形式が正しくありません");
  }
  if (password.length < 8) {
    throw new ApiError("パスワードは8文字以上にしてください");
  }

  return {
    email,
    password,
    displayName,
    orgName,
    website,
    subjectName,
    subjectType: raw.subjectType || "company",
    avatar: raw.avatar,
  };
}
