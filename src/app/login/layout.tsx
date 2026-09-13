import { PublicShell } from "@/components/dashboard/PublicShell";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
