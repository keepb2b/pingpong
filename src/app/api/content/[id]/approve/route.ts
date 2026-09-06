import { handle, requireOrg, requireRole, ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { approveContent } from "@/lib/agents/orchestrator";

export const runtime = "nodejs";

const ACTIONS = ["approve", "revise", "hold", "reject"] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const ctx = await requireOrg();
    const { id } = await params;
    const body = (await request.json()) as { action?: string; comment?: string };

    const action = body.action as (typeof ACTIONS)[number];
    if (!ACTIONS.includes(action)) throw new ApiError("不正な操作です");

    // 承認は承認者以上、修正・保留は編集者以上
    requireRole(ctx, action === "approve" ? "approver" : "editor");

    const sb = supabaseAdmin();
    const { data: content } = await sb
      .from("content_items")
      .select("id")
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .maybeSingle();
    if (!content) throw new ApiError("コンテンツが見つかりません", 404);

    return approveContent({
      contentId: id,
      action,
      userId: ctx.userId,
      comment: body.comment,
      via: "dashboard",
    });
  });
}
