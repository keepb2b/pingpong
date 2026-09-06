import { handle, requireOrg, requireRole, requireSubject, ApiError } from "@/lib/api";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { KARTE_SECTIONS, PRICING } from "@/lib/constants";

export const runtime = "nodejs";

/** 初期設定 (AI広報カルテ / 公式事実 / ブランド人格 / 媒体 / 頻度 / 権限) */
export async function POST(request: Request) {
  return handle(async () => {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");

    // 組織作成だけは membership が無い状態で呼ばれる
    if (action === "create_org") return createOrg(body);

    const ctx = await requireOrg();
    const sb = supabaseAdmin();

    switch (action) {
      // -------------------------------------------------------- 広報対象 --
      case "create_subject": {
        requireRole(ctx, "admin");

        const { count } = await sb
          .from("subjects")
          .select("id", { count: "exact", head: true })
          .eq("org_id", ctx.orgId)
          .eq("active", true);

        const { data } = await sb
          .from("subjects")
          .insert({
            org_id: ctx.orgId,
            name: String(body.name ?? "無題"),
            type: String(body.type ?? "company"),
            description: (body.description as string) ?? null,
            website: (body.website as string) ?? null,
            is_primary: (count ?? 0) === 0,
          })
          .select("id")
          .single();

        if (data) await scaffoldSubject(ctx.orgId, data.id);

        // 2件目以降は追加広報対象として課金対象になる
        const extra = Math.max(0, (count ?? 0) + 1 - 1);
        await sb
          .from("subscriptions")
          .update({ extra_subjects: extra })
          .eq("org_id", ctx.orgId);

        return { id: data?.id, extraSubjects: extra, extraMonthly: extra * PRICING.extraSubject };
      }

      case "update_subject": {
        requireRole(ctx, "editor");
        const id = String(body.id ?? "");
        const patch: Record<string, unknown> = {};
        for (const k of ["name", "type", "description", "website", "active"]) {
          if (k in body) patch[k] = body[k];
        }
        await sb.from("subjects").update(patch).eq("id", id).eq("org_id", ctx.orgId);
        return { id };
      }

      // ---------------------------------------------------- AI広報カルテ --
      case "save_karte": {
        requireRole(ctx, "editor");
        const subjectId = (body.subjectId as string) || requireSubject(ctx);
        const section = KARTE_SECTIONS.find((s) => s.key === body.key);
        if (!section) throw new ApiError("不明なカルテ項目です");

        await sb.from("karte_sections").upsert(
          {
            org_id: ctx.orgId,
            subject_id: subjectId,
            key: section.key,
            label: section.label,
            content: (body.content as string) ?? null,
            data: (body.data as object) ?? {},
            source: "user",
            confidence: 1,
            updated_by: ctx.userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "subject_id,key" },
        );
        return { key: section.key };
      }

      // ------------------------------------------------ 公式事実データベース
      case "save_fact": {
        requireRole(ctx, "editor");
        const subjectId = (body.subjectId as string) || requireSubject(ctx);
        const row = {
          org_id: ctx.orgId,
          subject_id: subjectId,
          category: String(body.category ?? "other"),
          key: String(body.key ?? ""),
          value: String(body.value ?? ""),
          numeric_value: body.numeric_value != null ? Number(body.numeric_value) : null,
          unit: (body.unit as string) ?? null,
          status: String(body.status ?? "confirmed"),
          visibility: String(body.visibility ?? "public"),
          source: (body.source as string) ?? null,
          source_url: (body.source_url as string) ?? null,
          published_on: (body.published_on as string) ?? null,
          verified_at: (body.verified_at as string) ?? new Date().toISOString(),
          expires_at: (body.expires_at as string) ?? null,
          approved_by: ctx.userId,
          notes: (body.notes as string) ?? null,
        };

        if (body.id) {
          await sb.from("official_facts").update(row).eq("id", String(body.id)).eq("org_id", ctx.orgId);
          return { id: body.id };
        }
        const { data } = await sb.from("official_facts").insert(row).select("id").single();
        return { id: data?.id };
      }

      case "delete_fact": {
        requireRole(ctx, "editor");
        await sb.from("official_facts").delete().eq("id", String(body.id)).eq("org_id", ctx.orgId);
        return { deleted: true };
      }

      // --------------------------------------------------- ブランド人格 ---
      case "save_brand_voice": {
        requireRole(ctx, "editor");
        const subjectId = (body.subjectId as string) || requireSubject(ctx);
        await sb.from("brand_voice").upsert(
          {
            org_id: ctx.orgId,
            subject_id: subjectId,
            persona: (body.persona as string) ?? null,
            tone: (body.tone as string[]) ?? [],
            first_person: (body.first_person as string) ?? null,
            sentence_ending: (body.sentence_ending as string) ?? null,
            preferred_words: (body.preferred_words as string[]) ?? [],
            banned_words: (body.banned_words as string[]) ?? [],
            banned_expressions: (body.banned_expressions as string[]) ?? [],
            emoji_policy: String(body.emoji_policy ?? "minimal"),
            reading_level: String(body.reading_level ?? "business"),
            sample_text: (body.sample_text as string) ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "subject_id" },
        );
        return { ok: true };
      }

      // ------------------------------------------------ ターゲット / 競合 -
      case "save_persona": {
        requireRole(ctx, "editor");
        const subjectId = (body.subjectId as string) || requireSubject(ctx);
        const { data } = await sb
          .from("personas")
          .insert({
            org_id: ctx.orgId,
            subject_id: subjectId,
            name: String(body.name ?? ""),
            segment: (body.segment as string) ?? null,
            age_range: (body.age_range as string) ?? null,
            role: (body.role as string) ?? null,
            pains: (body.pains as string[]) ?? [],
            gains: (body.gains as string[]) ?? [],
            channels: (body.channels as string[]) ?? [],
            notes: (body.notes as string) ?? null,
          })
          .select("id")
          .single();
        return { id: data?.id };
      }

      case "save_competitor": {
        requireRole(ctx, "editor");
        const subjectId = (body.subjectId as string) || requireSubject(ctx);
        const { data } = await sb
          .from("competitors")
          .insert({
            org_id: ctx.orgId,
            subject_id: subjectId,
            name: String(body.name ?? ""),
            website: (body.website as string) ?? null,
            positioning: (body.positioning as string) ?? null,
            strengths: (body.strengths as string[]) ?? [],
            weaknesses: (body.weaknesses as string[]) ?? [],
            watch_urls: (body.watch_urls as string[]) ?? [],
          })
          .select("id")
          .single();
        return { id: data?.id };
      }

      case "delete_row": {
        requireRole(ctx, "editor");
        const table = String(body.table ?? "");
        const allowed = ["personas", "competitors", "kpis", "pr_objectives", "media_outlets"];
        if (!allowed.includes(table)) throw new ApiError("削除できない項目です");
        await sb.from(table).delete().eq("id", String(body.id)).eq("org_id", ctx.orgId);
        return { deleted: true };
      }

      // ------------------------------------------------------ 目的 / KPI --
      case "save_objectives": {
        requireRole(ctx, "editor");
        const subjectId = (body.subjectId as string) || requireSubject(ctx);
        const goals = (body.goals as string[]) ?? [];
        await sb.from("pr_objectives").delete().eq("subject_id", subjectId);
        for (const [i, goal] of goals.entries()) {
          await sb.from("pr_objectives").insert({
            org_id: ctx.orgId,
            subject_id: subjectId,
            goal,
            priority: i + 1,
            active: true,
          });
        }
        return { count: goals.length };
      }

      case "save_kpi": {
        requireRole(ctx, "editor");
        const subjectId = (body.subjectId as string) || requireSubject(ctx);
        const row = {
          org_id: ctx.orgId,
          subject_id: subjectId,
          name: String(body.name ?? ""),
          metric: String(body.metric ?? "inquiry"),
          target_value: Number(body.target_value ?? 0),
          current_value: Number(body.current_value ?? 0),
          unit: (body.unit as string) ?? null,
          period: String(body.period ?? "month"),
        };
        if (body.id) {
          await sb.from("kpis").update(row).eq("id", String(body.id)).eq("org_id", ctx.orgId);
          return { id: body.id };
        }
        const { data } = await sb.from("kpis").insert(row).select("id").single();
        return { id: data?.id };
      }

      // ------------------------------------------------ 媒体 / 投稿頻度 ---
      case "save_channel": {
        requireRole(ctx, "editor");
        const subjectId = (body.subjectId as string) || requireSubject(ctx);
        await sb.from("channels").upsert(
          {
            org_id: ctx.orgId,
            subject_id: subjectId,
            type: String(body.type ?? ""),
            handle: (body.handle as string) ?? null,
            display_name: (body.display_name as string) ?? null,
            connected: Boolean(body.connected),
            credentials: (body.credentials as object) ?? {},
            frequency_mode: String(body.frequency_mode ?? "ai_auto"),
            frequency_count: body.frequency_count != null ? Number(body.frequency_count) : null,
            preferred_days: (body.preferred_days as number[]) ?? [],
            preferred_hours: (body.preferred_hours as number[]) ?? [],
            auto_publish: Boolean(body.auto_publish),
            auto_publish_max_risk: String(body.auto_publish_max_risk ?? "low"),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "subject_id,type" },
        );
        return { ok: true };
      }

      // -------------------------------------------------------- 対話頻度 --
      case "save_dialogue": {
        requireRole(ctx, "editor");
        const subjectId = (body.subjectId as string) || requireSubject(ctx);
        await sb.from("dialogue_settings").upsert(
          {
            org_id: ctx.orgId,
            subject_id: subjectId,
            frequency: String(body.frequency ?? "daily"),
            custom_days: (body.custom_days as number[]) ?? [],
            send_hour: Number(body.send_hour ?? 9),
            max_questions_per_session: Number(body.max_questions ?? 5),
            paused_until: (body.paused_until as string) ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "subject_id" },
        );
        return { ok: true };
      }

      // -------------------------------------------------------- 承認ルール
      case "save_approval_rule": {
        requireRole(ctx, "admin");
        const subjectId = (body.subjectId as string) || requireSubject(ctx);
        const { data } = await sb
          .from("approval_rules")
          .insert({
            org_id: ctx.orgId,
            subject_id: subjectId,
            content_type: (body.content_type as string) ?? null,
            channel: (body.channel as string) ?? null,
            min_risk: String(body.min_risk ?? "none"),
            required_roles: (body.required_roles as string[]) ?? ["approver"],
            auto_approve: Boolean(body.auto_approve),
          })
          .select("id")
          .single();
        return { id: data?.id };
      }

      // ------------------------------------------------------ LINE連携 ---
      case "create_link_code": {
        requireRole(ctx, "editor");
        const code = Array.from({ length: 6 }, () =>
          "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".charAt(Math.floor(Math.random() * 32)),
        ).join("");

        const { data } = await sb
          .from("link_codes")
          .insert({ org_id: ctx.orgId, code, created_by: ctx.userId })
          .select("code, expires_at")
          .single();

        return { code: data?.code, expiresAt: data?.expires_at };
      }

      // ------------------------------------------------------- メンバー ---
      case "invite_member": {
        requireRole(ctx, "admin");
        const { data } = await sb
          .from("invitations")
          .insert({
            org_id: ctx.orgId,
            email: String(body.email ?? ""),
            role: String(body.role ?? "editor"),
          })
          .select("token, email, role, expires_at")
          .single();
        return data;
      }

      case "update_member_role": {
        requireRole(ctx, "admin");
        await sb
          .from("memberships")
          .update({ role: String(body.role ?? "editor") })
          .eq("id", String(body.membershipId))
          .eq("org_id", ctx.orgId);
        return { ok: true };
      }

      case "complete_onboarding": {
        requireRole(ctx, "admin");
        await sb
          .from("organizations")
          .update({ onboarded_at: new Date().toISOString(), onboarding_step: 99 })
          .eq("id", ctx.orgId);
        return { ok: true };
      }

      default:
        throw new ApiError(`不明なアクション: ${action}`);
    }
  });
}

/** サインアップ直後の組織作成。呼び出したユーザーが owner になる。 */
async function createOrg(body: Record<string, unknown>) {
  const sbUser = await supabaseServer();
  const {
    data: { user },
  } = await sbUser.auth.getUser();
  if (!user) throw new ApiError("認証が必要です", 401);

  const sb = supabaseAdmin();

  const { data: existing } = await sb
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return { orgId: existing.org_id, existed: true };

  const { data: org, error } = await sb
    .from("organizations")
    .insert({
      name: String(body.orgName ?? "新しい会社"),
      industry: (body.industry as string) ?? null,
      website: (body.website as string) ?? null,
    })
    .select("id")
    .single();

  if (error || !org) throw new ApiError(error?.message ?? "組織の作成に失敗しました", 500);

  await sb.from("memberships").insert({ org_id: org.id, user_id: user.id, role: "owner" });
  await sb.from("profiles").upsert(
    { id: user.id, email: user.email, display_name: (body.displayName as string) ?? user.email },
    { onConflict: "id" },
  );
  await sb.from("subscriptions").insert({ org_id: org.id, status: "none" });

  const { data: subject } = await sb
    .from("subjects")
    .insert({
      org_id: org.id,
      name: String(body.subjectName ?? body.orgName ?? "自社"),
      type: String(body.subjectType ?? "company"),
      website: (body.website as string) ?? null,
      is_primary: true,
    })
    .select("id")
    .single();

  if (subject) await scaffoldSubject(org.id, subject.id);

  return { orgId: org.id, subjectId: subject?.id };
}

/** 広報対象を作った直後の初期レコード一式。 */
async function scaffoldSubject(orgId: string, subjectId: string) {
  const sb = supabaseAdmin();

  await sb.from("karte_sections").upsert(
    KARTE_SECTIONS.map((s) => ({
      org_id: orgId,
      subject_id: subjectId,
      key: s.key,
      label: s.label,
      content: null,
      confidence: 0,
      source: "user",
    })),
    { onConflict: "subject_id,key" },
  );

  await sb.from("brand_voice").upsert(
    { org_id: orgId, subject_id: subjectId, emoji_policy: "minimal" },
    { onConflict: "subject_id" },
  );

  await sb.from("dialogue_settings").upsert(
    { org_id: orgId, subject_id: subjectId, frequency: "daily", send_hour: 9 },
    { onConflict: "subject_id" },
  );

  for (const type of ["x", "instagram", "facebook", "gbp", "wordpress"]) {
    await sb
      .from("channels")
      .upsert(
        { org_id: orgId, subject_id: subjectId, type, frequency_mode: "ai_auto" },
        { onConflict: "subject_id,type" },
      );
  }

  await sb.from("approval_rules").insert({
    org_id: orgId,
    subject_id: subjectId,
    min_risk: "none",
    required_roles: ["approver"],
    auto_approve: false,
  });
}
