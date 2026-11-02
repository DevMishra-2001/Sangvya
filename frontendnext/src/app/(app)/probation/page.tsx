import type { Metadata } from "next";
import { Suspense } from "react";
import { ProbationView } from "@/components/probation/probation-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Probation" };

export default function Page() {
  return (
    <PageGate>
      {/* Reads filters / page from the URL */}
      <Suspense>
        <ProbationView />
      </Suspense>
    </PageGate>
  );
}
