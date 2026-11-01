"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Reads and writes the page's query string (?page=2&limit=20&search=…) so lists survive refresh, back and share
export function useUrlParams() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const get = useCallback((key: string, fallback = "") => params.get(key) ?? fallback, [params]);
  const getNumber = useCallback((key: string, fallback: number) => {
    const n = Number(params.get(key));
    return Number.isInteger(n) && n > 0 ? n : fallback;
  }, [params]);

  // null / "" removes the key
  const set = useCallback(
    (updates: Record<string, string | number | null | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === undefined || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, router, pathname],
  );

  return { get, getNumber, set };
}
