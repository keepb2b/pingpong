# AI広報 — 成果を出すAI広報部

LINEで一言送るだけ。6人の専門AIがチームとなって、企業・サービス・商品・ブランド・店舗・個人の
広報活動を、情報収集から戦略立案・制作・投稿・効果分析・改善まで継続的に実行するプラットフォームです。

**Next.js 15 (App Router) + Supabase + OpenRouter + Stripe + LINE Messaging API**

---

## 1. 起動までの手順

### 前提

- Node.js 20 以上
- Supabase プロジェクト（このリポジトリの `.env.local` に設定済み）

### ① データベースのスキーマを適用する

**これを最初に行ってください。** Supabase の anon / service キーでは DDL を実行できないため、
次のどちらかの方法で適用します。

**方法A — SQL エディタに貼り付ける（最短）**

1. Supabase ダッシュボード → SQL Editor
2. [`supabase/schema.sql`](supabase/schema.sql) の中身をすべて貼り付けて実行

**方法B — スクリプトで流し込む**

1. Supabase ダッシュボード → Project Settings → Database → Connection string (URI) をコピー
2. `.env.local` の `DATABASE_URL=` に貼り付け
3. 実行:

```bash
npm run db:push
```

適用されるもの: 45 テーブル / 20 の列挙型 / RLS ポリシー / ストレージバケット /
成果貢献度の集計関数（`attribution_summary`）。

### ② デモデータを入れる（任意・推奨）

すべての画面に実データが入った状態で確認できます。

```bash
npm run db:seed -- demo@example.com "Passw0rd-demo"
```

### ③ 開発サーバー

```bash
npm install
npm run dev
```

`http://localhost:3000` を開きます。②を実行した場合は、そのメールアドレスでログインできます。

---

## 2. 外部サービスの接続

`.env.local` に値を入れるだけで、対応する機能が有効になります。
**未設定でもアプリは動作します**（AIは構成のみを返し、投稿は「未連携」として記録されます）。

### OpenRouter（6人の専門AI）

```
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=mistralai/mistral-small-24b-instruct-2501  # 制作・戦略・検査
OPENROUTER_MODEL_FAST=mistralai/mistral-nemo                # 短い判断・要約
OPENROUTER_SITE_NAME=AI Koho   # X-Title ヘッダに載るためASCIIのみ
```

未設定の場合、各エージェントは決定的なフォールバック（定型のヒアリング質問、
構成のみの下書き、機械チェックによるファクトチェック）で動作を継続します。

#### モデル選定（2026-09 実測）

テスト期間中の費用を抑えるため、OpenRouter の全431モデルから
「`response_format`(JSON)対応 / 日本語の敬体が正しい / 公式事実の数値を歪めない」を
満たす最安の組み合わせを実測で選んでいます。1リクエスト = 入力3,000 + 出力1,000トークン換算。

| モデル | $/1,000リクエスト | 実測所感 |
|---|---:|---|
| **mistral-small-24b-instruct-2501**（既定） | **0.23** | 172ms。事実を歪めず、ブランドトーンも安定 |
| **mistral-nemo**（高速用） | **0.09** | 最安。短文なら十分。長文はトーンが揺れる |
| google/gemini-2.5-flash-lite | 0.70 | 日本語の敬体が最も自然。品質重視ならこれ |
| anthropic/claude-sonnet-4.5（変更前） | 24.00 | — |

既定構成は変更前の約 **1/104** の費用です。品質を上げたくなったら
`OPENROUTER_MODEL` を `google/gemini-2.5-flash-lite` か
`anthropic/claude-sonnet-4.5` に差し替えるだけで切り替わります。

**採用しなかったもの**（実測で不合格）:

- 無料枠（`:free`）— `429 rate-limited` が頻発、または JSON が壊れる。LINEの応答には使えません。
- 推論型の格安モデル（`qwen/qwen3.7-flash`、`deepseek-v4-flash`）— 思考だけで
  `max_tokens` を使い切り、本文が空のまま HTTP 200 を返します。
  この失敗は握りつぶさず `ai_runs` にエラーとして記録されます。
- `ibm-granite/granite-4.0-h-micro` — 「1日あたり2時間**の**削減」を
  「2時間**に**削減」と書き換えました。公式事実を歪めるため不採用。

実際にかかった費用は管理画面ではなく `ai_runs` テーブルに1回ごとに記録されます
（`cost_usd`, `prompt_tokens`, `completion_tokens`, `model`）。

### LINE Messaging API（AI広報部の窓口）

1. [LINE Developers](https://developers.line.biz/) で Messaging API チャネルを作成
2. Webhook URL に `https://<あなたのドメイン>/api/line/webhook` を設定し、Webhook を ON
3. 応答メッセージを OFF
4. 環境変数を設定:

```
LINE_CHANNEL_SECRET=...
LINE_CHANNEL_ACCESS_TOKEN=...
```

5. 管理画面「設定・連携 → LINE連携」で連携コードを発行し、トークに送信

### Stripe（決済）

```
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
```

Price ID は任意です。未設定の場合は `price_data` で都度生成するため、
Stripe 側に商品を作らなくてもそのまま決済できます。

- 初期費用 99,800円（初回のみ）
- 月額 39,800円／月（広報対象1件を含む）
- 追加広報対象 9,800円／月・1件

Webhook のエンドポイント: `https://<ドメイン>/api/stripe/webhook`
（`checkout.session.completed` / `customer.subscription.*` / `invoice.*`）

### 各媒体への投稿

管理画面「設定・連携 → 媒体と投稿頻度」から、媒体ごとに認証情報を登録します。
X / Facebook / Instagram / Googleビジネスプロフィール / WordPress に対応しています。

---

## 3. Vercelへのデプロイ

`.env.local` は `.gitignore` に含まれるためリポジトリに入りません。
**Vercel 側で環境変数を設定しないと、Supabaseに接続できず画面が表示されません。**

Vercel → Project → Settings → Environment Variables に、最低限この3つを追加します
（Production / Preview / Development すべてにチェック）。

| 変数名 | 必須 | 未設定だとどうなるか |
|---|:---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ログイン・管理画面が表示できない |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | 同上 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | AI処理・LINE・cronが動かない |
| `OPENROUTER_API_KEY` | | AIは定型のフォールバックで動作 |
| `OPENROUTER_MODEL` / `..._FAST` | | 既定の最安モデルが使われる |
| `CRON_SECRET` | | cronエンドポイントが401のまま |
| `NEXT_PUBLIC_APP_URL` | | 専用リンクがlocalhostを指す |
| `LINE_CHANNEL_SECRET` / `..._ACCESS_TOKEN` | | LINE連携が無効 |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | | 決済が無効 |

> `NEXT_PUBLIC_` で始まる変数は**ビルド時に埋め込まれます**。
> 追加したあとは必ず **Redeploy** してください（変数を足すだけでは反映されません）。

`NEXT_PUBLIC_APP_URL` は本番URL（例 `https://your-app.vercel.app`）に変更します。
ここがlocalhostのままだと、計測用の専用リンクとLINEの通知リンクが機能しません。

### ミドルウェアについて

ミドルウェアはほぼ全リクエストを通るため、ここで例外を投げると
**サイト全体が 500 `MIDDLEWARE_INVOCATION_FAILED` になります。**
そのため環境変数が未設定でも素通しし、認証はレイアウト・ページ・APIルート側で
必ず検証する構成にしています（多層防御）。設定漏れはVercelのログに
`[middleware] ... が未設定です` として出ます。

## 4. 定期実行（cron）

`vercel.json` に設定済みです。Vercel 以外にデプロイする場合は、
`Authorization: Bearer $CRON_SECRET` を付けて次を叩いてください。

| ジョブ | 推奨間隔 | 内容 |
|---|---|---|
| `/api/cron/publish` | 10分ごと | 予約時刻を過ぎた投稿を配信 |
| `/api/cron/interview` | 毎時 | 対話頻度の設定に従いAI秘書がヒアリング |
| `/api/cron/daily` | 毎日 | 本日の発信可否を判断 → 制作 → 検査 → 承認依頼 |
| `/api/cron/monitor` | 毎日 | 競合サイト・季節イベントの変化を検知 |
| `/api/cron/monthly` | 毎月1日 | AI広報スコア算出 + 月次AI広報会議 + 翌月戦略 |

---

## 5. 成果の計測

投稿ごとに専用リンク `/t/<code>` が発行され、クリックすると訪問者IDを Cookie に保存して
接触履歴（初回 / 中間 / 最終）を記録します。

自社サイトのフォーム送信時に次を呼ぶと、**どの投稿が成約につながったか**が紐づきます。

```js
fetch("https://<ドメイン>/api/track", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    subject_id: "<広報対象のID>",   // 管理画面「成果分析」に表示されます
    type: "inquiry",                // inquiry / booking / purchase / contract ...
    amount: 480000                  // 成約金額（任意）
  })
});
```

---

## 6. 構成

```
src/
  app/
    page.tsx                     ランディング（サービス紹介・料金）
    login/  signup/  onboarding/ 認証と初期設定ウィザード
    dashboard/                   管理画面（18画面）
      page.tsx                   ホーム: 本日の判断・承認待ち・KPI・スコア
      intake/                    広報材料・AI取材
      strategy/                  広報戦略（目的から逆算）
      content/[id]/              コンテンツ詳細・媒体別・承認・ファクトチェック
      calendar/                  投稿予定
      analytics/                 顧客導線と成果（売上まで）
      score/                     AI広報スコア（10観点）
      reports/                   月次AI広報会議
      mentions/  crisis/  media/ 口コミ・危機広報・メディアリレーション
      monitoring/                競合・市場・トレンド監視
      karte/  facts/  learnings/ AIの理解（カルテ・公式事実・学習内容）
      settings/  billing/        設定・連携 / ご契約
    api/
      line/webhook/              LINE の受信（ヒアリング・承認・コマンド）
      agents/                    6人の専門AIの起動
      setup/ workflow/ reputation/  各ドメインの操作
      stripe/                    checkout / webhook / portal
      cron/[job]/                定期実行
      track/                     成果の受け口
    t/[code]/                    専用リンクの中継（計測）
  lib/
    agents/
      secretary.ts               AI秘書 — ヒアリング（1問ずつ）
      strategist.ts              AIストラテジスト — 戦略・今日の判断
      writer.ts                  AIライター — 記事・投稿・事例・PR
      marketer.ts                AIマーケター — 媒体別最適化・導線・返信案
      analyst.ts                 AIアナリスト — ファクトチェック・スコア・月次
      creator.ts                 AIクリエイター — SVGクリエイティブ生成
      orchestrator.ts            循環全体（制作→検査→承認→配信→計測）
      context.ts                 企業理解のプロンプト組み立て
    scoring.ts                   AI広報スコアの決定的な算出
    monitor.ts                   競合・市場・季節の監視
    publishers.ts                各媒体への実配信
    tracking.ts                  専用リンクと接触履歴
supabase/
  migrations/                    0001 スキーマ / 0002 パイプライン / 0003 RLS
  schema.sql                     上記を結合したもの（SQLエディタ用）
scripts/
  apply-migrations.mjs           npm run db:push
  seed.mjs                       npm run db:seed
```

---

## 7. 設計上の要点

**発信しない判断をする。** AIストラテジストは毎日「今日発信すべきか」を判断し、
発信価値の高い材料がない日は `should_post: false` を返します。その日は情報収集・
過去記事の改善・顧客導線の見直しを代替作業として提示します。

**公式事実データベースが断定の境界。** 本文中の数値は正規表現で抽出され、
公式事実に存在しないものは `未確認の数値` として必ず指摘されます。この機械チェックは
OpenRouter が未設定でも動作し、AIの検査結果と統合されます。重大な問題は `blocked` となり、
承認ボタン自体が無効化されます。

**承認してから投稿。** 初期状態では自動投稿しません。媒体ごとに `auto_publish` と
リスク上限を設定でき、対象媒体すべてが許可かつリスクが上限以下のときだけ承認を省略します。

**危機広報が通常運用に優先する。** 事案を開くと予約投稿が一括停止され、日次サイクルも
配信ジョブも停止を尊重します。復帰には担当者の明示的な承認が必要です。

**成果は売上まで。** 表示・閲覧・CTAクリック・問い合わせ・成約を一本の訪問者IDで結び、
初回接触・中間・最終接触を分けて評価します（`attribution_summary`）。

**AIの記憶はユーザーが管理する。** 学習候補は `pending` で保存され、
「正しい / 修正する / 今回だけ / 長期的に記憶 / 忘れさせる」を選ぶまで本番の判断に使われません。

---

## 8. コマンド

```bash
npm run dev         # 開発サーバー
npm run build       # 本番ビルド
npm run typecheck   # 型チェック
npm run db:push     # スキーマ適用（DATABASE_URL が必要）
npm run db:seed     # デモデータ投入
```
