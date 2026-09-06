import { handle, requireOrg, requireRole, requireSubject, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notify } from "@/lib/agents/orchestrator";
import { appUrl } from "@/lib/tracking";

export const runtime = "nodejs";

/** コメント・口コミ / 危機広報 / メディアリレーション */
export async function POST(request: Request) {
  return handle(async () => {
    const ctx = await requireOrg();
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const sb = supabaseAdmin();

    switch (action) {
      // ------------------------------------------- コメント・口コミ ------
      case "add_mention": {
        requireRole(ctx, "editor");
        const subjectId = (body.subjectId as string) || requireSubject(ctx);
        const { data } = await sb
          .from("mentions")
          .insert({
            org_id: ctx.orgId,
            subject_id: subjectId,
            source: String(body.source ?? "web"),
            external_id: (body.external_id as string) ?? null,
            author: (body.author as string) ?? null,
            body: String(body.body ?? ""),
            rating: body.rating != null ? Number(body.rating) : null,
            url: (body.url as string) ?? null,
            occurred_at: (body.occurred_at as string) ?? new Date().toISOString(),
            reply_due_at: new Date(Date.now() + 24 * 3600e3).toISOString(),
          })
          .select("id")
          .single();
        return { id: data?.id };
      }

      case "send_reply": {
        requireRole(ctx, "approver");
        const replyId = String(body.replyId ?? "");
        const { data: reply } = await sb
          .from("mention_replies")
          .select("id, mention_id, draft")
          .eq("id", replyId)
          .eq("org_id", ctx.orgId)
          .maybeSingle();
        if (!reply) throw new ApiError("返信案が見つかりません", 404);

        // 実際の送信は媒体ごとの運用に依存するため、承認と履歴のみを確定させる
        await sb
          .from("mention_replies")
          .update({
            draft: (body.draft as string) ?? reply.draft,
            approved: true,
            sent_at: new Date().toISOString(),
            acted_by: ctx.userId,
          })
          .eq("id", replyId);

        await sb.from("mentions").update({ status: "replied" }).eq("id", reply.mention_id);
        return { ok: true };
      }

      case "update_mention": {
        requireRole(ctx, "editor");
        const patch: Record<string, unknown> = {};
        for (const k of ["status", "sentiment", "urgency", "flare_risk", "needs_human"]) {
          if (k in body) patch[k] = body[k];
        }
        await sb.from("mentions").update(patch).eq("id", String(body.id)).eq("org_id", ctx.orgId);
        return { ok: true };
      }

      // -------------------------------------------------------- 危機広報 -
      case "open_crisis": {
        requireRole(ctx, "approver");
        const subjectId = (body.subjectId as string) || requireSubject(ctx);

        const { data: incident } = await sb
          .from("crisis_incidents")
          .insert({
            org_id: ctx.orgId,
            subject_id: subjectId,
            title: String(body.title ?? "事案"),
            category: String(body.category ?? "other"),
            severity: String(body.severity ?? "high"),
            facts: (body.facts as object) ?? [],
            status: "open",
            posts_paused: true,
          })
          .select("id")
          .single();

        if (!incident) throw new ApiError("事案の登録に失敗しました", 500);

        // 予約投稿の一括停止 — 緊急時に宣伝投稿が公開され続けるのを防ぐ
        const { data: paused } = await sb
          .from("posts")
          .update({ status: "on_hold", error: "危機広報モードにより停止" })
          .eq("subject_id", subjectId)
          .eq("status", "scheduled")
          .select("id");

        await sb.from("crisis_actions").insert({
          org_id: ctx.orgId,
          incident_id: incident.id,
          action: "予約投稿の一括停止",
          detail: `${paused?.length ?? 0}件の投稿を停止しました`,
          actor: "システム",
        });

        await notify({
          orgId: ctx.orgId,
          subjectId,
          kind: "crisis",
          agent: "secretary",
          title: "危機広報モードを開始しました",
          body: `${body.title}\n予約投稿 ${paused?.length ?? 0}件を停止しました。`,
          link: appUrl("/dashboard/crisis"),
          toLine: true,
        });

        return { id: incident.id, pausedPosts: paused?.length ?? 0 };
      }

      case "update_crisis": {
        requireRole(ctx, "approver");
        const patch: Record<string, unknown> = {};
        for (const k of ["status", "severity", "statement", "apology", "sns_policy", "posts_paused"]) {
          if (k in body) patch[k] = body[k];
        }
        if (body.status === "resolved" || body.status === "closed") {
          patch.resolved_at = new Date().toISOString();
        }
        await sb
          .from("crisis_incidents")
          .update(patch)
          .eq("id", String(body.id))
          .eq("org_id", ctx.orgId);
        return { ok: true };
      }

      case "resume_posting": {
        requireRole(ctx, "approver");
        const incidentId = String(body.id ?? "");
        const { data: incident } = await sb
          .from("crisis_incidents")
          .select("id, subject_id")
          .eq("id", incidentId)
          .eq("org_id", ctx.orgId)
          .maybeSingle();
        if (!incident) throw new ApiError("事案が見つかりません", 404);

        await sb
          .from("crisis_incidents")
          .update({ posts_paused: false, resumed_by: ctx.userId, status: "resolved" })
          .eq("id", incidentId);

        await sb.from("crisis_actions").insert({
          org_id: ctx.orgId,
          incident_id: incidentId,
          action: "通常運用への復帰を承認",
          actor: ctx.userId,
        });

        return { ok: true };
      }

      case "add_crisis_action": {
        requireRole(ctx, "editor");
        await sb.from("crisis_actions").insert({
          org_id: ctx.orgId,
          incident_id: String(body.incidentId),
          action: String(body.action_text ?? ""),
          detail: (body.detail as string) ?? null,
          actor: ctx.userId,
        });
        return { ok: true };
      }

      // ---------------------------------------------- メディアリレーション
      case "save_outlet": {
        requireRole(ctx, "editor");
        const { data } = await sb
          .from("media_outlets")
          .insert({
            org_id: ctx.orgId,
            name: String(body.name ?? ""),
            category: (body.category as string) ?? null,
            region: (body.region as string) ?? null,
            contact_name: (body.contact_name as string) ?? null,
            contact_email: (body.contact_email as string) ?? null,
            url: (body.url as string) ?? null,
            fit_score: Number(body.fit_score ?? 0),
            notes: (body.notes as string) ?? null,
          })
          .select("id")
          .single();
        return { id: data?.id };
      }

      case "create_pitch": {
        requireRole(ctx, "editor");
        const subjectId = (body.subjectId as string) || requireSubject(ctx);
        const outletId = (body.outletId as string) ?? null;

        // 過剰送信の防止 — 同じ媒体へ30日以内に送っていないか確認する
        if (outletId) {
          const { data: recent } = await sb
            .from("media_pitches")
            .select("id, sent_at")
            .eq("outlet_id", outletId)
            .not("sent_at", "is", null)
            .gte("sent_at", new Date(Date.now() - 30 * 864e5).toISOString())
            .limit(1)
            .maybeSingle();
          if (recent) {
            throw new ApiError(
              "この媒体へは30日以内に提案を送っています。過剰送信を避けるため間隔を空けてください。",
              409,
            );
          }
        }

        const { data } = await sb
          .from("media_pitches")
          .insert({
            org_id: ctx.orgId,
            subject_id: subjectId,
            outlet_id: outletId,
            content_id: (body.contentId as string) ?? null,
            subject_line: String(body.subject_line ?? ""),
            body: String(body.body ?? ""),
            status: "draft",
          })
          .select("id")
          .single();
        return { id: data?.id };
      }

      case "update_pitch": {
        requireRole(ctx, "editor");
        const patch: Record<string, unknown> = {};
        for (const k of ["status", "subject_line", "body", "coverage_url"]) {
          if (k in body) patch[k] = body[k];
        }
        if (body.status === "sent") {
          patch.sent_at = new Date().toISOString();
          if (body.outletId) {
            await sb
              .from("media_outlets")
              .update({ last_contacted_at: new Date().toISOString() })
              .eq("id", String(body.outletId));
          }
        }
        if (body.status === "replied") patch.replied_at = new Date().toISOString();

        await sb.from("media_pitches").update(patch).eq("id", String(body.id)).eq("org_id", ctx.orgId);
        return { ok: true };
      }

      default:
        throw new ApiError(`不明なアクション: ${action}`);
    }
  });
}
