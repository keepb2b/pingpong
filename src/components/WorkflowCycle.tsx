import { AGENTS } from "@/lib/constants";
import { AgentIcon, ShieldCheckIcon, LoopIcon } from "@/components/icons/AgentIcons";
import styles from "./WorkflowCycle.module.css";

const steps = [
  { label: "情報収集", agent: "secretary" },
  { label: "AI取材", agent: "secretary" },
  { label: "戦略判断", agent: "strategist" },
  { label: "コンテンツ制作", agent: "writer" },
  { label: "リスク確認", agent: "analyst" },
  { label: "ユーザー承認", agent: "secretary" },
  { label: "投稿・配信", agent: "marketer" },
  { label: "売上計測", agent: "analyst" },
  { label: "学習・改善", agent: "strategist" },
] as const;

export function WorkflowCycle() {
  return (
    <ol className={styles.workflow} aria-label="広報活動の9つのステップ">
      {steps.map((step, index) => (
        <li className={styles.step} key={step.label}>
          <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
          <div className={styles.inner}>
            <span className={styles.icon}>
              {index === 4 ? <ShieldCheckIcon size={32} /> : index === 8 ? <LoopIcon size={32} /> : <AgentIcon agent={step.agent} size={32} />}
            </span>
            <p className={styles.label}>{step.label}</p>
            <p className={styles.agent}>{AGENTS.find((agent) => agent.key === step.agent)?.name}</p>
          </div>
          {index < steps.length - 1 && <span className={styles.arrow} aria-hidden="true">→</span>}
        </li>
      ))}
    </ol>
  );
}
