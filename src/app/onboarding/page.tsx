import { redirect } from "next/navigation";
import { getOrgContext, getSessionUser, supabaseServer } from "@/lib/supabase/server";
import { OnboardingWizard } from "./Wizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const ctx = await getOrgContext();
  if (!ctx || !ctx.subjectId) {
    // 組織が未作成 (メール確認後の初回ログインなど)
    return <OnboardingWizard mode="create-org" />;
  }

  const sb = await supabaseServer();
  const [{ data: karte }, { data: voice }, { data: objectives }] = await Promise.all([
    sb.from("karte_sections").select("key, content").eq("subject_id", ctx.subjectId),
    sb.from("brand_voice").select("persona, tone").eq("subject_id", ctx.subjectId).maybeSingle(),
    sb.from("pr_objectives").select("goal").eq("subject_id", ctx.subjectId),
  ]);

  return (
    <OnboardingWizard
      mode="setup"
      subjectId={ctx.subjectId}
      orgName={ctx.orgName}
      initial={{
        karte: Object.fromEntries((karte ?? []).map((k) => [k.key, k.content ?? ""])),
        persona: voice?.persona ?? "",
        tone: voice?.tone ?? [],
        goals: (objectives ?? []).map((o) => o.goal),
      }}
    />
  );
}
