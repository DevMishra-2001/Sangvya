import type { Metadata } from "next";
import { RecruitmentView } from "@/components/recruitment/recruitment-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Recruitment" };

export default function Page() {
  return (
    <PageGate>
      <RecruitmentView />
    </PageGate>
  );
}
