import type { Metadata } from "next";
import { OnboardingView } from "@/components/companies/onboarding-view";

export const metadata: Metadata = { title: "Set up your company" };

// Logged in, but no company yet — a full-width light page, no sidebar until it exists
export default function OnboardingPage() {
  return <OnboardingView />;
}
