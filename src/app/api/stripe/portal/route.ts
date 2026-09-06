import { handle, requireOrg, requireRole, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { appUrl } from "@/lib/tracking";

export const runtime = "nodejs";

/** 支払い方法の変更・請求書の確認・解約のためのカスタマーポータル。 */
export async function POST() {
  return handle(async () => {
    const ctx = await requireOrg();
    requireRole(ctx, "admin");

    if (!isStripeConfigured()) throw new ApiError("Stripeが未設定です", 503);

    const { data: sub } = await supabaseAdmin()
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("org_id", ctx.orgId)
      .maybeSingle();

    if (!sub?.stripe_customer_id) throw new ApiError("ご契約情報が見つかりません", 404);

    const session = await stripe().billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: appUrl("/dashboard/billing"),
      locale: "ja",
    });

    return { url: session.url };
  });
}
