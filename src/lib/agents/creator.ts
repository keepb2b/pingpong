import { runAgent } from "@/lib/openrouter";
import { buildSubjectContext } from "@/lib/agents/context";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ChannelKey } from "@/lib/constants";

const FONT_SANS = "'Noto Sans JP', sans-serif";
const FONT_SERIF = "'Noto Serif JP', serif";

const SYSTEM = `あなたは日本企業のブランドに合わせたクリエイティブを設計する「AIクリエイター」です。
SNS画像・バナー・サムネイル・アイキャッチの構成を設計します。

厳守事項:
- 文字数を守る。SNS画像の見出しは20文字以内、サブは40文字以内。
- ブランドの雰囲気(誠実/先進的/親しみ 等)に合う配色を選ぶ。
- 読みやすさを最優先。背景と文字のコントラスト比は4.5:1以上を確保する。
- 未確認の数値を画像に入れない。
出力は指定されたJSON形式のみ。`;

/** 媒体別の推奨サイズ (媒体別サイズ調整) */
export const CREATIVE_SIZES: Record<string, { w: number; h: number; label: string }> = {
  instagram_square: { w: 1080, h: 1080, label: "Instagram 正方形" },
  instagram_portrait: { w: 1080, h: 1350, label: "Instagram 縦" },
  instagram_story: { w: 1080, h: 1920, label: "Instagram ストーリー" },
  x_landscape: { w: 1600, h: 900, label: "X 横長" },
  facebook_feed: { w: 1200, h: 630, label: "Facebook フィード" },
  gbp_post: { w: 1200, h: 900, label: "Googleビジネス投稿" },
  blog_eyecatch: { w: 1200, h: 630, label: "記事アイキャッチ" },
  banner: { w: 1456, h: 180, label: "バナー" },
};

export function sizeForChannel(channel: ChannelKey | undefined, kind: string) {
  if (kind === "banner") return CREATIVE_SIZES.banner;
  if (kind === "eyecatch") return CREATIVE_SIZES.blog_eyecatch;
  switch (channel) {
    case "instagram":
      return CREATIVE_SIZES.instagram_portrait;
    case "x":
      return CREATIVE_SIZES.x_landscape;
    case "facebook":
      return CREATIVE_SIZES.facebook_feed;
    case "gbp":
      return CREATIVE_SIZES.gbp_post;
    default:
      return CREATIVE_SIZES.blog_eyecatch;
  }
}

export type CreativeSpec = {
  headline: string;
  subcopy: string;
  eyebrow: string;
  badge?: string;
  layout: "left" | "center" | "split" | "editorial";
  palette: {
    bg: string;
    bgAlt: string;
    text: string;
    accent: string;
    muted: string;
  };
  motif: "grid" | "wave" | "orbit" | "bars" | "dots";
  alt_text: string;
  reason: string;
};

/** コンテンツからクリエイティブの設計案を作り、SVGに描き起こす。 */
export async function generateCreative(params: {
  subjectId: string;
  contentId?: string | null;
  kind?: string;
  channel?: ChannelKey;
  headlineHint?: string;
}): Promise<{ spec: CreativeSpec; svg: string; width: number; height: number }> {
  const ctx = await buildSubjectContext(params.subjectId);
  const sb = supabaseAdmin();

  let source = params.headlineHint ?? "";
  if (params.contentId) {
    const { data } = await sb
      .from("content_items")
      .select("title,summary,type")
      .eq("id", params.contentId)
      .maybeSingle();
    if (data) source = `${data.title}\n${data.summary ?? ""}`;
  }

  const size = sizeForChannel(params.channel, params.kind ?? "sns_image");

  const { result } = await runAgent<CreativeSpec>({
    agent: "creator",
    task: "generate_creative",
    system: SYSTEM,
    user: `${ctx.prompt}

# 元になる内容
${source || ctx.subjectName}

# 出力サイズ
${size.label} (${size.w}x${size.h})

# 指示
この内容のSNS画像/アイキャッチの構成を設計する。
ブランドイメージに合う配色を選び、コントラストを確保する。

JSONのみ:
{
 "headline":"見出し(20文字以内)",
 "subcopy":"サブコピー(40文字以内)",
 "eyebrow":"上部の小見出し(12文字以内)",
 "badge":"バッジ文言(任意/8文字以内)",
 "layout":"left|center|split|editorial",
 "palette":{"bg":"#0f172a","bgAlt":"#1e293b","text":"#ffffff","accent":"#6366f1","muted":"#94a3b8"},
 "motif":"grid|wave|orbit|bars|dots",
 "alt_text":"画像の代替テキスト",
 "reason":"この構成にした理由"
}`,
    orgId: ctx.orgId,
    subjectId: params.subjectId,
    json: true,
    temperature: 0.8,
    maxTokens: 1200,
    fallback: () => fallbackSpec(source, ctx.subjectName),
  });

  const spec = normalizeSpec(result ?? fallbackSpec(source, ctx.subjectName));
  return { spec, svg: renderCreativeSvg(spec, size.w, size.h, ctx.subjectName), width: size.w, height: size.h };
}

function fallbackSpec(source: string, name: string): CreativeSpec {
  const headline = (source.split("\n")[0] || name).slice(0, 20);
  return {
    headline,
    subcopy: (source.split("\n")[1] || "").slice(0, 40),
    eyebrow: "お知らせ",
    layout: "left",
    palette: {
      bg: "#0f1424",
      bgAlt: "#1b2340",
      text: "#ffffff",
      accent: "#6366f1",
      muted: "#9aa4c4",
    },
    motif: "grid",
    alt_text: headline,
    reason: "既定のブランドテンプレート",
  };
}

function normalizeSpec(s: CreativeSpec): CreativeSpec {
  const hex = (v: string, fb: string) => (/^#[0-9a-fA-F]{3,8}$/.test(v ?? "") ? v : fb);
  return {
    headline: (s.headline ?? "").slice(0, 28),
    subcopy: (s.subcopy ?? "").slice(0, 60),
    eyebrow: (s.eyebrow ?? "").slice(0, 16),
    badge: s.badge ? s.badge.slice(0, 10) : undefined,
    layout: (["left", "center", "split", "editorial"] as const).includes(s.layout)
      ? s.layout
      : "left",
    palette: {
      bg: hex(s.palette?.bg, "#0f1424"),
      bgAlt: hex(s.palette?.bgAlt, "#1b2340"),
      text: hex(s.palette?.text, "#ffffff"),
      accent: hex(s.palette?.accent, "#6366f1"),
      muted: hex(s.palette?.muted, "#9aa4c4"),
    },
    motif: (["grid", "wave", "orbit", "bars", "dots"] as const).includes(s.motif)
      ? s.motif
      : "grid",
    alt_text: s.alt_text ?? s.headline ?? "",
    reason: s.reason ?? "",
  };
}

function esc(s: string) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/** 日本語は禁則を厳密に扱えないため、文字数ベースで折り返す。 */
function wrap(text: string, perLine: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const ch of text) {
    line += ch;
    if (line.length >= perLine) {
      out.push(line);
      line = "";
    }
  }
  if (line) out.push(line);
  return out.slice(0, 4);
}

function motifSvg(motif: string, w: number, h: number, color: string): string {
  switch (motif) {
    case "wave":
      return `<path d="M0 ${h * 0.72} Q ${w * 0.25} ${h * 0.62}, ${w * 0.5} ${h * 0.72} T ${w} ${h * 0.72} L ${w} ${h} L 0 ${h} Z" fill="${color}" opacity="0.16"/>`;
    case "orbit":
      return `<g opacity="0.2" fill="none" stroke="${color}" stroke-width="${Math.max(2, w / 400)}">
        <circle cx="${w * 0.86}" cy="${h * 0.2}" r="${w * 0.13}"/>
        <circle cx="${w * 0.86}" cy="${h * 0.2}" r="${w * 0.2}"/>
        <circle cx="${w * 0.86}" cy="${h * 0.2}" r="${w * 0.27}"/>
      </g>`;
    case "bars": {
      const bars = Array.from({ length: 7 }, (_, i) => {
        const bh = h * (0.1 + ((i * 37) % 40) / 100);
        const bw = w * 0.035;
        return `<rect x="${w - (i + 1) * bw * 1.7}" y="${h - bh - h * 0.08}" width="${bw}" height="${bh}" rx="${bw / 3}" fill="${color}" opacity="0.22"/>`;
      }).join("");
      return bars;
    }
    case "dots": {
      let d = "";
      for (let x = 0; x < 12; x++)
        for (let y = 0; y < 8; y++)
          d += `<circle cx="${w * 0.55 + x * (w * 0.04)}" cy="${h * 0.12 + y * (h * 0.07)}" r="${Math.max(1.5, w / 500)}" fill="${color}" opacity="0.25"/>`;
      return d;
    }
    default: {
      const step = Math.round(w / 18);
      let g = "";
      for (let x = step; x < w; x += step)
        g += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${color}" stroke-width="1" opacity="0.08"/>`;
      for (let y = step; y < h; y += step)
        g += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${color}" stroke-width="1" opacity="0.08"/>`;
      return g;
    }
  }
}

/** 設計案をブランドテンプレートに沿ったSVGへ描画する。 */
export function renderCreativeSvg(
  spec: CreativeSpec,
  w: number,
  h: number,
  brandName: string,
): string {
  const p = spec.palette;
  const pad = Math.round(w * 0.075);
  const centered = spec.layout === "center";
  const anchor = centered ? "middle" : "start";
  const x = centered ? w / 2 : pad;

  const headSize = Math.round(Math.min(w, h) * (spec.layout === "editorial" ? 0.085 : 0.1));
  const perLine = Math.max(6, Math.floor((w - pad * 2) / headSize));
  const headLines = wrap(spec.headline, perLine);

  const subSize = Math.round(headSize * 0.38);
  const subLines = wrap(spec.subcopy, Math.floor((w - pad * 2) / subSize));

  const blockH = headLines.length * headSize * 1.28 + subLines.length * subSize * 1.6;
  let cy = h / 2 - blockH / 2 + headSize * 0.85;

  const eyebrowY = cy - headSize * 1.15;

  const head = headLines
    .map((l, i) => {
      const y = cy + i * headSize * 1.28;
      return `<text x="${x}" y="${y}" font-size="${headSize}" font-weight="700" fill="${p.text}" text-anchor="${anchor}" font-family="${spec.layout === "editorial" ? FONT_SERIF : FONT_SANS}" letter-spacing="0.01em">${esc(l)}</text>`;
    })
    .join("");

  cy += headLines.length * headSize * 1.28 + subSize * 0.6;

  const sub = subLines
    .map((l, i) => {
      const y = cy + i * subSize * 1.6;
      return `<text x="${x}" y="${y}" font-size="${subSize}" fill="${p.muted}" text-anchor="${anchor}" font-family="${FONT_SANS}">${esc(l)}</text>`;
    })
    .join("");

  const badge = spec.badge
    ? `<g>
        <rect x="${w - pad - Math.round(spec.badge.length * headSize * 0.42) - 28}" y="${pad}" rx="${headSize * 0.3}"
              width="${Math.round(spec.badge.length * headSize * 0.42) + 28}" height="${Math.round(headSize * 0.78)}" fill="${p.accent}"/>
        <text x="${w - pad - (Math.round(spec.badge.length * headSize * 0.42) + 28) / 2}" y="${pad + headSize * 0.55}"
              font-size="${Math.round(headSize * 0.34)}" fill="#fff" text-anchor="middle" font-weight="700"
              font-family="${FONT_SANS}">${esc(spec.badge)}</text>
      </g>`
    : "";

  const rule =
    spec.layout === "editorial"
      ? `<rect x="${pad}" y="${eyebrowY + headSize * 0.35}" width="${Math.round(w * 0.09)}" height="${Math.max(3, Math.round(h * 0.006))}" fill="${p.accent}" rx="2"/>`
      : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(spec.alt_text)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.bg}"/>
      <stop offset="100%" stop-color="${p.bgAlt}"/>
    </linearGradient>
    <linearGradient id="glow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${p.accent}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${p.accent}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  ${motifSvg(spec.motif, w, h, p.accent)}
  <rect x="0" y="0" width="${w}" height="${Math.max(4, Math.round(h * 0.008))}" fill="url(#glow)"/>
  ${rule}
  ${spec.eyebrow ? `<text x="${x}" y="${eyebrowY}" font-size="${Math.round(headSize * 0.32)}" fill="${p.accent}" text-anchor="${anchor}" font-weight="700" letter-spacing="0.12em" font-family="${FONT_SANS}">${esc(spec.eyebrow)}</text>` : ""}
  ${head}
  ${sub}
  ${badge}
  <text x="${pad}" y="${h - pad * 0.55}" font-size="${Math.round(headSize * 0.28)}" fill="${p.muted}" opacity="0.85" font-family="${FONT_SANS}">${esc(brandName)}</text>
</svg>`;
}

/** 複数枚投稿(カルーセル)用に連続したクリエイティブを作る。 */
export async function generateCarousel(params: {
  subjectId: string;
  contentId: string;
  slides?: number;
}): Promise<Array<{ spec: CreativeSpec; svg: string }>> {
  const ctx = await buildSubjectContext(params.subjectId);
  const sb = supabaseAdmin();
  const n = params.slides ?? 5;

  const { data: content } = await sb
    .from("content_items")
    .select("title,body,summary")
    .eq("id", params.contentId)
    .single();

  const { result } = await runAgent<{ slides: CreativeSpec[] }>({
    agent: "creator",
    task: "generate_carousel",
    system: SYSTEM,
    user: `${ctx.prompt}

# 元コンテンツ
${content?.title}
${String(content?.body ?? "").slice(0, 5000)}

# 指示
Instagram複数枚投稿(${n}枚)の構成を作る。1枚目で興味を引き、最後にCTAを置く。
全スライドで配色を統一する。

JSONのみ: {"slides":[{"headline":"...","subcopy":"...","eyebrow":"1/${n}","layout":"left","palette":{"bg":"#0f1424","bgAlt":"#1b2340","text":"#fff","accent":"#6366f1","muted":"#9aa4c4"},"motif":"grid","alt_text":"...","reason":"..."}]}`,
    orgId: ctx.orgId,
    subjectId: params.subjectId,
    json: true,
    temperature: 0.8,
    maxTokens: 3000,
    fallback: () => ({
      slides: Array.from({ length: n }, (_, i) => ({
        ...fallbackSpec(content?.title ?? "", ctx.subjectName),
        eyebrow: `${i + 1}/${n}`,
      })),
    }),
  });

  const size = CREATIVE_SIZES.instagram_portrait;
  return (result?.slides ?? []).map((s) => {
    const spec = normalizeSpec(s);
    return { spec, svg: renderCreativeSvg(spec, size.w, size.h, ctx.subjectName) };
  });
}
