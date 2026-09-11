import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookiesToSet = Parameters<NonNullable<CookieMethodsServer["setAll"]>>[0];

/** 未設定の環境変数を、原因が分かる形で知らせる。 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `環境変数 ${name} が設定されていません。` +
        `Vercel の Project Settings → Environment Variables に追加し、再デプロイしてください。` +
        `(ローカルでは .env.local に記載します)`,
    );
  }
  return value;
}

/** Request-scoped Supabase client that respects the signed-in user + RLS. */
export async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — middleware refreshes the session.
          }
        },
      },
    },
  );
}

export async function getSessionUser() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user;
}

export type OrgContext = {
  userId: string;
  orgId: string;
  role: string;
  orgName: string;
  subjectId: string | null;
};

/** Resolves the caller's organization + active 広報対象. */
export async function getOrgContext(): Promise<OrgContext | null> {
  try {
    const sb = await supabaseServer();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return null;

    const { data: membership } = await sb
      .from("memberships")
      .select("org_id, role, organizations(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!membership) return null;

    const { data: subject } = await sb
      .from("subjects")
      .select("id")
      .eq("org_id", membership.org_id)
      .eq("active", true)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const orgRaw = membership.organizations as unknown;
    const org = Array.isArray(orgRaw)
      ? (orgRaw[0] as { name?: string } | undefined)
      : (orgRaw as { name?: string } | null);

    return {
      userId: user.id,
      orgId: membership.org_id,
      role: membership.role,
      orgName: org?.name ?? "",
      subjectId: subject?.id ?? null,
    };
  } catch (err) {
    console.error("[getOrgContext]", err);
    return null;
  }
}
