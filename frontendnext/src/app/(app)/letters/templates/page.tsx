import { Suspense } from "react";
import type { Metadata } from "next";
import { TemplatesView } from "@/components/letters/templates-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Letter Templates" };

export default function Page() {
  return (
    <PageGate>
      <Suspense>
        <TemplatesView />
      </Suspense>
    </PageGate>
  );
}
