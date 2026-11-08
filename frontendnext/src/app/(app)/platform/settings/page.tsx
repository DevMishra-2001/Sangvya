import type { Metadata } from "next";
import { PageGate } from "@/components/layout/page-gate";
import { PlatformSettingsView } from "@/components/platform/platform-settings-view";

export const metadata: Metadata = { title: "Platform settings" };

export default function Page() {
  return (
    <PageGate>
      <PlatformSettingsView />
    </PageGate>
  );
}
