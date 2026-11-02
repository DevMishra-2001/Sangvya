import type { Metadata } from "next";
import { Suspense } from "react";
import { ExitsView } from "@/components/exits/exits-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Exits" };

export default function Page() {
  return (
    <PageGate>
      {/* Reads filters / page from the URL */}
      <Suspense>
        <ExitsView />
      </Suspense>
    </PageGate>
  );
}
