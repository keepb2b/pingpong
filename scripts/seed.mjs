#!/usr/bin/env node
/**
 * Seeds a demo organisation with realistic data so every screen has something
 * to show before LINE / OpenRouter are wired up.
 *
 *   npm run db:seed -- demo@example.com Passw0rd!
 *
 * Requires the schema to be applied first (npm run db:push, or paste
 * supabase/schema.sql into the Supabase SQL editor).
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const file of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(join(root, file), "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // optional
  }
}

const email = process.argv[2] || "demo@ai-koho.local";
const password = process.argv[3] || "AiKoho-Demo-2026";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

/** 途中で終わるときは例外で巻き戻す (process.exit だと接続を閉じる前に落ちる) */
const die = (msg, err) => {
  throw new Error(err ? `${msg}\n  ${err.message ?? err}` : msg);
};

async function main() {
  // ---------------------------------------------------------------- preflight
  {
    const { error } = await sb.from("organizations").select("id").limit(1);
    if (error) {
      die(
        "スキーマが未適用です。先に `npm run db:push` を実行するか、\n  supabase/schema.sql を Supabase の SQL editor に貼り付けて実行してください。",
        error,
      );
    }
  }

  console.log("→ スキーマを確認しました");

  // -------------------------------------------------------------------- user
  let userId;
  {
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: "デモ管理者" },
    });

    if (error && !/already/i.test(error.message)) die("ユーザー作成に失敗しました", error);

    if (data?.user) {
      userId = data.user.id;
    } else {
      const { data: list } = await sb.auth.admin.listUsers({ perPage: 200 });
      userId = list?.users?.find((u) => u.email === email)?.id;
    }
    if (!userId) die("ユーザーIDを取得できませんでした");
  }
  console.log(`→ ユーザー: ${email}`);

  // ---------------------------------------------------------------- org/subject
  const { data: existing } = await sb
    .from("memberships")
    .select("org_id")
    .eq("user_id", userId)
    .maybeSingle();

  let orgId = existing?.org_id;

  if (!orgId) {
    const { data: org, error } = await sb
      .from("organizations")
      .insert({
        name: "株式会社サンプルワークス",
        industry: "宿泊・施設運営支援",
        website: "https://example.com",
        onboarded_at: new Date().toISOString(),
        onboarding_step: 99,
      })
      .select("id")
      .single();
    if (error) die("組織の作成に失敗しました", error);
    orgId = org.id;

    await sb.from("memberships").insert({ org_id: orgId, user_id: userId, role: "owner" });
    await sb.from("subscriptions").insert({ org_id: orgId, status: "active", setup_fee_paid: true });
  }
  await sb
    .from("profiles")
    .upsert({ id: userId, email, display_name: "デモ管理者" }, { onConflict: "id" });

  let { data: subject } = await sb
    .from("subjects")
    .select("id")
    .eq("org_id", orgId)
    .eq("is_primary", true)
    .maybeSingle();

  if (!subject) {
    const { data, error } = await sb
      .from("subjects")
      .insert({
        org_id: orgId,
        name: "ROOMKEY",
        type: "service",
        description: "宿泊施設向けのスマートキー・運営効率化サービス",
        website: "https://example.com/roomkey",
        is_primary: true,
      })
      .select("id")
      .single();
    if (error) die("広報対象の作成に失敗しました", error);
    subject = data;
  }
  const subjectId = subject.id;
  console.log("→ 組織と広報対象を用意しました");

  const base = { org_id: orgId, subject_id: subjectId };

  // ------------------------------------------------------------------- karte
  const KARTE = [
    ["philosophy", "企業理念", "現場の負担を減らし、お客様と向き合う時間を取り戻す。"],
    ["history", "沿革", "2019年創業。宿泊施設向けの運営支援ツールとして提供開始。"],
    ["leader_voice", "代表者の考え", "派手な機能より、毎日確実に使える仕組みを大切にしています。"],
    ["products", "商品・サービス", "スマートキー連携、チェックイン無人化、清掃管理を1つにまとめた運営支援サービス。"],
    ["pricing", "料金・機能", "月額制。客室数に応じたプラン。初期設定サポートを含む。"],
    ["targets", "ターゲット", "10〜80室規模の宿泊施設。人手が足りず、フロント業務の負担が大きい施設。"],
    ["strengths", "強み", "既存の設備を活かして導入できること。現場スタッフが1日で使えるようになる操作性。"],
    ["weaknesses", "弱み", "大規模チェーン向けの複雑な要件には対応していない。"],
    ["cases", "導入事例", "客室数40室の旅館で、チェックイン対応の時間を1日あたり2時間削減。"],
    ["testimonials", "顧客の声", "「スタッフが減っても回るようになった」との評価をいただいています。"],
    ["brand_image", "ブランドイメージ", "誠実、現場目線、大げさに言わない。"],
    ["tone", "文章トーン", "落ち着いた敬体。現場の具体を大切にし、抽象的な言葉を避ける。"],
    ["banned_expressions", "禁止表現", "業界No.1、圧倒的、絶対に、必ず成果が出る"],
    ["disclosable", "公開可能な情報", "導入施設名は許可を得た場合のみ。削減時間などの数値は公式事実に登録済みのもののみ。"],
  ];

  await sb.from("karte_sections").upsert(
    KARTE.map(([key, label, content]) => ({ ...base, key, label, content, source: "user", confidence: 1 })),
    { onConflict: "subject_id,key" },
  );

  await sb.from("brand_voice").upsert(
    {
      ...base,
      persona: "誠実で落ち着いた、現場を知る専門家",
      tone: ["誠実", "落ち着いた", "専門的"],
      first_person: "当社",
      sentence_ending: "です・ます",
      preferred_words: ["現場", "運営", "負担軽減"],
      banned_words: ["業界No.1", "圧倒的", "絶対"],
      banned_expressions: ["必ず成果が出る", "誰でも簡単に儲かる"],
      emoji_policy: "none",
      sample_text: "客室数40室の旅館で、チェックイン対応にかかる時間を1日あたり2時間削減しました。",
    },
    { onConflict: "subject_id" },
  );

  await sb.from("dialogue_settings").upsert(
    { ...base, frequency: "daily", send_hour: 9, max_questions_per_session: 5 },
    { onConflict: "subject_id" },
  );

  console.log("→ AI広報カルテとブランド人格を登録しました");

  // ------------------------------------------------------------- reset & fill
  async function reset(table) {
    await sb.from(table).delete().eq("subject_id", subjectId);
  }
  for (const t of [
    "official_facts",
    "personas",
    "competitors",
    "pr_objectives",
    "kpis",
    "intake_items",
    "market_signals",
    "learnings",
    "mentions",
  ]) {
    await reset(t);
  }

  await sb.from("official_facts").insert([
    { ...base, category: "pricing", key: "月額料金(標準プラン)", value: "39,800円", numeric_value: 39800, unit: "円", status: "confirmed", visibility: "public", source: "料金表 2026年版", verified_at: new Date().toISOString() },
    { ...base, category: "pricing", key: "初期費用", value: "99,800円", numeric_value: 99800, unit: "円", status: "confirmed", visibility: "public", source: "料金表 2026年版", verified_at: new Date().toISOString() },
    { ...base, category: "clients", key: "導入施設数", value: "128施設", numeric_value: 128, unit: "施設", status: "confirmed", visibility: "public", source: "社内集計 2026年8月", verified_at: new Date().toISOString() },
    { ...base, category: "metric", key: "チェックイン対応の削減時間", value: "1日あたり2時間", numeric_value: 2, unit: "時間", status: "confirmed", visibility: "public", source: "導入施設アンケート", verified_at: new Date().toISOString() },
    { ...base, category: "area", key: "対応地域", value: "全国", status: "confirmed", visibility: "public", verified_at: new Date().toISOString() },
    { ...base, category: "other", key: "次期資金調達の予定額", value: "非公開", status: "planned", visibility: "internal", notes: "公開前。発信に含めないこと。" },
  ]);

  await sb.from("personas").insert([
    { ...base, name: "旅館の支配人", segment: "10〜80室の宿泊施設", role: "支配人", pains: ["人手不足", "フロント業務の属人化", "深夜のチェックイン対応"], gains: ["少人数でも回る運営", "スタッフの負担軽減"], channels: ["gbp", "facebook"] },
    { ...base, name: "運営会社の企画担当", segment: "複数施設の運営会社", role: "企画・DX担当", pains: ["施設ごとに運用がばらばら", "導入コストの説明が難しい"], gains: ["標準化", "投資対効果の説明材料"], channels: ["x", "site"] },
  ]);

  await sb.from("competitors").insert([
    { ...base, name: "A社チェックインシステム", website: "https://example.com/competitor-a", positioning: "大規模チェーン向けの高機能型", strengths: ["機能が豊富", "大手の導入実績"], weaknesses: ["導入に数か月かかる", "小規模には過剰"], watch_urls: [] },
  ]);

  await sb.from("pr_objectives").insert([
    { ...base, goal: "inquiry", priority: 1, description: "検討中の施設からの問い合わせを増やす", active: true },
    { ...base, goal: "reputation", priority: 2, description: "導入事例と顧客の声で信頼を積み上げる", active: true },
    { ...base, goal: "seo_aeo", priority: 3, description: "「宿泊施設 チェックイン 無人化」等での検索流入", active: true },
  ]);

  await sb.from("kpis").insert([
    { ...base, name: "月間問い合わせ数", metric: "inquiry", target_value: 15, current_value: 6, unit: "件", period: "month" },
    { ...base, name: "資料請求", metric: "doc_request", target_value: 30, current_value: 11, unit: "件", period: "month" },
    { ...base, name: "記事PV", metric: "pageviews", target_value: 4000, current_value: 1820, unit: "PV", period: "month" },
  ]);

  for (const type of ["x", "instagram", "facebook", "gbp", "wordpress"]) {
    await sb.from("channels").upsert(
      {
        ...base,
        type,
        frequency_mode: type === "x" ? "weekly_n" : "ai_auto",
        frequency_count: type === "x" ? 3 : null,
        connected: false,
        auto_publish: false,
        auto_publish_max_risk: "low",
      },
      { onConflict: "subject_id,type" },
    );
  }

  console.log("→ 公式事実 / ターゲット / 競合 / KPI / 媒体を登録しました");

  // ------------------------------------------------------------ intake & work
  const { data: intake } = await sb
    .from("intake_items")
    .insert([
      { ...base, kind: "new_service", title: "ROOMKEYを新しい施設へ導入することが決まりました", raw_text: "県内の温泉旅館(客室38室)への導入が決定。深夜のチェックイン対応の負担が課題でした。稼働は来月から。", structured: { facts: [{ key: "客室数", value: "38室" }, { key: "稼働時期", value: "来月" }], missing: ["施設名の公開可否"] }, newsworthiness: 82, disclosable: true, status: "new" },
      { ...base, kind: "customer_voice", title: "既存導入先から評価をいただきました", raw_text: "「スタッフが1人減っても回るようになった」と支配人よりコメント。", structured: { facts: [{ key: "コメント", value: "スタッフが1人減っても回るようになった" }] }, newsworthiness: 70, disclosable: true, status: "new" },
      { ...base, kind: "achievement", title: "清掃管理機能の改善をリリース", raw_text: "客室清掃の進捗をスマートフォンから確認できるようになりました。", newsworthiness: 55, disclosable: true, status: "new" },
    ])
    .select("id");

  const { data: proposal } = await sb
    .from("proposals")
    .insert({
      ...base,
      intake_item_id: intake?.[0]?.id ?? null,
      theme: "38室の温泉旅館への導入決定",
      reason: "導入事例は最も問い合わせにつながる材料であり、直近2週間で事例の発信がないため。",
      goal: "inquiry",
      audience: "人手不足に悩む中規模の宿泊施設",
      channels: ["x", "facebook", "gbp"],
      cta: "導入事例の詳細ページへ誘導",
      expected_effect: "検討層の信頼獲得と、資料請求からの問い合わせ増加",
      cautions: "施設名の公開可否が未確認のため、匿名表記で作成すること",
      score: 82,
      status: "proposed",
      scheduled_for: new Date(Date.now() + 864e5).toISOString(),
    })
    .select("id")
    .single();

  const { data: content } = await sb
    .from("content_items")
    .insert({
      ...base,
      proposal_id: proposal?.id ?? null,
      type: "case_study",
      title: "深夜のチェックイン対応をなくす — 38室の温泉旅館での導入",
      summary:
        "客室38室の温泉旅館で、深夜のチェックイン対応の負担を解消するためROOMKEYの導入が決まりました。稼働は来月からを予定しています。",
      body: `## 背景

  宿泊施設では、深夜のチェックイン対応が現場の大きな負担になっています。今回導入が決まった温泉旅館(客室38室)でも、夜間の受付のために人員を配置し続ける必要がありました。

  ## 検討のきっかけ

  支配人の方からは「人を増やすのではなく、仕組みで解決したい」というご相談をいただきました。既存の設備を活かして導入できる点が、検討を進める決め手のひとつとなりました。

  ## 導入内容

  チェックイン無人化と客室清掃の進捗管理を組み合わせ、フロント業務全体の流れを見直します。稼働は来月からを予定しています。

  ## 今後

  稼働後、現場の運用が定着した段階で、あらためて効果を確認しご報告する予定です。`,
      keywords: ["宿泊施設", "チェックイン 無人化", "旅館 人手不足", "スマートキー"],
      cta: "同じ課題をお持ちの施設のご担当者さまは、導入事例の詳細をご覧ください。",
      goal: "inquiry",
      status: "pending_approval",
      risk: "low",
      created_by: "writer",
    })
    .select("id")
    .single();

  const contentId = content?.id;

  if (contentId) {
    await sb.from("content_variants").insert([
      { org_id: orgId, content_id: contentId, channel: "x", body: "深夜のチェックイン対応、人を増やさずに解決できます。\n\n客室38室の温泉旅館で、ROOMKEYの導入が決まりました。既存の設備を活かした構成で、稼働は来月から。", hashtags: ["#宿泊施設", "#人手不足"], cta: "導入事例を読む", char_count: 96, optimized_for: "1行目で課題を提示し、続きを読ませる構成", ab_group: "A" },
      { org_id: orgId, content_id: contentId, channel: "x", body: "「人を増やすのではなく、仕組みで解決したい」\n\n38室の温泉旅館の支配人からのご相談から、ROOMKEYの導入が決まりました。", hashtags: ["#旅館", "#業務改善"], cta: "導入事例を読む", char_count: 78, optimized_for: "A/Bテスト B案 — 顧客の言葉から入る", ab_group: "B" },
      { org_id: orgId, content_id: contentId, channel: "facebook", body: "客室38室の温泉旅館で、ROOMKEYの導入が決まりました。\n\n深夜のチェックイン対応のために人員を配置し続ける必要があり、「人を増やすのではなく、仕組みで解決したい」というご相談から検討が始まりました。既存の設備を活かして導入できる点が、決め手のひとつとなっています。\n\n稼働は来月からを予定しています。運用が定着した段階で、あらためて効果をご報告します。", hashtags: [], cta: "導入事例の詳細はこちら", char_count: 168, optimized_for: "背景と文脈を丁寧に伝える媒体特性に合わせた", ab_group: "A" },
      { org_id: orgId, content_id: contentId, channel: "gbp", body: "宿泊施設の運営支援サービス「ROOMKEY」の導入事例をご紹介します。客室38室の温泉旅館で、深夜のチェックイン対応の負担を解消するための導入が決まりました。全国対応。同様の課題をお持ちの施設さまはお気軽にご相談ください。", hashtags: [], cta: "お問い合わせ", char_count: 108, optimized_for: "地域検索を意識し、サービス名と対応地域を明示", ab_group: "A" },
    ]);

    await sb.from("risk_checks").insert({
      org_id: orgId,
      content_id: contentId,
      overall: "low",
      passed: true,
      blocked: false,
      findings: [
        {
          checkpoint: "個人情報",
          severity: "low",
          quote: "38室の温泉旅館",
          problem: "施設名の公開可否が未確認のため、匿名表記としています。",
          fix: "許可が取れた場合は施設名を明記すると、事例の説得力が高まります。",
        },
      ],
      unverified_claims: [],
      checked_by: "analyst",
    });

    await sb.from("creatives").insert({
      ...base,
      content_id: contentId,
      kind: "sns_image",
      channel: "x",
      width: 1600,
      height: 900,
      prompt: "落ち着いた配色で、現場の課題解決を伝える構成",
      palette: { bg: "#0f1424", accent: "#2a78d6" },
      status: "draft",
    });
  }

  console.log("→ 提案・コンテンツ・媒体別投稿・検査結果を登録しました");

  // -------------------------------------------------------- metrics & results
  const today = new Date();
  const days = Array.from({ length: 24 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (23 - i));
    return d;
  });

  await sb.from("metrics_daily").delete().eq("subject_id", subjectId);
  await sb.from("metrics_daily").insert(
    days.flatMap((d, i) =>
      ["x", "facebook", "gbp", "site"].map((channel) => ({
        ...base,
        channel,
        day: d.toISOString().slice(0, 10),
        impressions: channel === "site" ? 0 : 380 + ((i * 37) % 260),
        reach: channel === "site" ? 0 : 300 + ((i * 29) % 200),
        engagements: channel === "site" ? 0 : 12 + ((i * 7) % 26),
        clicks: 4 + ((i * 3) % 11),
        pageviews: channel === "site" ? 60 + ((i * 11) % 70) : 0,
        search_clicks: channel === "site" ? 14 + ((i * 5) % 22) : 0,
        avg_time_sec: channel === "site" ? 95 + ((i * 13) % 60) : 0,
      })),
    ),
  );

  await sb.from("conversions").delete().eq("subject_id", subjectId);
  const visitors = Array.from({ length: 14 }, (_, i) => `seedvisitor${String(i).padStart(3, "0")}`);
  await sb.from("touchpoints").delete().eq("org_id", orgId);

  const touchRows = [];
  const convRows = [];
  for (const [i, visitorId] of visitors.entries()) {
    const at = new Date(today.getTime() - (i + 1) * 36e5 * 20);
    touchRows.push(
      { org_id: orgId, visitor_id: visitorId, content_id: contentId ?? null, channel: "x", position: "first", occurred_at: at.toISOString() },
      { org_id: orgId, visitor_id: visitorId, content_id: contentId ?? null, channel: "site", position: i % 3 === 0 ? "last" : "mid", occurred_at: new Date(at.getTime() + 36e5).toISOString() },
    );

    convRows.push({
      ...base,
      type: "cta_click",
      visitor_id: visitorId,
      content_id: contentId ?? null,
      channel: "x",
      occurred_at: new Date(at.getTime() + 18e5).toISOString(),
    });

    if (i % 2 === 0) {
      convRows.push({
        ...base,
        type: i % 4 === 0 ? "inquiry" : "doc_request",
        visitor_id: visitorId,
        content_id: contentId ?? null,
        channel: "site",
        occurred_at: new Date(at.getTime() + 54e5).toISOString(),
      });
    }
    if (i % 7 === 0) {
      convRows.push({
        ...base,
        type: "contract",
        visitor_id: visitorId,
        content_id: contentId ?? null,
        channel: "site",
        amount: 478000,
        occurred_at: new Date(at.getTime() + 72e5).toISOString(),
      });
    }
  }
  await sb.from("touchpoints").insert(touchRows);
  await sb.from("conversions").insert(convRows);

  console.log("→ 計測データ(表示・クリック・問い合わせ・成約)を登録しました");

  // --------------------------------------------------------- reputation & ops
  await sb.from("mentions").insert([
    { ...base, source: "google_review", author: "宿泊者A", body: "チェックインがスムーズで助かりました。深夜到着でも問題なく入れました。", rating: 5, sentiment: "positive", urgency: 1, flare_risk: "none", status: "new", occurred_at: new Date(Date.now() - 2 * 864e5).toISOString() },
    { ...base, source: "google_review", author: "宿泊者B", body: "操作方法の説明が分かりにくく、フロントに問い合わせることになりました。改善してほしいです。", rating: 2, sentiment: "negative", urgency: 3, flare_risk: "low", needs_human: false, status: "new", occurred_at: new Date(Date.now() - 864e5).toISOString() },
  ]);

  await sb.from("market_signals").insert([
    { ...base, kind: "seasonal", title: "年末・お歳暮シーズンまで残りわずか", detail: "年末の繁忙期に向けた運営体制の発信が有効な時期です。", importance: 3 },
    { ...base, kind: "competitor_update", title: "A社チェックインシステムのページが更新されました", detail: "料金ページの内容に変更を検出しました。", importance: 3, url: "https://example.com/competitor-a" },
  ]);

  await sb.from("learnings").insert([
    { ...base, category: "preference", statement: "数値を出すときは必ず出典と期間を併記する文体を好む", evidence: "過去の修正指示より", status: "pending" },
    { ...base, category: "rule", statement: "施設名は許可が取れるまで匿名表記にする", evidence: "承認時のコメントより", status: "confirmed", weight: 1 },
    { ...base, category: "brand", statement: "「圧倒的」「業界No.1」などの誇張表現は使わない", evidence: "ブランド人格設定より", status: "long_term", weight: 1 },
  ]);

  await sb.from("media_outlets").delete().eq("org_id", orgId);
  await sb.from("media_outlets").insert([
    { org_id: orgId, name: "宿泊産業ニュース", category: "業界紙", region: "全国", fit_score: 82, url: "https://example.com/media-a" },
    { org_id: orgId, name: "県内ビジネス情報", category: "地域メディア", region: "地方", fit_score: 64, url: "https://example.com/media-b" },
  ]);

  await sb.from("notifications").insert({
    org_id: orgId,
    subject_id: subjectId,
    kind: "approval",
    agent: "secretary",
    title: "広報案のご確認をお願いします",
    body: "「深夜のチェックイン対応をなくす — 38室の温泉旅館での導入」の承認をお待ちしています。",
    link: "/dashboard/content",
  });

  console.log("→ 口コミ・市場シグナル・学習内容・媒体リストを登録しました");

  console.log(`
  ✓ シードが完了しました

    ログイン   ${email}
    パスワード ${password}
    URL        http://localhost:3000/login

    次に: npm run dev
  `);

}

main().catch((err) => {
  console.error(`
✗ ${err.message}`);
  process.exitCode = 1;
});
