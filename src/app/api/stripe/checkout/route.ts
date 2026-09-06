import { handle, requireOrg, requireRole, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe, isStripeConfigured, lineItems } from "@/lib/stripe";
import { appUrl } from "@/lib/tracking";

export const runtime = "nodejs";

/** 初期費用 + 月額 (+ 追加広報対象) の決済セッションを作る。 */
export async function POST(request: Request) {
  return handle(async () => {
    const ctx = await requireOrg();
    requireRole(ctx, "admin");

    if (!isStripeConfigured()) {
      throw new ApiError(
        "Stripeが未設定です。STRIPE_SECRET_KEY を設定してください。",
        503,
      );
    }

    const body = (await request.json().catch(() => ({}))) as { extraSubjects?: number };
    const sb = supabaseAdmin();

    const { data: sub } = await sb
      .from("subscriptions")
      .select("stripe_customer_id, setup_fee_paid, status")
      .eq("org_id", ctx.orgId)
      .maybeSingle();

    if (sub?.status === "active") {
      throw new ApiError("すでに有効なご契約があります。", 409);
    }

    // 追加広報対象は「既存の対象数 - 1(月額に含まれる分)」を既定値とする
    const { count } = await sb
      .from("subjects")
      .select("id", { count: "exact", head: true })
      .eq("org_id", ctx.orgId)
      .eq("active", true);

    const extraSubjects = Math.max(
      0,
      body.extraSubjects ?? Math.max(0, (count ?? 1) - 1),
    );

    const client = stripe();

    let customerId = sub?.stripe_customer_id ?? null;
    if (!customerId) {
      const { data: profile } = await sb
        .from("profiles")
        .select("email, display_name")
        .eq("id", ctx.userId)
        .maybeSingle();

      const customer = await client.customers.create({
        email: profile?.email ?? undefined,
        name: ctx.orgName,
        metadata: { org_id: ctx.orgId },
      });
      customerId = customer.id;

      await sb.from("subscriptions").upsert(
        { org_id: ctx.orgId, stripe_customer_id: customerId, status: "none" },
        { onConflict: "org_id" },
      );
    }

    const session = await client.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      // 初期費用は最初の一度だけ請求する
      line_items: lineItems(extraSubjects, !sub?.setup_fee_paid),
      subscription_data: {
        metadata: { org_id: ctx.orgId, extra_subjects: String(extraSubjects) },
      },
      metadata: { org_id: ctx.orgId, extra_subjects: String(extraSubjects) },
      success_url: appUrl("/dashboard/billing?status=success"),
      cancel_url: appUrl("/dashboard/billing?status=cancelled"),
      allow_promotion_codes: true,
      locale: "ja",
    });

    return { url: session.url };
  });
}
