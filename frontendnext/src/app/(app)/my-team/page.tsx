import type { Metadata } from "next";
import { PageGate } from "@/components/layout/page-gate";
import { MyTeamView } from "@/components/team/my-team-view";

export const metadata: Metadata = { title: "My Team" };

export default function Page() {
  return (
    <PageGate>
      <MyTeamView />
    </PageGate>
  );
}
