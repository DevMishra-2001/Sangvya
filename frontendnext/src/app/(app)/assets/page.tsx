import type { Metadata } from "next";
import { Suspense } from "react";
import { AssetsView } from "@/components/assets/assets-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Assets" };

export default function Page() {
  return (
    <PageGate>
      {/* Reads filters / page from the URL */}
      <Suspense>
        <AssetsView />
      </Suspense>
    </PageGate>
  );
}
