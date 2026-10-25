"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRating({ value, onChange, readOnly = false }: { value: number | null; onChange?: (n: number) => void; readOnly?: boolean }) {
  return (
    <div className="flex gap-0.5" role={readOnly ? "img" : "radiogroup"} aria-label={`Rating ${value ?? 0} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= (value ?? 0);
        return readOnly ? (
          <Star key={n} className={cn("size-4", on ? "fill-warning text-warning" : "text-border")} />
        ) : (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => onChange?.(n)}
            className="rounded focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Star className={cn("size-5 transition-colors", on ? "fill-warning text-warning" : "text-border hover:text-warning/60")} />
          </button>
        );
      })}
    </div>
  );
}
