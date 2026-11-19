import { Suspense } from "react";
import type { Metadata } from "next";
import { MyLettersView } from "@/components/letters/letters-register-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "My Letters" };

export default function Page() {
  return (
    <PageGate>
      <Suspense>
        <MyLettersView />
      </Suspense>
    </PageGate>
  );
}
