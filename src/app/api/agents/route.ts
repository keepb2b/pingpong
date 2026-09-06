import { handle, requireOrg, requireSubject, requireRole, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runDailyCycle, produceFromProposal, runMonthlyReview, currentPeriod } from "@/lib/agents/orchestrator";
import { buildStrategy, decideToday, recommendCadence } from "@/lib/agents/strategist";
import { writeContent } from "@/lib/agents/writer";
import { adaptToChannels, designFunnel, draftReply } from "@/lib/agents/marketer";
import { factCheck, crisisResponse } from "@/lib/agents/analyst";
import { generateCreative, generateCarousel } from "@/lib/agents/creator";
import { secretaryDailyPrompt } from "@/lib/agents/secretary";
import type { ChannelKey, ContentTypeKey } from "@/lib/constants";

export const runtime = "nodejs";

/**
 * 6人の専門AIを手動で起動するエンドポイント。
 * ダッシュボードの各画面から「AIに依頼する」操作で呼ばれる。
 */
export async function POST(request: Request) {
  return handle(async () => {
    const ctx = await requireOrg();
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const sb = supabaseAdmin();
    const subjectId = (body.subjectId as string) || requireSubject(ctx);

    // 対象が自組織のものであることを保証する
    const { data: owned } = await sb
      .from("subjects")
      .select("id")
      .eq("id", subjectId)
      .eq("org_id", ctx.orgId)
      .maybeSingle();
    if (!owned) throw new ApiError("対象が見つかりません", 404);

    switch (action) {
      // ------------------------------------------------------ 日次循環 ----
      case "daily_cycle": {
        requireRole(ctx, "editor");
        return runDailyCycle(subjectId);
      }

      case "decide_today": {
        return decideToday(subjectId);
      }

      case "daily_prompt": {
        return secretaryDailyPrompt(subjectId);
      }

      // ----------------------------------------------------- 戦略設計 ----
      case "build_strategy": {
        requireRole(ctx, "editor");
        const period = String(body.period ?? currentPeriod());
        const plan = await buildStrategy({
          subjectId,
          period,
          horizon: (body.horizon as "month" | "quarter" | "year") ?? "month",
        });
        const { data } = await sb
          .from("strategies")
          .insert({
            org_id: ctx.orgId,
            subject_id: subjectId,
            period,
            title: plan.title,
            summary: plan.summary,
            goals: plan.goals ?? [],
            themes: plan.themes ?? [],
            channel_plan: plan.channel_plan ?? {},
            calendar: plan.calendar ?? [],
            kpi_plan: plan.kpi_plan ?? [],
            status: "draft",
          })
          .select("id")
          .single();
        return { id: data?.id, plan };
      }

      case "recommend_cadence": {
        return { cadence: await recommendCadence(subjectId) };
      }

      // --------------------------------------------------- コンテンツ ----
      case "write_content": {
        requireRole(ctx, "editor");
        const type = (body.type as ContentTypeKey) ?? "sns_post";
        const written = await writeContent({
          subjectId,
          type,
          theme: String(body.theme ?? ""),
          angle: body.angle as string | undefined,
          audience: body.audience as string | undefined,
          goal: body.goal as string | undefined,
          cta: body.cta as string | undefined,
          intakeItemId: (body.intakeItemId as string) ?? null,
          extraInstructions: body.instructions as string | undefined,
        });

        const { data } = await sb
          .from("content_items")
          .insert({
            org_id: ctx.orgId,
            subject_id: subjectId,
            type,
            title: written.title,
            body: written.body,
            summary: written.summary,
            keywords: written.keywords ?? [],
            cta: written.cta,
            goal: (body.goal as string) ?? null,
            status: "draft",
            created_by: "writer",
          })
          .select("id")
          .single();

        return { id: data?.id, content: written };
      }

      case "produce_from_proposal": {
        requireRole(ctx, "editor");
        const proposalId = String(body.proposalId ?? "");
        if (!proposalId) throw new ApiError("proposalId が必要です");
        return produceFromProposal({
          proposalId,
          contentType: body.type as ContentTypeKey | undefined,
        });
      }

      case "adapt_channels": {
        requireRole(ctx, "editor");
        const contentId = String(body.contentId ?? "");
        const channels = (body.channels as ChannelKey[]) ?? [];
        if (!contentId || !channels.length) throw new ApiError("contentId と channels が必要です");

        const variants = await adaptToChannels({
          subjectId,
          contentId,
          channels,
          ctaUrl: body.ctaUrl as string | undefined,
          abTest: Boolean(body.abTest),
        });

        await sb.from("content_variants").delete().eq("content_id", contentId);
        for (const v of variants) {
          await sb.from("content_variants").insert({
            org_id: ctx.orgId,
            content_id: contentId,
            channel: v.channel,
            body: v.body,
            hashtags: v.hashtags ?? [],
            cta: v.cta,
            char_count: v.body?.length ?? 0,
            optimized_for: v.reason,
            ab_group: "A",
          });
          if (v.ab_variant) {
            await sb.from("content_variants").insert({
              org_id: ctx.orgId,
              content_id: contentId,
              channel: v.channel,
              body: v.ab_variant,
              hashtags: v.hashtags ?? [],
              cta: v.cta,
              char_count: v.ab_variant.length,
              optimized_for: "A/Bテスト B案",
              ab_group: "B",
            });
          }
        }
        return { variants };
      }

      // -------------------------------------------------- ファクトチェック
      case "fact_check": {
        const contentId = String(body.contentId ?? "");
        if (!contentId) throw new ApiError("contentId が必要です");
        const check = await factCheck({ subjectId, contentId });
        await sb.from("risk_checks").insert({
          org_id: ctx.orgId,
          content_id: contentId,
          overall: check.overall,
          passed: check.passed,
          findings: check.findings,
          unverified_claims: check.unverified_claims,
          blocked: check.blocked,
        });
        await sb
          .from("content_items")
          .update({ risk: check.overall, status: check.blocked ? "on_hold" : "pending_approval" })
          .eq("id", contentId);
        return check;
      }

      // ------------------------------------------------ クリエイティブ ---
      case "generate_creative": {
        requireRole(ctx, "editor");
        const creative = await generateCreative({
          subjectId,
          contentId: (body.contentId as string) ?? null,
          channel: body.channel as ChannelKey | undefined,
          kind: (body.kind as string) ?? "sns_image",
          headlineHint: body.headline as string | undefined,
        });
        const { data } = await sb
          .from("creatives")
          .insert({
            org_id: ctx.orgId,
            subject_id: subjectId,
            content_id: (body.contentId as string) ?? null,
            kind: (body.kind as string) ?? "sns_image",
            channel: (body.channel as string) ?? null,
            width: creative.width,
            height: creative.height,
            prompt: creative.spec.reason,
            svg: creative.svg,
            palette: creative.spec.palette,
            status: "draft",
          })
          .select("id")
          .single();
        return { id: data?.id, ...creative };
      }

      case "generate_carousel": {
        requireRole(ctx, "editor");
        const contentId = String(body.contentId ?? "");
        if (!contentId) throw new ApiError("contentId が必要です");
        const slides = await generateCarousel({
          subjectId,
          contentId,
          slides: Number(body.slides ?? 5),
        });
        for (const [i, s] of slides.entries()) {
          await sb.from("creatives").insert({
            org_id: ctx.orgId,
            subject_id: subjectId,
            content_id: contentId,
            kind: `carousel_${i + 1}`,
            channel: "instagram",
            width: 1080,
            height: 1350,
            svg: s.svg,
            palette: s.spec.palette,
            prompt: s.spec.reason,
          });
        }
        return { count: slides.length, slides };
      }

      // ------------------------------------------------------ 顧客導線 ---
      case "design_funnel": {
        return designFunnel({ subjectId, goal: String(body.goal ?? "inquiry") });
      }

      // --------------------------------------------------- 口コミ返信 ----
      case "draft_reply": {
        requireRole(ctx, "editor");
        const mentionId = String(body.mentionId ?? "");
        if (!mentionId) throw new ApiError("mentionId が必要です");
        const reply = await draftReply({ subjectId, mentionId });

        await sb.from("mentions").update({
          sentiment: reply.sentiment,
          urgency: reply.urgency,
          flare_risk: reply.flare_risk,
          needs_human: reply.needs_human,
          status: "drafted",
        }).eq("id", mentionId);

        const { data } = await sb
          .from("mention_replies")
          .insert({ org_id: ctx.orgId, mention_id: mentionId, draft: reply.draft })
          .select("id")
          .single();

        return { id: data?.id, ...reply };
      }

      // -------------------------------------------------------- 危機広報 -
      case "crisis_response": {
        requireRole(ctx, "approver");
        const incidentId = String(body.incidentId ?? "");
        const { data: incident } = await sb
          .from("crisis_incidents")
          .select("id,title,category,severity,facts")
          .eq("id", incidentId)
          .maybeSingle();
        if (!incident) throw new ApiError("事案が見つかりません", 404);

        const res = await crisisResponse({
          subjectId,
          incident: {
            title: incident.title,
            category: incident.category,
            severity: incident.severity,
            facts: incident.facts,
          },
        });

        await sb
          .from("crisis_incidents")
          .update({
            facts: res.fact_summary,
            statement: res.statement,
            apology: res.apology,
            qa: res.qa,
            sns_policy: res.sns_policy,
            notices: res.notices,
          })
          .eq("id", incidentId);

        for (const a of res.next_actions ?? []) {
          await sb.from("crisis_actions").insert({
            org_id: ctx.orgId,
            incident_id: incidentId,
            action: a,
            actor: "AI",
          });
        }

        return res;
      }

      // -------------------------------------------------- 月次AI広報会議 -
      case "monthly_review": {
        requireRole(ctx, "editor");
        return runMonthlyReview(subjectId, String(body.period ?? currentPeriod()));
      }

      default:
        throw new ApiError(`不明なアクション: ${action}`);
    }
  });
}
