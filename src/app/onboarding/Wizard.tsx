"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Field,
  Input,
  Textarea,
  Select,
  Card,
  Badge,
  callApi,
  toast,
  ProgressBar,
} from "@/components/ui";
import { AgentIcon, SparkIcon } from "@/components/icons/AgentIcons";
import {
  AGENTS,
  GOALS,
  DIALOGUE_FREQUENCIES,
  CHANNELS,
  SUBJECT_TYPE_LABEL,
  SETUP_INCLUDES,
} from "@/lib/constants";

type Initial = {
  karte: Record<string, string>;
  persona: string;
  tone: string[];
  goals: string[];
};

const TONES = ["誠実", "落ち着いた", "専門的", "親しみやすい", "先進的", "丁寧", "簡潔", "情熱的"];

const STEPS = [
  { key: "welcome", label: "はじめに" },
  { key: "goals", label: "広報目的" },
  { key: "karte", label: "AI広報カルテ" },
  { key: "voice", label: "ブランド人格" },
  { key: "facts", label: "公式事実" },
  { key: "channels", label: "媒体・頻度" },
  { key: "line", label: "LINE連携" },
] as const;

export function OnboardingWizard({
  mode,
  subjectId,
  orgName,
  initial,
}: {
  mode: "create-org" | "setup";
  subjectId?: string;
  orgName?: string;
  initial?: Initial;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // 組織作成 (メール確認フローで戻ってきた場合)
  const [org, setOrg] = useState({ orgName: "", subjectName: "", subjectType: "company", website: "" });

  const [goals, setGoals] = useState<string[]>(initial?.goals ?? []);
  const [karte, setKarte] = useState<Record<string, string>>(initial?.karte ?? {});
  const [voice, setVoice] = useState({
    persona: initial?.persona ?? "",
    tone: initial?.tone ?? [],
    banned: "",
    firstPerson: "当社",
  });
  const [fact, setFact] = useState({ category: "pricing", key: "", value: "", source: "" });
  const [facts, setFacts] = useState<Array<{ key: string; value: string }>>([]);
  const [dialogue, setDialogue] = useState({ frequency: "daily", send_hour: 9 });
  const [channels, setChannels] = useState<Record<string, string>>({
    x: "ai_auto",
    instagram: "ai_auto",
    facebook: "ai_auto",
    gbp: "ai_auto",
    wordpress: "ai_auto",
  });
  const [linkCode, setLinkCode] = useState<string | null>(null);

  if (mode === "create-org") {
    return (
      <Shell step={0} total={1}>
        <h1 className="text-xl font-bold">広報対象を登録してください</h1>
        <p className="muted text-xs mt-1.5">AI広報部を立ち上げるための最初の設定です。</p>

        <div className="mt-6 space-y-4">
          <Field label="会社名・組織名" required>
            <Input
              value={org.orgName}
              onChange={(e) => setOrg({ ...org, orgName: e.target.value })}
              placeholder="株式会社◯◯"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="広報対象の名称">
              <Input
                value={org.subjectName}
                onChange={(e) => setOrg({ ...org, subjectName: e.target.value })}
                placeholder="自社"
              />
            </Field>
            <Field label="種別">
              <Select
                value={org.subjectType}
                onChange={(e) => setOrg({ ...org, subjectType: e.target.value })}
              >
                {Object.entries(SUBJECT_TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Webサイト">
            <Input
              value={org.website}
              onChange={(e) => setOrg({ ...org, website: e.target.value })}
              placeholder="https://example.com"
            />
          </Field>

          <Button
            size="lg"
            className="w-full"
            onClick={async () => {
              if (!org.orgName) return toast("会社名を入力してください", "err");
              const res = await callApi("/api/setup", { action: "create_org", ...org });
              if (!res) return;
              toast("登録しました");
              router.refresh();
            }}
          >
            登録して初期設定へ
          </Button>
        </div>
      </Shell>
    );
  }

  const current = STEPS[step];

  async function next() {
    // 各ステップで入力内容を保存してから進む
    if (current.key === "goals") {
      if (!goals.length) return toast("広報目的を1つ以上選んでください", "err");
      await callApi("/api/setup", { action: "save_objectives", subjectId, goals });
    }

    if (current.key === "karte") {
      for (const [key, content] of Object.entries(karte)) {
        if (!content?.trim()) continue;
        await callApi("/api/setup", { action: "save_karte", subjectId, key, content });
      }
    }

    if (current.key === "voice") {
      await callApi("/api/setup", {
        action: "save_brand_voice",
        subjectId,
        persona: voice.persona,
        tone: voice.tone,
        first_person: voice.firstPerson,
        banned_words: voice.banned
          .split(/[,、\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
      });
    }

    if (current.key === "channels") {
      for (const [type, frequency_mode] of Object.entries(channels)) {
        await callApi("/api/setup", { action: "save_channel", subjectId, type, frequency_mode });
      }
      await callApi("/api/setup", {
        action: "save_dialogue",
        subjectId,
        frequency: dialogue.frequency,
        send_hour: dialogue.send_hour,
      });
    }

    if (step === STEPS.length - 1) {
      await callApi("/api/setup", { action: "complete_onboarding" });
      toast("初期設定が完了しました");
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setStep((s) => s + 1);
  }

  return (
    <Shell step={step} total={STEPS.length}>
      <div className="flex items-center gap-2 mb-1">
        {STEPS.map((s, i) => (
          <span
            key={s.key}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= step ? "bg-brand-600" : "bg-[var(--surface-3)]"
            }`}
          />
        ))}
      </div>
      <p className="muted text-[11px] mb-5">
        ステップ {step + 1} / {STEPS.length} — {current.label}
      </p>

      {/* ------------------------------------------------------- welcome -- */}
      {current.key === "welcome" && (
        <div>
          <h1 className="text-xl font-bold">{orgName} のAI広報部を立ち上げます</h1>
          <p className="muted text-xs mt-2 leading-relaxed">
            初期設定では、AIが自社らしい発信を行うための土台を作ります。
            ここで登録した内容は、あとからいつでも修正できます。
          </p>

          <div className="mt-6 grid sm:grid-cols-2 gap-3">
            {AGENTS.map((a) => (
              <div key={a.key} className="card p-3.5 flex items-start gap-3">
                <span style={{ color: a.color }} className="shrink-0">
                  <AgentIcon agent={a.key} size={30} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="muted text-[11px] mt-0.5 leading-relaxed">{a.role}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 card p-4 bg-[var(--surface-2)]">
            <p className="text-xs font-medium mb-2">初期設定に含まれる作業</p>
            <div className="flex flex-wrap gap-1.5">
              {SETUP_INCLUDES.map((s) => (
                <Badge key={s}>{s}</Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- goals -- */}
      {current.key === "goals" && (
        <div>
          <h1 className="text-xl font-bold">何を達成したいですか</h1>
          <p className="muted text-xs mt-2 leading-relaxed">
            AI広報は投稿数を目的にしません。ここで選んだ目的から逆算して、
            KPI・媒体・コンテンツ・CTA・投稿頻度を決めます。優先順に選んでください。
          </p>

          <div className="mt-5 grid sm:grid-cols-2 gap-2">
            {GOALS.map((g) => {
              const idx = goals.indexOf(g.key);
              const on = idx >= 0;
              return (
                <button
                  key={g.key}
                  onClick={() =>
                    setGoals((prev) =>
                      on ? prev.filter((x) => x !== g.key) : [...prev, g.key],
                    )
                  }
                  className={`flex items-center gap-2.5 px-3.5 py-3 rounded-xl border text-left text-sm transition-all
                    ${on ? "border-brand-500 bg-brand-50 dark:bg-brand-900/25" : "border-[var(--border)] hover:border-brand-300"}`}
                >
                  <span
                    className={`h-5 w-5 shrink-0 rounded-full grid place-items-center text-[10px] font-bold
                      ${on ? "bg-brand-600 text-white" : "bg-[var(--surface-3)] muted"}`}
                  >
                    {on ? idx + 1 : ""}
                  </span>
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- karte -- */}
      {current.key === "karte" && (
        <div>
          <h1 className="text-xl font-bold">AI広報カルテ</h1>
          <p className="muted text-xs mt-2 leading-relaxed">
            AIが自社を理解するための情報です。すべて埋める必要はありません。
            空欄はAI秘書がLINEで少しずつ聞き取ります。
          </p>

          <div className="mt-5 space-y-4">
            {[
              { key: "philosophy", label: "企業理念", ph: "私たちが大切にしていること" },
              { key: "products", label: "商品・サービス", ph: "提供している商品やサービスの概要" },
              { key: "targets", label: "ターゲット", ph: "どんなお客様に届けたいか" },
              { key: "strengths", label: "強み", ph: "競合と比べて優れている点、選ばれる理由" },
              { key: "cases", label: "導入事例", ph: "実際の導入先や成果(公開可能なもの)" },
            ].map((f) => (
              <Field key={f.key} label={f.label}>
                <Textarea
                  value={karte[f.key] ?? ""}
                  onChange={(e) => setKarte({ ...karte, [f.key]: e.target.value })}
                  placeholder={f.ph}
                  rows={3}
                />
              </Field>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- voice -- */}
      {current.key === "voice" && (
        <div>
          <h1 className="text-xl font-bold">ブランド人格・文章トーン</h1>
          <p className="muted text-xs mt-2 leading-relaxed">
            AIライターが「自社らしい文章」を書くための設定です。
            一般的なAI文章にならないよう、文体と禁止表現を決めます。
          </p>

          <div className="mt-5 space-y-4">
            <Field label="ブランド人格" hint="どんな人が話しているように見せたいか">
              <Input
                value={voice.persona}
                onChange={(e) => setVoice({ ...voice, persona: e.target.value })}
                placeholder="誠実で落ち着いた、現場を知る専門家"
              />
            </Field>

            <Field label="文章トーン" hint="複数選択できます">
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((t) => {
                  const on = voice.tone.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() =>
                        setVoice({
                          ...voice,
                          tone: on ? voice.tone.filter((x) => x !== t) : [...voice.tone, t],
                        })
                      }
                      className={`px-3 py-1.5 rounded-lg border text-xs transition-colors
                        ${on ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200" : "border-[var(--border)] muted hover:border-brand-300"}`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="一人称">
              <Input
                value={voice.firstPerson}
                onChange={(e) => setVoice({ ...voice, firstPerson: e.target.value })}
                placeholder="当社 / 私たち / 弊社"
              />
            </Field>

            <Field label="禁止表現" hint="読点・改行区切り。ここに入れた表現は投稿前チェックで必ず検出されます。">
              <Textarea
                value={voice.banned}
                onChange={(e) => setVoice({ ...voice, banned: e.target.value })}
                placeholder="業界No.1、絶対に、圧倒的"
                rows={2}
              />
            </Field>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- facts -- */}
      {current.key === "facts" && (
        <div>
          <h1 className="text-xl font-bold">公式事実データベース</h1>
          <p className="muted text-xs mt-2 leading-relaxed">
            AIが断定してよい数値・事実を登録します。ここに無い数字は「未確認」として警告され、
            確認が取れるまで投稿されません。あとから追加できます。
          </p>

          <div className="mt-5 grid sm:grid-cols-[9rem_1fr] gap-3">
            <Select
              value={fact.category}
              onChange={(e) => setFact({ ...fact, category: e.target.value })}
            >
              <option value="pricing">料金</option>
              <option value="product">商品・機能</option>
              <option value="clients">導入実績</option>
              <option value="area">対応地域</option>
              <option value="leader">代表者情報</option>
              <option value="metric">数値</option>
              <option value="award">受賞歴</option>
              <option value="other">その他</option>
            </Select>
            <Input
              value={fact.key}
              onChange={(e) => setFact({ ...fact, key: e.target.value })}
              placeholder="項目名 (例: 月額料金)"
            />
            <Input
              value={fact.value}
              onChange={(e) => setFact({ ...fact, value: e.target.value })}
              placeholder="値 (例: 39,800円)"
              className="sm:col-span-1"
            />
            <div className="flex gap-2">
              <Input
                value={fact.source}
                onChange={(e) => setFact({ ...fact, source: e.target.value })}
                placeholder="出典 (任意)"
              />
              <Button
                variant="secondary"
                onClick={async () => {
                  if (!fact.key || !fact.value) return toast("項目名と値を入力してください", "err");
                  const res = await callApi("/api/setup", { action: "save_fact", subjectId, ...fact });
                  if (!res) return;
                  setFacts((f) => [...f, { key: fact.key, value: fact.value }]);
                  setFact({ category: fact.category, key: "", value: "", source: "" });
                  toast("登録しました");
                }}
              >
                追加
              </Button>
            </div>
          </div>

          {facts.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {facts.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-xs card p-2.5">
                  <span className="font-medium">{f.key}</span>
                  <span className="muted">=</span>
                  <span>{f.value}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ------------------------------------------------------ channels -- */}
      {current.key === "channels" && (
        <div>
          <h1 className="text-xl font-bold">対話頻度と投稿頻度</h1>
          <p className="muted text-xs mt-2 leading-relaxed">
            AI秘書がヒアリングする頻度と、媒体ごとの投稿頻度を設定します。
            「AIに任せる」を選ぶと、目的・素材の量・過去の成果から最適な頻度を提案します。
          </p>

          <div className="mt-5 space-y-4">
            <Field label="AI秘書からのヒアリング頻度">
              <Select
                value={dialogue.frequency}
                onChange={(e) => setDialogue({ ...dialogue, frequency: e.target.value })}
              >
                {DIALOGUE_FREQUENCIES.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="ヒアリングを送る時刻">
              <Select
                value={String(dialogue.send_hour)}
                onChange={(e) => setDialogue({ ...dialogue, send_hour: Number(e.target.value) })}
              >
                {Array.from({ length: 15 }, (_, i) => i + 7).map((h) => (
                  <option key={h} value={h}>
                    {h}:00
                  </option>
                ))}
              </Select>
            </Field>

            <div>
              <p className="text-xs font-medium mb-2">媒体ごとの投稿頻度</p>
              <div className="space-y-2">
                {CHANNELS.filter((c) =>
                  ["x", "instagram", "facebook", "gbp", "wordpress"].includes(c.key),
                ).map((c) => (
                  <div key={c.key} className="grid grid-cols-[1fr_10rem] items-center gap-3">
                    <span className="text-sm truncate">{c.label}</span>
                    <Select
                      value={channels[c.key] ?? "ai_auto"}
                      onChange={(e) => setChannels({ ...channels, [c.key]: e.target.value })}
                    >
                      <option value="ai_auto">AIに任せる</option>
                      <option value="daily">毎日</option>
                      <option value="weekly_n">週○回</option>
                      <option value="monthly_n">月○回</option>
                      <option value="on_demand">必要なときだけ</option>
                      <option value="never">投稿しない</option>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------- line -- */}
      {current.key === "line" && (
        <div>
          <h1 className="text-xl font-bold">LINEを連携する</h1>
          <p className="muted text-xs mt-2 leading-relaxed">
            AI広報部の窓口はLINEです。連携コードを発行して、公式アカウントのトークに送信してください。
            以降は、出来事を一言送るだけで広報が回ります。
          </p>

          <div className="mt-6 card p-6 text-center bg-[var(--surface-2)]">
            {linkCode ? (
              <>
                <p className="muted text-xs">連携コード</p>
                <p className="mt-2 text-4xl font-bold tracking-[0.3em] tabular-nums">{linkCode}</p>
                <p className="muted text-xs mt-3 leading-relaxed">
                  このコードをLINEのトークに送信すると連携が完了します。
                  <br />
                  有効期限は3日間です。
                </p>
              </>
            ) : (
              <>
                <span className="text-brand-600 inline-block">
                  <SparkIcon size={32} />
                </span>
                <p className="text-sm mt-3">連携コードを発行してください</p>
                <Button
                  className="mt-4"
                  onClick={async () => {
                    const res = await callApi<{ code: string }>("/api/setup", {
                      action: "create_link_code",
                    });
                    if (res?.code) setLinkCode(res.code);
                  }}
                >
                  連携コードを発行
                </Button>
              </>
            )}
          </div>

          <p className="muted text-[11px] mt-4 leading-relaxed">
            LINE連携はあとからでも設定できます。設定画面 → LINE連携 から同じ操作が可能です。
          </p>
        </div>
      )}

      {/* ------------------------------------------------------- controls - */}
      <div className="mt-8 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          戻る
        </Button>
        <div className="flex gap-2">
          {step > 0 && step < STEPS.length - 1 && (
            <Button variant="ghost" onClick={() => setStep((s) => s + 1)}>
              スキップ
            </Button>
          )}
          <Button onClick={next}>
            {step === STEPS.length - 1 ? "設定を完了する" : "保存して次へ"}
          </Button>
        </div>
      </div>
    </Shell>
  );
}

function Shell({
  children,
  step,
  total,
}: {
  children: React.ReactNode;
  step: number;
  total: number;
}) {
  return (
    <main className="min-h-dvh py-10 px-5 relative">
      <div className="absolute inset-0 aurora" aria-hidden />
      <div className="relative mx-auto max-w-2xl">
        <div className="flex items-center justify-center gap-2 font-bold mb-6">
          <span className="text-brand-600">
            <SparkIcon size={20} />
          </span>
          AI広報
        </div>
        <Card className="p-6 sm:p-8">{children}</Card>
        {total > 1 && (
          <div className="mt-4">
            <ProgressBar value={((step + 1) / total) * 100} />
          </div>
        )}
      </div>
    </main>
  );
}
