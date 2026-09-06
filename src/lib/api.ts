import { NextResponse } from "next/server";
import { getOrgContext, type OrgContext } from "@/lib/supabase/server";

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** 認証済みの組織コンテキストを取得する。未認証なら 401 を投げる。 */
export async function requireOrg(): Promise<OrgContext> {
  const ctx = await getOrgContext();
  if (!ctx) throw new ApiError("認証が必要です", 401);
  return ctx;
}

const ROLE_RANK: Record<string, number> = {
  viewer: 0,
  editor: 1,
  legal: 2,
  brand: 2,
  approver: 3,
  admin: 4,
  owner: 5,
};

export function requireRole(ctx: OrgContext, minimum: string) {
  if ((ROLE_RANK[ctx.role] ?? 0) < (ROLE_RANK[minimum] ?? 0)) {
    throw new ApiError("この操作を行う権限がありません", 403);
  }
}

export function requireSubject(ctx: OrgContext): string {
  if (!ctx.subjectId) throw new ApiError("広報対象が登録されていません", 400);
  return ctx.subjectId;
}

/** ルートハンドラの共通エラー整形。 */
export async function handle<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    const data = await fn();
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** cronエンドポイントの認可 (Vercel Cron または CRON_SECRET)。 */
export function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth === `Bearer ${secret}`) return true;
  // Vercel Cron からの呼び出し
  if (request.headers.get("x-vercel-cron")) return true;
  return false;
}
