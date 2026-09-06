import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_MAP: Record<string, string> = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  canceled: "canceled",
  incomplete: "incomplete",
  incomplete_expired: "incomplete",
  unpaid: "unpaid",
  paused: "canceled",
};

export async function POST(request: Request) {
  if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "stripe not configured" }, { status: 503 });
  }

  const raw = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json(
      { error: `signature verification failed: ${err instanceof Error ? err.message : ""}` },
      { status: 400 },
    );
  }

  const sb = supabaseAdmin();

  // 冪等性: 同じイベントを二重処理しない
  const { error: dupe } = await sb
    .from("billing_events")
    .insert({ stripe_event_id: event.id, type: event.type, payload: event.data.object as object });

  if (dupe && dupe.code === "23505") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.org_id;
        if (!orgId) break;

        await sb
          .from("subscriptions")
          .upsert(
            {
              org_id: orgId,
              stripe_customer_id: String(session.customer ?? ""),
              stripe_subscription_id: session.subscription ? String(session.subscription) : null,
              status: "active",
              setup_fee_paid: true,
              extra_subjects: Number(session.metadata?.extra_subjects ?? 0),
            },
            { onConflict: "org_id" },
          );

        await sb.from("billing_events").update({ org_id: orgId }).eq("stripe_event_id", event.id);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const orgId = sub.metadata?.org_id ?? (await orgByCustomer(String(sub.customer)));
        if (!orgId) break;

        const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;

        await sb.from("subscriptions").upsert(
          {
            org_id: orgId,
            stripe_customer_id: String(sub.customer),
            stripe_subscription_id: sub.id,
            status:
              event.type === "customer.subscription.deleted"
                ? "canceled"
                : (STATUS_MAP[sub.status] ?? "none"),
            cancel_at_period_end: sub.cancel_at_period_end ?? false,
            current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            extra_subjects: Number(sub.metadata?.extra_subjects ?? 0),
          },
          { onConflict: "org_id" },
        );

        await sb.from("billing_events").update({ org_id: orgId }).eq("stripe_event_id", event.id);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const orgId = await orgByCustomer(String(invoice.customer));
        if (!orgId) break;

        await sb.from("subscriptions").update({ status: "past_due" }).eq("org_id", orgId);
        await sb.from("notifications").insert({
          org_id: orgId,
          kind: "billing",
          title: "お支払いが確認できませんでした",
          body: "お支払い方法をご確認ください。広報活動は一時的に制限される場合があります。",
          link: "/dashboard/billing",
        });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const orgId = await orgByCustomer(String(invoice.customer));
        if (!orgId) break;
        await sb.from("subscriptions").update({ status: "active" }).eq("org_id", orgId);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("[stripe webhook]", err);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function orgByCustomer(customerId: string): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from("subscriptions")
    .select("org_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.org_id ?? null;
}
