import type { Metadata } from "next";
import { OnboardingView } from "@/components/companies/onboarding-view";

export const metadata: Metadata = { title: "Set up your company" };

// Logged in, but no company yet — no sidebar until it exists
export default function OnboardingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-4xl">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-lg font-semibold text-primary-foreground">S</div>
          <span className="text-xl font-semibold tracking-tight">Sangvya</span>
        </div>
        <OnboardingView />
      </div>
    </main>
  );
}
