import { handle, requireOrg, requireRole, requireSubject, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { schedulePosts, publishDuePosts } from "@/lib/agents/orchestrator";
import { createTrackingLink, appUrl } from "@/lib/tracking";
import type { ChannelKey } from "@/lib/constants";

export const runtime = "nodejs";
export const maxDuration = 120;

/** 広報材料・コンテンツ・投稿・学習内容の操作 */
export async function POST(request: Request) {
  return handle(async () => {
    const ctx = await requireOrg();
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const sb = supabaseAdmin();

    switch (action) {
      // ------------------------------------------------------ 広報材料 ---
      case "add_intake": {
        requireRole(ctx, "editor");
        const subjectId = (body.subjectId as string) || requireSubject(ctx);
        const { data } = await sb
          .from("intake_items")
          .insert({
            org_id: ctx.orgId,
            subject_id: subjectId,
            kind: String(body.kind ?? "event"),
            title: String(body.title ?? ""),
            raw_text: (body.raw_text as string) ?? null,
            structured: (body.structured as object) ?? {},
            newsworthiness: Number(body.newsworthiness ?? 50),
            disclosable: body.disclosable !== false,
            occurred_on: (body.occurred_on as string) ?? null,
            status: "new",
          })
          .select("id")
          .single();
        return { id: data?.id };
      }

      case "update_intake": {
        requireRole(ctx, "editor");
        const patch: Record<string, unknown> = {};
        for (const k of ["title", "raw_text", "newsworthiness", "disclosable", "status", "kind"]) {
          if (k in body) patch[k] = body[k];
        }
        await sb.from("intake_items").update(patch).eq("id", String(body.id)).eq("org_id", ctx.orgId);
        return { ok: true };
      }

      // ----------------------------------------------------- コンテンツ --
      case "update_content": {
        requireRole(ctx, "editor");
        const id = String(body.id ?? "");
        const { data: current } = await sb
          .from("content_items")
          .select("version")
          .eq("id", id)
          .eq("org_id", ctx.orgId)
          .maybeSingle();
        if (!current) throw new ApiError("コンテンツが見つかりません", 404);

        const patch: Record<string, unknown> = { version: (current.version ?? 1) + 1 };
        for (const k of ["title", "body", "summary", "cta", "cta_url", "keywords", "status"]) {
          if (k in body) patch[k] = body[k];
        }
        await sb.from("content_items").update(patch).eq("id", id);
        return { ok: true, version: patch.version };
      }

      case "update_variant": {
        requireRole(ctx, "editor");
        const bodyText = String(body.body ?? "");
        await sb
          .from("content_variants")
          .update({ body: bodyText, char_count: bodyText.length })
          .eq("id", String(body.id))
          .eq("org_id", ctx.orgId);
        return { ok: true };
      }

      case "delete_content": {
        requireRole(ctx, "editor");
        await sb.from("content_items").delete().eq("id", String(body.id)).eq("org_id", ctx.orgId);
        return { deleted: true };
      }

      // -------------------------------------------------------- 投稿 -----
      case "schedule_posts": {
        requireRole(ctx, "approver");
        const count = await schedulePosts(String(body.contentId));
        return { scheduled: count };
      }

      case "reschedule_post": {
        requireRole(ctx, "editor");
        await sb
          .from("posts")
          .update({ scheduled_for: String(body.scheduled_for), status: "scheduled", error: null })
          .eq("id", String(body.id))
          .eq("org_id", ctx.orgId);
        return { ok: true };
      }

      case "cancel_post": {
        requireRole(ctx, "editor");
        await sb
          .from("posts")
          .update({ status: "on_hold" })
          .eq("id", String(body.id))
          .eq("org_id", ctx.orgId);
        return { ok: true };
      }

      case "publish_now": {
        requireRole(ctx, "approver");
        await sb
          .from("posts")
          .update({ scheduled_for: new Date().toISOString(), status: "scheduled" })
          .eq("id", String(body.id))
          .eq("org_id", ctx.orgId);
        const result = await publishDuePosts(5);
        return result;
      }

      // ------------------------------------------------------ 計測リンク --
      case "create_tracking_link": {
        requireRole(ctx, "editor");
        const subjectId = (body.subjectId as string) || requireSubject(ctx);
        const link = await createTrackingLink({
          orgId: ctx.orgId,
          subjectId,
          targetUrl: String(body.target_url ?? appUrl("/")),
          contentId: (body.contentId as string) ?? null,
          postId: (body.postId as string) ?? null,
          channel: body.channel as ChannelKey | undefined,
          campaign: (body.campaign as string) ?? undefined,
        });
        return link;
      }

      // ------------------------------------------------- AIが学習した内容 -
      // 正しい / 修正する / 今回だけ / 長期的に記憶 / 忘れさせる
      case "review_learning": {
        requireRole(ctx, "editor");
        const decision = String(body.decision ?? "");
        const map: Record<string, { status: string; weight: number; expires?: boolean }> = {
          correct: { status: "confirmed", weight: 0.9 },
          correct_to: { status: "corrected", weight: 0.9 },
          once: { status: "once_only", weight: 0.3, expires: true },
          long_term: { status: "long_term", weight: 1 },
          forget: { status: "forgotten", weight: 0 },
        };
        const chosen = map[decision];
        if (!chosen) throw new ApiError("不明な判断です");

        await sb
          .from("learnings")
          .update({
            status: chosen.status,
            weight: chosen.weight,
            corrected_to: (body.corrected_to as string) ?? null,
            reviewed_by: ctx.userId,
            reviewed_at: new Date().toISOString(),
            expires_at: chosen.expires ? new Date(Date.now() + 7 * 864e5).toISOString() : null,
          })
          .eq("id", String(body.id))
          .eq("org_id", ctx.orgId);

        return { ok: true, status: chosen.status };
      }

      // -------------------------------------------------- 月次レポート ----
      case "approve_report": {
        requireRole(ctx, "approver");
        await sb
          .from("monthly_reports")
          .update({
            status: "approved",
            approved_at: new Date().toISOString(),
            approved_by: ctx.userId,
          })
          .eq("id", String(body.id))
          .eq("org_id", ctx.orgId);
        return { ok: true };
      }

      case "approve_strategy": {
        requireRole(ctx, "approver");
        await sb
          .from("strategies")
          .update({ status: "approved", approved_at: new Date().toISOString() })
          .eq("id", String(body.id))
          .eq("org_id", ctx.orgId);
        return { ok: true };
      }

      // ----------------------------------------------------- 通知既読 -----
      case "read_notification": {
        await sb
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("id", String(body.id))
          .eq("org_id", ctx.orgId);
        return { ok: true };
      }

      case "read_all_notifications": {
        await sb
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("org_id", ctx.orgId)
          .is("read_at", null);
        return { ok: true };
      }

      // ---------------------------------------- 指標の手動取り込み --------
      case "record_metrics": {
        requireRole(ctx, "editor");
        const subjectId = (body.subjectId as string) || requireSubject(ctx);
        await sb.from("metrics_daily").insert({
          org_id: ctx.orgId,
          subject_id: subjectId,
          post_id: (body.postId as string) ?? null,
          content_id: (body.contentId as string) ?? null,
          channel: (body.channel as string) ?? null,
          day: String(body.day ?? new Date().toISOString().slice(0, 10)),
          impressions: Number(body.impressions ?? 0),
          reach: Number(body.reach ?? 0),
          engagements: Number(body.engagements ?? 0),
          clicks: Number(body.clicks ?? 0),
          pageviews: Number(body.pageviews ?? 0),
          avg_time_sec: Number(body.avg_time_sec ?? 0),
          search_clicks: Number(body.search_clicks ?? 0),
        });
        return { ok: true };
      }

      case "record_conversion": {
        requireRole(ctx, "editor");
        const subjectId = (body.subjectId as string) || requireSubject(ctx);
        await sb.from("conversions").insert({
          org_id: ctx.orgId,
          subject_id: subjectId,
          type: String(body.type ?? "inquiry"),
          content_id: (body.contentId as string) ?? null,
          post_id: (body.postId as string) ?? null,
          channel: (body.channel as string) ?? null,
          amount: body.amount != null ? Number(body.amount) : null,
          visitor_id: (body.visitor_id as string) ?? null,
          meta: (body.meta as object) ?? {},
        });
        return { ok: true };
      }

      default:
        throw new ApiError(`不明なアクション: ${action}`);
    }
  });
}
