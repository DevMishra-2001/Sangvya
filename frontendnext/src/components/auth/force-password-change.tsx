"use client";

// Temporary password after a page refresh: the same frame as login, so it looks like the login card's back side
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { AuthFrame } from "./auth-frame";
import { SetOwnPassword } from "./set-own-password";

export function ForcePasswordChange({ name }: { name: string }) {
  const router = useRouter();
  const loadMe = useAuthStore((s) => s.loadMe);
  return (
    <AuthFrame>
      <SetOwnPassword name={name} onDone={() => void loadMe()} onLoggedOut={() => router.replace("/login")} />
    </AuthFrame>
  );
}
