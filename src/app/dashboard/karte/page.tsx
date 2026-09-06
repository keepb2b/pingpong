import { redirect } from "next/navigation";
import { getOrgContext, supabaseServer } from "@/lib/supabase/server";
import { Card, CardHeader, ProgressBar } from "@/components/ui";
import { PageHeader } from "@/components/dashboard/shared";
import { KarteEditor, BrandVoiceEditor, PersonaEditor } from "./Editors";
import { KARTE_SECTIONS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function KartePage() {
  const ctx = await getOrgContext();
  if (!ctx?.subjectId) redirect("/onboarding");

  const sb = await supabaseServer();

  const [{ data: sections }, { data: voice }, { data: personas }] = await Promise.all([
    sb.from("karte_sections").select("key, label, content").eq("subject_id", ctx.subjectId),
    sb.from("brand_voice").select("*").eq("subject_id", ctx.subjectId).maybeSingle(),
    sb.from("personas").select("*").eq("subject_id", ctx.subjectId).order("created_at"),
  ]);

  const map = Object.fromEntries((sections ?? []).map((s) => [s.key, s.content ?? ""]));
  const filled = KARTE_SECTIONS.filter((s) => (map[s.key] ?? "").trim().length > 20).length;
  const pct = Math.round((filled / KARTE_SECTIONS.length) * 100);

  return (
    <>
      <PageHeader
        title="AI広報カルテ"
        description="AIが企業を理解するための情報です。ここが充実するほど、自社らしい文章と的確な判断ができるようになります。"
        agent="secretary"
      />

      <Card className="mb-5">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div>
            <p className="text-sm font-medium">カルテの充実度</p>
            <p className="muted text-xs mt-0.5">
              {filled} / {KARTE_SECTIONS.length} 項目が記入済み
            </p>
          </div>
          <span className="text-2xl font-bold tabular-nums">{pct}%</span>
        </div>
        <ProgressBar value={pct} height={8} />
        <p className="muted text-[11px] mt-2.5 leading-relaxed">
          空欄の項目は、AI秘書がLINEでのヒアリングを通じて少しずつ埋めていきます。
        </p>
      </Card>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="カルテ項目" subtitle="クリックすると編集できます。" />
            <KarteEditor subjectId={ctx.subjectId} sections={map} />
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="ブランド人格・文章トーン"
              subtitle="AIライターが自社らしい文章を書くための設定です。"
            />
            <BrandVoiceEditor
              subjectId={ctx.subjectId}
              initial={{
                persona: voice?.persona ?? "",
                tone: voice?.tone ?? [],
                first_person: voice?.first_person ?? "",
                sentence_ending: voice?.sentence_ending ?? "",
                preferred_words: voice?.preferred_words ?? [],
                banned_words: voice?.banned_words ?? [],
                banned_expressions: voice?.banned_expressions ?? [],
                emoji_policy: voice?.emoji_policy ?? "minimal",
                sample_text: voice?.sample_text ?? "",
              }}
            />
          </Card>

          <Card>
            <CardHeader title="ターゲット" subtitle="誰に届けるかを定義します。" />
            <PersonaEditor
              subjectId={ctx.subjectId}
              personas={(personas ?? []).map((p) => ({
                id: p.id,
                name: p.name,
                segment: p.segment,
                role: p.role,
                pains: p.pains ?? [],
                gains: p.gains ?? [],
              }))}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
