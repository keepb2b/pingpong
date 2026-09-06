import Stripe from "stripe";
import { PRICING } from "@/lib/constants";

let cached: Stripe | null = null;

export function stripe(): Stripe {
  if (!cached) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    cached = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  }
  return cached;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * 価格の解決。
 * 環境変数に Price ID があればそれを使い、無ければ price_data で都度生成する。
 * (Stripeダッシュボードで商品を作らずにそのまま動かせるようにするため)
 */
export function lineItems(
  extraSubjects: number,
  includeSetup = true,
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

  const setup = process.env.STRIPE_PRICE_SETUP;
  if (includeSetup) {
    items.push(
      setup
        ? { price: setup, quantity: 1 }
        : {
            quantity: 1,
            price_data: {
              currency: "jpy",
              unit_amount: PRICING.setup,
              product_data: {
                name: "AI広報 初期費用",
                description:
                  "AI初期ヒアリング / AI広報カルテ作成 / 公式事実データ登録 / ターゲット・競合分析 / ブランド人格設定 / 禁止表現・承認ルール設定 / KPI・CV設定 / 媒体連携 / LINE設定 / 頻度設定 / AI初期調整 / テスト制作",
              },
            },
          },
    );
  }

  const monthly = process.env.STRIPE_PRICE_MONTHLY;
  items.push(
    monthly
      ? { price: monthly, quantity: 1 }
      : {
          quantity: 1,
          price_data: {
            currency: "jpy",
            unit_amount: PRICING.monthly,
            recurring: { interval: "month" },
            product_data: {
              name: "AI広報 月額プラン",
              description: "広報対象1件を含む。6人の専門AIによる広報活動一式。",
            },
          },
        },
  );

  if (extraSubjects > 0) {
    const extra = process.env.STRIPE_PRICE_EXTRA_SUBJECT;
    items.push(
      extra
        ? { price: extra, quantity: extraSubjects }
        : {
            quantity: extraSubjects,
            price_data: {
              currency: "jpy",
              unit_amount: PRICING.extraSubject,
              recurring: { interval: "month" },
              product_data: {
                name: "AI広報 追加広報対象",
                description: "企業・サービス・商品・ブランド・店舗・個人を追加します。",
              },
            },
          },
    );
  }

  return items;
}

export function monthlyTotal(extraSubjects: number): number {
  return PRICING.monthly + PRICING.extraSubject * Math.max(0, extraSubjects);
}
