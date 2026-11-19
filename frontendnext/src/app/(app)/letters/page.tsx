import { Suspense } from "react";
import type { Metadata } from "next";
import { LettersRegisterView } from "@/components/letters/letters-register-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "HR Letters" };

export default function Page() {
  return (
    <PageGate>
      <Suspense>
        <LettersRegisterView />
      </Suspense>
    </PageGate>
  );
}
