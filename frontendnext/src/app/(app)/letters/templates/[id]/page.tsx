import { Suspense } from "react";
import type { Metadata } from "next";
import { TemplateEditorView } from "@/components/letters/template-editor-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Letter Template" };

// The id is only known per request, so this page renders on request
export const instant = false;

export default async function Page({ params }: PageProps<"/letters/templates/[id]">) {
  const { id } = await params;
  return (
    <PageGate>
      <Suspense>
        <TemplateEditorView id={id} />
      </Suspense>
    </PageGate>
  );
}
