import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  runDailyCycle,
  publishDuePosts,
  runMonthlyReview,
} from "@/lib/agents/orchestrator";
import { secretaryDailyPrompt } from "@/lib/agents/secretary";
import { isLineConfigured, pushMessage, textMessage } from "@/lib/line";
import { scanForSignals } from "@/lib/monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Job = "daily" | "interview" | "publish" | "monitor" | "monthly";

export async function GET(request: Request, ctx: { params: Promise<{ job: string }> }) {
  return run(request, ctx);
}
export async function POST(request: Request, ctx: { params: Promise<{ job: string }> }) {
  return run(request, ctx);
}

async function run(request: Request, { params }: { params: Promise<{ job: string }> }) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { job } = await params;

  try {
    switch (job as Job) {
      // 予約時刻を過ぎた投稿を配信する (Hobby では1日1回)
      case "publish": {
        const result = await publishDuePosts();
        return NextResponse.json({ ok: true, job, ...result });
      }

      // 毎日の広報活動 (戦略判断 → 制作 → 検査 → 承認依頼)
      // Hobby は1日1回までなので、ヒアリング・監視・月初の月次もここでまとめて回す。
      case "daily": {
        const subjects = await activeSubjects();
        const results = [];
        for (const s of subjects) {
          try {
            results.push({ subject: s.name, ...(await runDailyCycle(s.id)) });
          } catch (err) {
            results.push({
              subject: s.name,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        const extras: Record<string, unknown> = {};
        try {
          extras.interview = await runInterviews({ ignoreHour: true });
        } catch (err) {
          extras.interview = { error: err instanceof Error ? err.message : String(err) };
        }
        try {
          let signals = 0;
          for (const s of subjects) {
            try {
              signals += (await scanForSignals(s.id)).length;
            } catch {
              // 1社の失敗で全体を止めない
            }
          }
          extras.monitor = { subjects: subjects.length, signals };
        } catch (err) {
          extras.monitor = { error: err instanceof Error ? err.message : String(err) };
        }

        const now = new Date();
        const jst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
        if (jst.getDate() === 1) {
          const period = previousPeriod();
          const monthly = [];
          for (const s of subjects) {
            try {
              monthly.push({ subject: s.name, ...(await runMonthlyReview(s.id, period)) });
            } catch (err) {
              monthly.push({
                subject: s.name,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }
          extras.monthly = { period, results: monthly };
        }

        return NextResponse.json({ ok: true, job, count: results.length, results, extras });
      }

      // 対話頻度の設定に従ってAI秘書からヒアリングを送る
      case "interview": {
        const sent = await runInterviews({ ignoreHour: true });
        return NextResponse.json({ ok: true, job, ...sent });
      }

      // 競合・市場・トレンドの監視
      case "monitor": {
        const subjects = await activeSubjects();
        let signals = 0;
        for (const s of subjects) {
          try {
            signals += (await scanForSignals(s.id)).length;
          } catch {
            // 1社の失敗で全体を止めない
          }
        }
        return NextResponse.json({ ok: true, job, subjects: subjects.length, signals });
      }

      // 月次AI広報会議 + AI広報スコア
      case "monthly": {
        const url = new URL(request.url);
        const period = url.searchParams.get("period") ?? previousPeriod();
        const subjects = await activeSubjects();
        const results = [];
        for (const s of subjects) {
          try {
            results.push({ subject: s.name, ...(await runMonthlyReview(s.id, period)) });
          } catch (err) {
            results.push({
              subject: s.name,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        return NextResponse.json({ ok: true, job, period, results });
      }

      default:
        return NextResponse.json({ ok: false, error: `unknown job: ${job}` }, { status: 404 });
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, job, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

async function activeSubjects(): Promise<Array<{ id: string; org_id: string; name: string }>> {
  const sb = supabaseAdmin();
  // 課金が有効な組織のみ稼働させる
  const { data } = await sb
    .from("subjects")
    .select("id, org_id, name, subscriptions:organizations(subscriptions(status))")
    .eq("active", true);

  const rows = (data ?? []) as Array<{
    id: string;
    org_id: string;
    name: string;
    subscriptions?: { subscriptions?: Array<{ status: string }> } | null;
  }>;

  return rows.filter((r) => {
    const status = r.subscriptions?.subscriptions?.[0]?.status;
    // 課金未設定(開発・トライアル)でも動かす。明示的に停止された場合のみ除外。
    return !status || ["active", "trialing", "past_due", "none"].includes(status);
  });
}

/** 曜日と設定に従って本日ヒアリングすべき対象を選ぶ。 */
async function runInterviews(opts?: { ignoreHour?: boolean }): Promise<{ sent: number; skipped: number }> {
  const sb = supabaseAdmin();
  const now = new Date();
  const jstHour = Number(
    new Intl.DateTimeFormat("ja-JP", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Tokyo",
    }).format(now),
  );
  const jstDay = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" })).getDay();

  const { data: settings } = await sb
    .from("dialogue_settings")
    .select("subject_id, org_id, frequency, custom_days, send_hour, paused_until");

  let sent = 0;
  let skipped = 0;

  for (const s of settings ?? []) {
    if (!shouldInterviewToday(s, jstDay) || (!opts?.ignoreHour && s.send_hour !== jstHour)) {
      skipped++;
      continue;
    }
    if (s.paused_until && new Date(s.paused_until) > now) {
      skipped++;
      continue;
    }

    const { data: accounts } = await sb
      .from("line_accounts")
      .select("line_user_id")
      .eq("org_id", s.org_id);

    if (!accounts?.length) {
      skipped++;
      continue;
    }

    try {
      const { question, reason } = await secretaryDailyPrompt(s.subject_id);

      if (isLineConfigured()) {
        for (const a of accounts) {
          await pushMessage(a.line_user_id, [textMessage(question)]).catch(() => undefined);
        }
      }

      const { data: conversation } = await sb
        .from("conversations")
        .insert({
          org_id: s.org_id,
          subject_id: s.subject_id,
          line_user_id: accounts[0].line_user_id,
          channel: "line",
          topic: "daily_interview",
          pending_question: question,
          status: "open",
        })
        .select("id")
        .single();

      if (conversation) {
        await sb.from("messages").insert({
          org_id: s.org_id,
          conversation_id: conversation.id,
          role: "assistant",
          agent: "secretary",
          content: question,
          meta: { reason },
        });
      }
      sent++;
    } catch {
      skipped++;
    }
  }

  return { sent, skipped };
}

function shouldInterviewToday(
  s: { frequency: string; custom_days: number[] | null },
  day: number,
): boolean {
  switch (s.frequency) {
    case "daily":
      return true;
    case "five_per_week":
      return day >= 1 && day <= 5;
    case "three_per_week":
      return [1, 3, 5].includes(day);
    case "weekly":
      return day === 1;
    case "custom_days":
      return (s.custom_days ?? []).includes(day);
    case "on_demand":
    case "paused":
    default:
      return false;
  }
}

function previousPeriod(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

