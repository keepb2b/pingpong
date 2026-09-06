import type { ChannelKey } from "@/lib/constants";

export type PublishInput = {
  channel: ChannelKey;
  body: string;
  title?: string;
  assetUrls?: string[];
  credentials: Record<string, string>;
};

export type PublishResult = {
  ok: boolean;
  externalId?: string;
  externalUrl?: string;
  error?: string;
};

/**
 * 各媒体への実配信。
 * 認証情報は channels.credentials に保存されたものを使う。
 * 未連携の媒体は ok:false を返し、投稿は failed として記録される。
 */
export async function publishToChannel(input: PublishInput): Promise<PublishResult> {
  try {
    switch (input.channel) {
      case "x":
        return await publishX(input);
      case "facebook":
        return await publishFacebook(input);
      case "instagram":
        return await publishInstagram(input);
      case "gbp":
        return await publishGbp(input);
      case "wordpress":
        return await publishWordPress(input);
      case "line":
        return await publishLine(input);
      case "email":
      case "press":
      case "site":
        return {
          ok: false,
          error: `${input.channel} は手動配信または外部運用の媒体です。承認済みの原稿をご利用ください。`,
        };
      default:
        return { ok: false, error: "未対応の媒体です" };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ------------------------------------------------------------------- X -----
async function publishX(input: PublishInput): Promise<PublishResult> {
  const token = input.credentials.access_token;
  if (!token) return { ok: false, error: "Xの連携が未設定です (access_token)" };

  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: input.body.slice(0, 280) }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: `X API ${res.status}: ${JSON.stringify(data).slice(0, 300)}` };

  const id = data?.data?.id;
  return {
    ok: true,
    externalId: id,
    externalUrl: id ? `https://x.com/i/status/${id}` : undefined,
  };
}

// ------------------------------------------------------------ Facebook -----
async function publishFacebook(input: PublishInput): Promise<PublishResult> {
  const { page_id, access_token } = input.credentials;
  if (!page_id || !access_token)
    return { ok: false, error: "Facebookの連携が未設定です (page_id / access_token)" };

  const photo = input.assetUrls?.[0];
  const endpoint = photo
    ? `https://graph.facebook.com/v21.0/${page_id}/photos`
    : `https://graph.facebook.com/v21.0/${page_id}/feed`;

  const params = new URLSearchParams({ access_token });
  if (photo) {
    params.set("url", photo);
    params.set("caption", input.body);
  } else {
    params.set("message", input.body);
  }

  const res = await fetch(endpoint, { method: "POST", body: params });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    return { ok: false, error: `Facebook API ${res.status}: ${JSON.stringify(data).slice(0, 300)}` };

  const id = data?.post_id ?? data?.id;
  return { ok: true, externalId: id, externalUrl: id ? `https://facebook.com/${id}` : undefined };
}

// ----------------------------------------------------------- Instagram -----
async function publishInstagram(input: PublishInput): Promise<PublishResult> {
  const { ig_user_id, access_token } = input.credentials;
  if (!ig_user_id || !access_token)
    return { ok: false, error: "Instagramの連携が未設定です (ig_user_id / access_token)" };

  const image = input.assetUrls?.[0];
  if (!image) return { ok: false, error: "Instagram投稿には画像が必要です" };

  // 1) コンテナ作成 → 2) 公開 の2段階
  const createParams = new URLSearchParams({
    image_url: image,
    caption: input.body.slice(0, 2200),
    access_token,
  });
  const create = await fetch(
    `https://graph.facebook.com/v21.0/${ig_user_id}/media`,
    { method: "POST", body: createParams },
  );
  const created = await create.json().catch(() => ({}));
  if (!create.ok || !created?.id)
    return { ok: false, error: `Instagram media ${create.status}: ${JSON.stringify(created).slice(0, 300)}` };

  const publishParams = new URLSearchParams({ creation_id: created.id, access_token });
  const pub = await fetch(
    `https://graph.facebook.com/v21.0/${ig_user_id}/media_publish`,
    { method: "POST", body: publishParams },
  );
  const published = await pub.json().catch(() => ({}));
  if (!pub.ok)
    return { ok: false, error: `Instagram publish ${pub.status}: ${JSON.stringify(published).slice(0, 300)}` };

  return { ok: true, externalId: published?.id };
}

// --------------------------------------------- Googleビジネスプロフィール --
async function publishGbp(input: PublishInput): Promise<PublishResult> {
  const { account_id, location_id, access_token } = input.credentials;
  if (!account_id || !location_id || !access_token)
    return {
      ok: false,
      error: "Googleビジネスプロフィールの連携が未設定です (account_id / location_id / access_token)",
    };

  const body: Record<string, unknown> = {
    languageCode: "ja",
    summary: input.body.slice(0, 1500),
    topicType: "STANDARD",
  };
  if (input.assetUrls?.[0]) {
    body.media = [{ mediaFormat: "PHOTO", sourceUrl: input.assetUrls[0] }];
  }

  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/accounts/${account_id}/locations/${location_id}/localPosts`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    return { ok: false, error: `GBP API ${res.status}: ${JSON.stringify(data).slice(0, 300)}` };

  return { ok: true, externalId: data?.name, externalUrl: data?.searchUrl };
}

// ----------------------------------------------------------- WordPress -----
async function publishWordPress(input: PublishInput): Promise<PublishResult> {
  const { site_url, username, app_password } = input.credentials;
  if (!site_url || !username || !app_password)
    return {
      ok: false,
      error: "WordPressの連携が未設定です (site_url / username / app_password)",
    };

  const auth = Buffer.from(`${username}:${app_password}`).toString("base64");
  const res = await fetch(`${site_url.replace(/\/$/, "")}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      title: input.title ?? input.body.slice(0, 60),
      content: markdownToHtml(input.body),
      status: "publish",
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    return { ok: false, error: `WordPress ${res.status}: ${JSON.stringify(data).slice(0, 300)}` };

  return { ok: true, externalId: String(data?.id), externalUrl: data?.link };
}

// ---------------------------------------------------------------- LINE -----
async function publishLine(input: PublishInput): Promise<PublishResult> {
  const token = input.credentials.access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { ok: false, error: "LINEの連携が未設定です" };

  const res = await fetch("https://api.line.me/v2/bot/message/broadcast", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ type: "text", text: input.body.slice(0, 5000) }] }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `LINE ${res.status}: ${text.slice(0, 300)}` };
  }
  return { ok: true };
}

/** 最低限のMarkdown→HTML変換 (WordPress投稿用)。 */
export function markdownToHtml(md: string): string {
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped
    .split(/\n{2,}/)
    .map((block) => {
      const b = block.trim();
      if (!b) return "";
      if (/^###\s+/.test(b)) return `<h3>${b.replace(/^###\s+/, "")}</h3>`;
      if (/^##\s+/.test(b)) return `<h2>${b.replace(/^##\s+/, "")}</h2>`;
      if (/^#\s+/.test(b)) return `<h1>${b.replace(/^#\s+/, "")}</h1>`;
      if (/^[-*]\s+/m.test(b)) {
        const items = b
          .split("\n")
          .filter((l) => /^[-*]\s+/.test(l))
          .map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ""))}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
      return `<p>${inline(b).replace(/\n/g, "<br />")}</p>`;
    })
    .join("\n");
}

function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}
