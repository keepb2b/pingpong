"use client";

import { useEffect, useRef, useState } from "react";

const MESSAGES = [
  { side: "ai" as const, text: "本日、広報に使えそうな出来事はありますか？" },
  { side: "me" as const, text: "ROOMKEYを新しい施設へ導入することが決まりました" },
  { side: "ai" as const, text: "導入先の名称は公開してもよろしいですか？" },
  { side: "me" as const, text: "はい、大丈夫です" },
  { side: "ai" as const, text: "導入を決めた理由を一言で教えていただけますか？" },
];

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function SecretaryChatDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState<"ai" | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(MESSAGES.length);
      setTyping(null);
      return;
    }

    let cancelled = false;

    async function play() {
      while (!cancelled) {
        setShown(0);
        setTyping(null);
        await wait(280);
        if (cancelled) return;

        for (let i = 0; i < MESSAGES.length; i++) {
          if (cancelled) return;
          if (MESSAGES[i].side === "ai") {
            setTyping("ai");
            await wait(820);
            if (cancelled) return;
            setTyping(null);
          } else {
            await wait(720);
          }
          setShown(i + 1);
          await wait(640);
        }

        await wait(2600);
      }
    }

    void play();
    return () => {
      cancelled = true;
    };
  }, [inView]);

  return (
    <div ref={rootRef} className="p-4 space-y-2.5 bg-[var(--surface-2)] min-h-[228px]">
      {MESSAGES.slice(0, shown).map((m, i) => (
        <Bubble key={`${i}-${m.text}`} side={m.side}>
          {m.text}
        </Bubble>
      ))}
      {typing === "ai" ? <TypingBubble /> : null}
    </div>
  );
}

function Avatar({ side }: { side: "ai" | "me" }) {
  const isAi = side === "ai";
  return (
    <img
      src={isAi ? "/images/chat/secretary.png" : "/images/chat/user.png"}
      alt={isAi ? "AI秘書" : "担当者"}
      width={32}
      height={32}
      className="h-8 w-8 shrink-0 rounded-full object-cover bg-[var(--surface)] ring-1 ring-[var(--border)]"
      decoding="async"
      suppressHydrationWarning
    />
  );
}

function Bubble({ children, side }: { children: React.ReactNode; side: "ai" | "me" }) {
  const isAi = side === "ai";
  return (
    <div className={`flex items-end gap-2 ${isAi ? "justify-start" : "justify-end"}`}>
      {isAi ? <Avatar side="ai" /> : null}
      <div
        className={`max-w-[72%] px-3 py-2 text-[12.5px] leading-relaxed rounded-xl border chat-bubble-in ${
          isAi
            ? "bg-[var(--surface)] border-[var(--border)] chat-bubble-in-left"
            : "bg-[#e4efe0] border-[#bcd9b3] dark:bg-[#1e3a1c] dark:border-[#2f5c2b] chat-bubble-in-right"
        }`}
      >
        {children}
      </div>
      {isAi ? null : <Avatar side="me" />}
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-end gap-2 justify-start">
      <Avatar side="ai" />
      <div className="px-3 py-2.5 rounded-xl border bg-[var(--surface)] border-[var(--border)] chat-bubble-in chat-bubble-in-left">
        <span className="inline-flex items-center gap-1 h-3.5" aria-hidden>
          <span className="chat-typing-dot" />
          <span className="chat-typing-dot" style={{ animationDelay: "0.16s" }} />
          <span className="chat-typing-dot" style={{ animationDelay: "0.32s" }} />
        </span>
        <span className="sr-only">入力中</span>
      </div>
    </div>
  );
}
