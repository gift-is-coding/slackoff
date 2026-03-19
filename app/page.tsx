import { CommandCenter } from "@/components/command-center";
import { getDashboardSnapshot } from "@/lib/slackoff/dashboard";

export default function Home() {
  const snapshot = getDashboardSnapshot();

  return <CommandCenter snapshot={snapshot} />;
}
