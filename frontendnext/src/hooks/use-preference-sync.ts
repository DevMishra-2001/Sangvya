"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { ACCENTS, type Accent } from "@/lib/appearance";
import { useAppearanceStore } from "@/stores/appearance-store";
import { useAuthStore } from "@/stores/auth-store";

// Applies the theme and accent saved on the account (this browser's copy is only a fast first paint)
export function usePreferenceSync() {
  const theme = useAuthStore((s) => s.user?.theme);
  const accent = useAuthStore((s) => s.user?.accent);
  const { setTheme } = useTheme();
  const setAccent = useAppearanceStore((s) => s.setAccent);

  useEffect(() => {
    if (theme) setTheme(theme);
  }, [theme, setTheme]);

  useEffect(() => {
    if (accent && ACCENTS.some((a) => a.key === accent)) setAccent(accent as Accent);
  }, [accent, setAccent]);
}
