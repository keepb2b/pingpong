import Image from "next/image";
import { AgentIcon } from "@/components/icons/AgentIcons";
import type { AgentKey } from "@/lib/constants";
import styles from "./AgentsTeam.module.css";

const members: { key: AgentKey; name: string; title: string; body: string }[] = [
  { key: "secretary", name: "AI秘書", title: "情報を集め、広報部を動かす。", body: "LINEでのヒアリングを通じて、必要な情報を整理し、承認やスケジュール管理までスムーズに進行します。" },
  { key: "strategist", name: "AIストラテジスト", title: "広報の「方向」を決める。", body: "企業・市場・競合・ターゲットを分析し、最適な発信戦略を設計します。" },
  { key: "writer", name: "AIライター", title: "伝わる「言葉」をつくる。", body: "企業やブランドを理解し、目的に合わせた記事・PR・SNSコンテンツを制作します。" },
  { key: "creator", name: "AIクリエイター", title: "ブランドを「魅せる」。", body: "SNS画像、バナー、サムネイルなど、ブランドに合ったクリエイティブを制作します。" },
  { key: "marketer", name: "AIマーケター", title: "必要な人へ「届ける」。", body: "配信タイミングや媒体、CTAを最適化し、コンテンツの成果を高めます。" },
  { key: "analyst", name: "AIアナリスト", title: "成果を読み、次へつなげる。", body: "PV、流入、SNS、CVなどを分析し、次の広報施策へフィードバックします。" },
];

export function AgentsTeam() {
  return (
    <div className={styles.team}>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>AI PR TEAM</p>
        <h2 id="agents-heading">6人の専門AIが、ひとつの広報チームになる。</h2>
        <p className={styles.intro}>情報を集める。戦略を考える。言葉をつくる。<br />魅せる。届ける。そして、成果から次の一手を考える。</p>
      </header>
      <div className={styles.scene}>
        <div className={styles.orbit} aria-hidden="true" />
        <div className={styles.center}>
          <p className={styles.centerTitle}>AI広報部</p>
          <p>6人の専門AIが連携し、<br />あなたの広報活動を<br />一気通貫で支援します。</p>
        </div>
        <ul className={styles.members}>
          {members.map((member) => (
            <li key={member.key} className={`${styles.member} ${styles[member.key]}`}>
              <div className={styles.illustration}>
                <Image src={`/images/ai-team/${member.key}.png`} alt="" fill sizes="(max-width: 767px) 150px, 220px" />
              </div>
              <div className={styles.copy}>
              <p className={styles.badge}><AgentIcon agent={member.key} size={17} /><span>{member.name}</span></p>
              <h3>{member.title}</h3>
              <p className={styles.body}>{member.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
