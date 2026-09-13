import { after, NextResponse } from "next/server";
import { verifyLineSignature } from "@/lib/line";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { type?: string; userId?: string; groupId?: string; roomId?: string };
  message?: { id: string; type: string; text?: string; fileName?: string };
  postback?: { data: string };
};

/** LINE管理画面の検証・ウォームアップ。重い依存を読まずすぐ 200。 */
export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function POST(request: Request) {
  const raw = await request.text();
  let body: { events?: LineEvent[] } = {};
  try {
    body = raw ? (JSON.parse(raw) as { events?: LineEvent[] }) : {};
  } catch {
    return NextResponse.json({ ok: true });
  }

  const events = body.events ?? [];
  if (events.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const signature = request.headers.get("x-line-signature");
  if (!verifyLineSignature(raw, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const run = async () => {
    const { processLineEvents } = await import("./handle-events");
    await processLineEvents(events);
  };

  try {
    after(() => run());
  } catch {
    void run();
  }

  return NextResponse.json({ ok: true });
}
