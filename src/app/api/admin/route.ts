import { handle, requirePlatformAdmin, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { listAllUsers, summarizeUsers, syncPaymentsFromStripe, getPaymentSummary } from "@/lib/admin";

export const runtime = "nodejs";
export const maxDuration = 120;

/** 運営管理者のみが利用できる操作 */
export async function POST(request: Request) {
  return handle(async () => {
    const admin = await requirePlatformAdmin();
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const sb = supabaseAdmin();

    switch (action) {
      case "list_users": {
        const rows = await listAllUsers();
        return { rows, summary: summarizeUsers(rows) };
      }

      // Stripeから最新の支払いを取り込んでから集計を返す
      case "refresh_payments": {
        const sync = await syncPaymentsFromStripe(Number(body.limit ?? 100));
        const summary = await getPaymentSummary(200);
        return { ...summary, sync };
      }

      case "payments": {
        return getPaymentSummary(Number(body.limit ?? 200));
      }

      // 運営管理者権限の付与・剥奪
      case "set_platform_admin": {
        const userId = String(body.userId ?? "");
        const value = Boolean(body.value);
        if (!userId) throw new ApiError("userId が必要です");
        if (userId === admin.userId && !value) {
          throw new ApiError("自分自身の管理者権限は解除できません");
        }
        const { error } = await sb
          .from("profiles")
          .update({ is_platform_admin: value })
          .eq("id", userId);
        if (error) throw new ApiError(error.message, 500);
        return { ok: true };
      }

      // 利用停止 / 再開 (Supabase Auth の ban 機能)
      case "set_user_banned": {
        const userId = String(body.userId ?? "");
        const banned = Boolean(body.banned);
        if (!userId) throw new ApiError("userId が必要です");
        if (userId === admin.userId) throw new ApiError("自分自身は停止できません");

        const { error } = await sb.auth.admin.updateUserById(userId, {
          ban_duration: banned ? "876000h" : "none",
        });
        if (error) throw new ApiError(error.message, 500);
        return { ok: true, banned };
      }

      // ユーザーの詳細 (組織・広報対象・直近の活動)
      case "user_detail": {
        const userId = String(body.userId ?? "");
        if (!userId) throw new ApiError("userId が必要です");

        const { data: profile } = await sb
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        if (!profile) throw new ApiError("ユーザーが見つかりません", 404);

        const { data: membership } = await sb
          .from("memberships")
          .select("org_id, role, organizations(name, industry, website, onboarded_at, created_at)")
          .eq("user_id", userId)
          .maybeSingle();

        const orgId = membership?.org_id ?? null;

        const [subjects, subscription, payments, runs] = await Promise.all([
          orgId
            ? sb.from("subjects").select("id,name,type,active,created_at").eq("org_id", orgId)
            : Promise.resolve({ data: [] }),
          orgId
            ? sb.from("subscriptions").select("*").eq("org_id", orgId).maybeSingle()
            : Promise.resolve({ data: null }),
          orgId
            ? sb
                .from("payments")
                .select("amount,currency,status,paid_at,description,receipt_url")
                .eq("org_id", orgId)
                .order("paid_at", { ascending: false })
                .limit(20)
            : Promise.resolve({ data: [] }),
          orgId
            ? sb
                .from("ai_runs")
                .select("agent,task,model,cost_usd,ok,created_at")
                .eq("org_id", orgId)
                .order("created_at", { ascending: false })
                .limit(15)
            : Promise.resolve({ data: [] }),
        ]);

        const { data: authUser } = await sb.auth.admin.getUserById(userId);

        return {
          profile,
          membership,
          subjects: subjects.data ?? [],
          subscription: subscription.data ?? null,
          payments: payments.data ?? [],
          runs: runs.data ?? [],
          auth: authUser?.user
            ? {
                last_sign_in_at: authUser.user.last_sign_in_at,
                email_confirmed_at: authUser.user.email_confirmed_at,
                banned_until:
                  (authUser.user as unknown as { banned_until?: string }).banned_until ?? null,
                created_at: authUser.user.created_at,
              }
            : null,
        };
      }

      default:
        throw new ApiError(`不明なアクション: ${action}`);
    }
  });
}
