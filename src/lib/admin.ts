import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe, isStripeConfigured } from "@/lib/stripe";

export type AdminUserRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  company_name: string | null;
  phone: string | null;
  is_platform_admin: boolean;
  last_seen_at: string | null;
  registered_at: string;
  org_role: string | null;
  org_id: string | null;
  org_name: string | null;
  industry: string | null;
  onboarded_at: string | null;
  plan_status: string | null;
  setup_fee_paid: boolean | null;
  extra_subjects: number | null;
  current_period_end: string | null;
  subject_count: number;
  content_count: number;
  published_count: number;
  revenue_total: number;
};

/** 全ユーザーの横断情報。service role で読むためRLSを迂回する。 */
export async function listAllUsers(): Promise<AdminUserRow[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("admin_user_overview")
    .select("*")
    .order("registered_at", { ascending: false });

  if (error) throw new Error(`ユーザー一覧の取得に失敗しました: ${error.message}`);
  return (data ?? []) as AdminUserRow[];
}

export type UserStatusSummary = {
  total: number;
  active: number;
  trialing: number;
  pastDue: number;
  canceled: number;
  unpaid: number;
  noPlan: number;
  onboarded: number;
  notOnboarded: number;
  activeLast7d: number;
  activeLast30d: number;
  dormant: number;
  admins: number;
  signupsByMonth: Array<{ x: string; y: number }>;
  planBreakdown: Array<{ label: string; value: number }>;
  activityBreakdown: Array<{ label: string; value: number }>;
};

const PLAN_LABEL: Record<string, string> = {
  active: "利用中",
  trialing: "トライアル",
  past_due: "支払い確認中",
  canceled: "解約済み",
  incomplete: "手続き未完了",
  unpaid: "未払い",
  none: "未契約",
};

/** ユーザーの状態を集計してグラフ用データに整える。 */
export function summarizeUsers(rows: AdminUserRow[]): UserStatusSummary {
  const now = Date.now();
  const day = 864e5;

  const count = (fn: (r: AdminUserRow) => boolean) => rows.filter(fn).length;
  const status = (r: AdminUserRow) => r.plan_status ?? "none";

  const seenWithin = (r: AdminUserRow, days: number) =>
    Boolean(r.last_seen_at) && now - new Date(r.last_seen_at!).getTime() <= days * day;

  // 登録月ごとの推移 (直近12か月)
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now - 0);
    d.setMonth(d.getMonth() - i);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const byMonth = new Map(months.map((m) => [m, 0]));
  for (const r of rows) {
    const key = String(r.registered_at ?? "").slice(0, 7);
    if (byMonth.has(key)) byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }

  const planCounts = new Map<string, number>();
  for (const r of rows) {
    const s = status(r);
    planCounts.set(s, (planCounts.get(s) ?? 0) + 1);
  }

  const activeLast7d = count((r) => seenWithin(r, 7));
  const activeLast30d = count((r) => seenWithin(r, 30));

  return {
    total: rows.length,
    active: count((r) => status(r) === "active"),
    trialing: count((r) => status(r) === "trialing"),
    pastDue: count((r) => status(r) === "past_due"),
    canceled: count((r) => status(r) === "canceled"),
    unpaid: count((r) => status(r) === "unpaid"),
    noPlan: count((r) => status(r) === "none" || !r.plan_status),
    onboarded: count((r) => Boolean(r.onboarded_at)),
    notOnboarded: count((r) => !r.onboarded_at),
    activeLast7d,
    activeLast30d,
    dormant: rows.length - activeLast30d,
    admins: count((r) => r.is_platform_admin),
    signupsByMonth: months.map((m) => ({ x: m.slice(5) + "月", y: byMonth.get(m) ?? 0 })),
    planBreakdown: [...planCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ label: PLAN_LABEL[k] ?? k, value: v })),
    activityBreakdown: [
      { label: "7日以内", value: activeLast7d },
      { label: "8〜30日", value: Math.max(0, activeLast30d - activeLast7d) },
      { label: "31日以上", value: Math.max(0, rows.length - activeLast30d) },
    ],
  };
}

export type PaymentRow = {
  id: string;
  org_id: string | null;
  org_name?: string | null;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  receipt_url: string | null;
  paid_at: string | null;
  stripe_customer_id: string | null;
};

/**
 * Stripeから支払いを取得して payments に取り込む。
 * Stripeが未設定の場合は取り込みを行わず、DBに残っている履歴だけを返す。
 */
export async function syncPaymentsFromStripe(limit = 100): Promise<{
  imported: number;
  source: "stripe" | "database";
  note?: string;
}> {
  if (!isStripeConfigured()) {
    return {
      imported: 0,
      source: "database",
      note: "STRIPE_SECRET_KEY が未設定のため、保存済みの履歴のみ表示しています。",
    };
  }

  const sb = supabaseAdmin();
  const client = stripe();

  // 顧客ID → 組織ID の対応表
  const { data: subs } = await sb
    .from("subscriptions")
    .select("org_id, stripe_customer_id")
    .not("stripe_customer_id", "is", null);

  const orgByCustomer = new Map<string, string>();
  for (const s of subs ?? []) {
    if (s.stripe_customer_id) orgByCustomer.set(s.stripe_customer_id, s.org_id);
  }

  const charges = await client.charges.list({ limit: Math.min(limit, 100) });

  let imported = 0;
  for (const c of charges.data) {
    const customerId = typeof c.customer === "string" ? c.customer : (c.customer?.id ?? null);
    const row = {
      org_id: customerId ? (orgByCustomer.get(customerId) ?? null) : null,
      stripe_payment_intent_id:
        typeof c.payment_intent === "string" ? c.payment_intent : (c.payment_intent?.id ?? c.id),
      stripe_invoice_id: typeof c.invoice === "string" ? c.invoice : (c.invoice?.id ?? null),
      stripe_customer_id: customerId,
      amount: c.amount,
      currency: c.currency,
      status: c.refunded ? "refunded" : c.status,
      description: c.description ?? null,
      receipt_url: c.receipt_url ?? null,
      paid_at: new Date(c.created * 1000).toISOString(),
    };

    const { error } = await sb
      .from("payments")
      .upsert(row, { onConflict: "stripe_payment_intent_id" });
    if (!error) imported++;
  }

  return { imported, source: "stripe" };
}

export type PaymentSummary = {
  rows: PaymentRow[];
  grossTotal: number;
  succeededTotal: number;
  refundedTotal: number;
  count: number;
  currency: string;
  byMonth: Array<{ x: string; y: number }>;
  byStatus: Array<{ label: string; value: number }>;
  topOrgs: Array<{ label: string; value: number }>;
};

const yen = (n: number) => n; // JPYはゼロ小数通貨。Stripeの最小単位＝円

/** 決済履歴の取得と集計。 */
export async function getPaymentSummary(limit = 200): Promise<PaymentSummary> {
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from("payments")
    .select("*, organizations(name)")
    .order("paid_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`決済履歴の取得に失敗しました: ${error.message}`);

  const rows: PaymentRow[] = (data ?? []).map((p) => {
    const org = p.organizations as unknown as { name: string } | null;
    return {
      id: p.id,
      org_id: p.org_id,
      org_name: org?.name ?? null,
      amount: yen(p.amount ?? 0),
      currency: p.currency ?? "jpy",
      status: p.status ?? "succeeded",
      description: p.description,
      receipt_url: p.receipt_url,
      paid_at: p.paid_at,
      stripe_customer_id: p.stripe_customer_id,
    };
  });

  const succeeded = rows.filter((r) => r.status === "succeeded");
  const refunded = rows.filter((r) => r.status === "refunded");

  // 月次の売上推移 (直近12か月)
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const byMonth = new Map(months.map((m) => [m, 0]));
  for (const r of succeeded) {
    const key = String(r.paid_at ?? "").slice(0, 7);
    if (byMonth.has(key)) byMonth.set(key, (byMonth.get(key) ?? 0) + r.amount);
  }

  const statusCounts = new Map<string, number>();
  for (const r of rows) statusCounts.set(r.status, (statusCounts.get(r.status) ?? 0) + 1);

  const orgTotals = new Map<string, number>();
  for (const r of succeeded) {
    const key = r.org_name ?? "(未紐づけ)";
    orgTotals.set(key, (orgTotals.get(key) ?? 0) + r.amount);
  }

  const STATUS_LABEL: Record<string, string> = {
    succeeded: "成功",
    refunded: "返金",
    pending: "処理中",
    failed: "失敗",
  };

  return {
    rows,
    grossTotal: rows.reduce((a, r) => a + r.amount, 0),
    succeededTotal: succeeded.reduce((a, r) => a + r.amount, 0),
    refundedTotal: refunded.reduce((a, r) => a + r.amount, 0),
    count: rows.length,
    currency: rows[0]?.currency ?? "jpy",
    byMonth: months.map((m) => ({ x: m.slice(5) + "月", y: byMonth.get(m) ?? 0 })),
    byStatus: [...statusCounts.entries()].map(([k, v]) => ({
      label: STATUS_LABEL[k] ?? k,
      value: v,
    })),
    topOrgs: [...orgTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value })),
  };
}
