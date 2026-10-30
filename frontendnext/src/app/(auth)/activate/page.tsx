import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivateAccount } from "@/components/auth/activate-account";

export const metadata: Metadata = { title: "Activate your account" };

export default function ActivatePage() {
  return (
    <Suspense>
      <ActivateAccount />
    </Suspense>
  );
}
