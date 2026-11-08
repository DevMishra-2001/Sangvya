import type { Metadata } from "next";
import { PageGate } from "@/components/layout/page-gate";
import { BroadcastView } from "@/components/platform/broadcast-view";

export const metadata: Metadata = { title: "Broadcast" };

export default function Page() {
  return (
    <PageGate>
      <BroadcastView />
    </PageGate>
  );
}
