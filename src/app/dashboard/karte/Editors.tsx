"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Badge,
  Field,
  Input,
  Textarea,
  Select,
  Modal,
  callApi,
  toast,
} from "@/components/ui";
import { KARTE_SECTIONS } from "@/lib/constants";

const TONES = ["誠実", "落ち着いた", "専門的", "親しみやすい", "先進的", "丁寧", "簡潔", "情熱的"];

const PLACEHOLDERS: Record<string, string> = {
  philosophy: "私たちが大切にしている考え方",
  history: "創業からの主な出来事",
  leader_voice: "代表が普段話している考えや価値観",
  products: "提供している商品・サービスの概要",
  pricing: "料金体系と主な機能",
  targets: "どんなお客様に届けたいか",
  strengths: "競合と比べて優れている点、選ばれる理由",
  weaknesses: "苦手なこと、できないこと (社内向け)",
  competitors: "主な競合と、その違い",
  cases: "実際の導入先や成果 (公開可能なもの)",
  testimonials: "お客様からいただいた声",
  faq: "よく聞かれる質問と回答",
  brand_image: "どう見られたいか、どう見られたくないか",
  tone: "文章の雰囲気",
  expressions: "積極的に使いたい言い回し",
  banned_expressions: "使ってはいけない表現",
  disclosable: "外部に公開してよい情報の範囲",
};

export function KarteEditor({
  subjectId,
  sections,
}: {
  subjectId: string;
  sections: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const section = KARTE_SECTIONS.find((s) => s.key === open);

  return (
    <>
      <ul className="divide-y divide-[var(--border)]">
        {KARTE_SECTIONS.map((s) => {
          const content = sections[s.key] ?? "";
          const filled = content.trim().length > 20;

          return (
            <li key={s.key}>
              <button
                onClick={() => {
                  setOpen(s.key);
                  setDraft(content);
                }}
                className="w-full text-left py-3 flex items-start gap-3 hover:bg-[var(--surface-2)] px-2 -mx-2 rounded-lg transition-colors"
              >
                <span
                  className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                    filled ? "bg-emerald-500" : "bg-[var(--surface-3)] border border-[var(--border)]"
                  }`}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-medium block">{s.label}</span>
                  <span className="muted text-xs mt-0.5 block line-clamp-2 leading-relaxed">
                    {content || PLACEHOLDERS[s.key] || "未記入"}
                  </span>
                </span>
                {!filled && <Badge tone="warn">未記入</Badge>}
              </button>
            </li>
          );
        })}
      </ul>

      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={section?.label ?? ""} wide>
        <Field label={section?.label ?? ""} hint={PLACEHOLDERS[open ?? ""]}>
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={12} />
        </Field>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setOpen(null)}>
            キャンセル
          </Button>
          <Button
            onClick={async () => {
              const res = await callApi("/api/setup", {
                action: "save_karte",
                subjectId,
                key: open,
                content: draft,
              });
              if (!res) return;
              toast("保存しました");
              setOpen(null);
              router.refresh();
            }}
          >
            保存する
          </Button>
        </div>
      </Modal>
    </>
  );
}

type VoiceState = {
  persona: string;
  tone: string[];
  first_person: string;
  sentence_ending: string;
  preferred_words: string[];
  banned_words: string[];
  banned_expressions: string[];
  emoji_policy: string;
  sample_text: string;
};

export function BrandVoiceEditor({
  subjectId,
  initial,
}: {
  subjectId: string;
  initial: VoiceState;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [dirty, setDirty] = useState(false);

  const set = <K extends keyof VoiceState>(k: K, value: VoiceState[K]) => {
    setV((prev) => ({ ...prev, [k]: value }));
    setDirty(true);
  };

  const listToText = (a: string[]) => a.join("、");
  const textToList = (s: string) =>
    s
      .split(/[,、\n]/)
      .map((x) => x.trim())
      .filter(Boolean);

  return (
    <div className="space-y-4">
      <Field label="ブランド人格">
        <Input
          value={v.persona}
          onChange={(e) => set("persona", e.target.value)}
          placeholder="誠実で落ち着いた、現場を知る専門家"
        />
      </Field>

      <Field label="文章トーン">
        <div className="flex flex-wrap gap-1.5">
          {TONES.map((t) => {
            const on = v.tone.includes(t);
            return (
              <button
                key={t}
                onClick={() => set("tone", on ? v.tone.filter((x) => x !== t) : [...v.tone, t])}
                className={`px-2.5 py-1 rounded-lg border text-[11px] transition-colors
                  ${on ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200" : "border-[var(--border)] muted hover:border-brand-300"}`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="一人称">
          <Input value={v.first_person} onChange={(e) => set("first_person", e.target.value)} />
        </Field>
        <Field label="絵文字">
          <Select value={v.emoji_policy} onChange={(e) => set("emoji_policy", e.target.value)}>
            <option value="none">使わない</option>
            <option value="minimal">控えめ</option>
            <option value="friendly">積極的に使う</option>
          </Select>
        </Field>
      </div>

      <Field label="推奨表現" hint="読点区切り">
        <Textarea
          value={listToText(v.preferred_words)}
          onChange={(e) => set("preferred_words", textToList(e.target.value))}
          rows={2}
        />
      </Field>

      <Field label="禁止ワード" hint="投稿前チェックで必ず検出されます">
        <Textarea
          value={listToText(v.banned_words)}
          onChange={(e) => set("banned_words", textToList(e.target.value))}
          rows={2}
        />
      </Field>

      <Field label="禁止表現" hint="言い回しレベルで避けたいもの">
        <Textarea
          value={listToText(v.banned_expressions)}
          onChange={(e) => set("banned_expressions", textToList(e.target.value))}
          rows={2}
        />
      </Field>

      <Field label="文体サンプル" hint="実際に自社らしいと感じる文章を貼ってください">
        <Textarea
          value={v.sample_text}
          onChange={(e) => set("sample_text", e.target.value)}
          rows={4}
        />
      </Field>

      {dirty && (
        <Button
          className="w-full"
          onClick={async () => {
            const res = await callApi("/api/setup", {
              action: "save_brand_voice",
              subjectId,
              ...v,
            });
            if (!res) return;
            toast("ブランド人格を保存しました");
            setDirty(false);
            router.refresh();
          }}
        >
          保存する
        </Button>
      )}
    </div>
  );
}

export function PersonaEditor({
  subjectId,
  personas,
}: {
  subjectId: string;
  personas: Array<{
    id: string;
    name: string;
    segment: string | null;
    role: string | null;
    pains: string[];
    gains: string[];
  }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", segment: "", role: "", pains: "", gains: "" });

  const textToList = (s: string) =>
    s
      .split(/[,、\n]/)
      .map((x) => x.trim())
      .filter(Boolean);

  return (
    <>
      {personas.length === 0 ? (
        <p className="muted text-xs">ターゲットが未設定です。</p>
      ) : (
        <ul className="space-y-3 mb-3">
          {personas.map((p) => (
            <li key={p.id} className="text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.name}</span>
                {p.segment && <Badge>{p.segment}</Badge>}
                <button
                  className="ml-auto muted hover:text-red-600"
                  onClick={async () => {
                    const res = await callApi("/api/setup", {
                      action: "delete_row",
                      table: "personas",
                      id: p.id,
                    });
                    if (!res) return;
                    toast("削除しました");
                    router.refresh();
                  }}
                >
                  削除
                </button>
              </div>
              {p.pains.length > 0 && <p className="muted mt-1">課題: {p.pains.join("、")}</p>}
              {p.gains.length > 0 && <p className="muted mt-0.5">価値: {p.gains.join("、")}</p>}
            </li>
          ))}
        </ul>
      )}

      <Button variant="secondary" size="sm" className="w-full" onClick={() => setOpen(true)}>
        ターゲットを追加
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="ターゲットを追加">
        <div className="space-y-4">
          <Field label="名称" required>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="宿泊施設の運営責任者"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="セグメント">
              <Input
                value={form.segment}
                onChange={(e) => setForm({ ...form, segment: e.target.value })}
                placeholder="中小規模の宿泊施設"
              />
            </Field>
            <Field label="役職・立場">
              <Input
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder="支配人"
              />
            </Field>
          </div>
          <Field label="抱えている課題" hint="読点区切り">
            <Textarea
              value={form.pains}
              onChange={(e) => setForm({ ...form, pains: e.target.value })}
              rows={2}
            />
          </Field>
          <Field label="求める価値" hint="読点区切り">
            <Textarea
              value={form.gains}
              onChange={(e) => setForm({ ...form, gains: e.target.value })}
              rows={2}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={async () => {
                if (!form.name) return toast("名称を入力してください", "err");
                const res = await callApi("/api/setup", {
                  action: "save_persona",
                  subjectId,
                  name: form.name,
                  segment: form.segment,
                  role: form.role,
                  pains: textToList(form.pains),
                  gains: textToList(form.gains),
                });
                if (!res) return;
                toast("追加しました");
                setOpen(false);
                setForm({ name: "", segment: "", role: "", pains: "", gains: "" });
                router.refresh();
              }}
            >
              追加する
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
