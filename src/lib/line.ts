import crypto from "node:crypto";

const API = "https://api.line.me/v2/bot";
const DATA_API = "https://api-data.line.me/v2/bot";

function token(): string {
  const t = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (!t) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
  return t;
}

export function isLineConfigured(): boolean {
  return Boolean(
    process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim() && process.env.LINE_CHANNEL_SECRET?.trim(),
  );
}

function actionSecret() {
  return process.env.LINE_CHANNEL_SECRET || process.env.CRON_SECRET || "line-act";
}

/** LINEボタン用の署名付き操作URL（Webhook不要）。 */
export function lineActionUrl(base: string, action: string, contentId: string): string {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  const payload = `${action}:${contentId}:${exp}`;
  const sig = crypto.createHmac("sha256", actionSecret()).update(payload).digest("hex").slice(0, 32);
  const origin = base.replace(/\/$/, "");
  return `${origin}/api/line/act?action=${encodeURIComponent(action)}&id=${encodeURIComponent(contentId)}&exp=${exp}&sig=${sig}`;
}

export function verifyLineActionToken(action: string, contentId: string, exp: string, sig: string): boolean {
  const expNum = Number(exp);
  if (!expNum || expNum * 1000 < Date.now()) return false;
  const payload = `${action}:${contentId}:${exp}`;
  const expected = crypto.createHmac("sha256", actionSecret()).update(payload).digest("hex").slice(0, 32);
  if (expected.length !== sig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

/** Webhook署名検証 (改ざん・なりすまし防止) */
export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET?.trim();
  const sig = signature?.trim() ?? null;
  if (!secret || !sig) return false;
  const expected = crypto.createHmac("SHA256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function contentPostbackData(action: string, contentId: string): string {
  return `action=${action}&id=${contentId}`;
}

export type LineMessage = Record<string, unknown>;

export async function replyMessage(replyToken: string, messages: LineMessage[]) {
  const res = await fetch(`${API}/message/reply`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ replyToken, messages: messages.slice(0, 5) }),
  });
  if (!res.ok) throw new Error(`LINE reply ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

export async function pushMessage(to: string, messages: LineMessage[]) {
  const res = await fetch(`${API}/message/push`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to, messages: messages.slice(0, 5) }),
  });
  if (!res.ok) throw new Error(`LINE push ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

export async function getProfile(userId: string): Promise<{
  displayName?: string;
  pictureUrl?: string;
}> {
  const res = await fetch(`${API}/profile/${userId}`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (!res.ok) return {};
  return res.json();
}

/** 画像・動画・ファイルの実体を取得する。 */
export async function getMessageContent(messageId: string): Promise<{
  buffer: Buffer;
  contentType: string;
} | null> {
  const res = await fetch(`${DATA_API}/message/${messageId}/content`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (!res.ok) return null;
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType: res.headers.get("content-type") ?? "application/octet-stream" };
}

export function textMessage(text: string): LineMessage {
  return { type: "text", text: text.slice(0, 4900) };
}

/** 承認・修正・保留を1タップで選べるクイックリプライ。 */
export function quickReply(text: string, options: Array<{ label: string; data: string }>): LineMessage {
  return {
    type: "text",
    text: text.slice(0, 4900),
    quickReply: {
      items: options.slice(0, 13).map((o) => ({
        type: "action",
        action: { type: "postback", label: o.label.slice(0, 20), data: o.data, displayText: o.label },
      })),
    },
  };
}

export type ProposalCard = {
  id: string;
  theme: string;
  reason: string;
  goal: string;
  audience: string;
  channels: string[];
  cta: string;
  scheduledFor?: string;
  expectedEffect: string;
  cautions: string;
  bodyPreview: string;
  risk?: string;
};

/** 提案内容をLINEのFlex Messageで提示し、その場で承認まで完了できるようにする。 */
export function proposalFlex(card: ProposalCard, appUrl: string): LineMessage {
  const row = (label: string, value: string) => ({
    type: "box",
    layout: "baseline",
    spacing: "sm",
    contents: [
      { type: "text", text: label, color: "#8d96b5", size: "sm", flex: 2 },
      { type: "text", text: (value || "—").slice(0, 60), wrap: true, color: "#262b41", size: "sm", flex: 5 },
    ],
  });
  const btn = (label: string, action: string, style: string, color?: string) => ({
    type: "button",
    style,
    ...(color ? { color } : {}),
    height: "sm",
    action: {
      type: "postback",
      label,
      data: contentPostbackData(action, card.id),
      displayText: label,
    },
  });

  return {
    type: "flex",
    altText: `【広報提案】${card.theme}`,
    quickReply: {
      items: (
        [
          ["承認", "approve"],
          ["修正", "revise"],
          ["保留", "hold"],
          ["投稿しない", "reject"],
        ] as const
      ).map(([label, action]) => ({
        type: "action",
        action: {
          type: "postback",
          label,
          data: contentPostbackData(action, card.id),
          displayText: label,
        },
      })),
    },
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#4f46e5",
        paddingAll: "16px",
        contents: [
          { type: "text", text: "AI広報部からのご提案", color: "#c7d2fe", size: "xs", weight: "bold" },
          { type: "text", text: card.theme.slice(0, 40), color: "#ffffff", size: "lg", weight: "bold", wrap: true },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        paddingAll: "16px",
        contents: [
          { type: "text", text: card.reason.slice(0, 120), size: "sm", wrap: true, color: "#515a7c" },
          { type: "separator" },
          row("目的", card.goal),
          row("対象", card.audience),
          row("媒体", card.channels.join("・")),
          row("CTA", card.cta),
          row("予定", card.scheduledFor ?? "未定"),
          ...(card.risk ? [row("リスク", card.risk)] : []),
          { type: "separator" },
          { type: "text", text: "本文プレビュー", size: "xs", color: "#8d96b5", weight: "bold" },
          { type: "text", text: card.bodyPreview.slice(0, 200), size: "sm", wrap: true, color: "#262b41" },
          { type: "text", text: `期待効果: ${card.expectedEffect}`.slice(0, 100), size: "xs", wrap: true, color: "#10b981" },
          ...(card.cautions
            ? [{ type: "text", text: `注意: ${card.cautions}`.slice(0, 100), size: "xs", wrap: true, color: "#f59e0b" }]
            : []),
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
              btn("承認", "approve", "primary", "#4f46e5"),
              btn("修正", "revise", "secondary"),
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
              btn("保留", "hold", "link"),
              btn("投稿しない", "reject", "link"),
            ],
          },
          ...(appUrl.startsWith("https://")
            ? [
                {
                  type: "button",
                  style: "link",
                  height: "sm",
                  action: {
                    type: "uri" as const,
                    label: "詳細を確認",
                    uri: `${appUrl.replace(/\/$/, "")}/dashboard/content/${card.id}`,
                  },
                },
              ]
            : []),
        ],
      },
    },
  };
}

/** 月次レポート・スコアの通知カード。 */
export function reportFlex(params: {
  period: string;
  total: number;
  highlights: string[];
  url: string;
}): LineMessage {
  return {
    type: "flex",
    altText: `【月次AI広報会議】${params.period}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#06b6d4",
        paddingAll: "16px",
        contents: [
          { type: "text", text: "月次AI広報会議", color: "#cffafe", size: "xs", weight: "bold" },
          { type: "text", text: params.period, color: "#ffffff", size: "xl", weight: "bold" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "box",
            layout: "baseline",
            contents: [
              { type: "text", text: "AI広報スコア", size: "sm", color: "#8d96b5", flex: 3 },
              { type: "text", text: `${params.total}点`, size: "xxl", weight: "bold", color: "#06b6d4", flex: 3 },
            ],
          },
          { type: "separator" },
          ...params.highlights.slice(0, 5).map((h) => ({
            type: "text",
            text: `・${h}`,
            size: "sm",
            wrap: true,
            color: "#515a7c",
          })),
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#06b6d4",
            action: { type: "uri", label: "レポートを開く", uri: params.url },
          },
        ],
      },
    },
  };
}
