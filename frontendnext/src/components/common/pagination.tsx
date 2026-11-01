"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { SelectField } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const PAGE_SIZES = [10, 20, 50, 100];

// 1 … 4 5 6 … 12
function pageList(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pages - 1, page + 1);
  if (from > 2) out.push("…");
  for (let i = from; i <= to; i++) out.push(i);
  if (to < pages - 1) out.push("…");
  out.push(pages);
  return out;
}

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  className?: string;
}

// "Showing 21–40 of 143" · rows per page · ‹ 1 … 4 5 6 … 12 ›
export function Pagination({ page, limit, total, onPageChange, onLimitChange, className }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const from = total ? (page - 1) * limit + 1 : 0;
  const to = Math.min(total, page * limit);
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm", className)}>
      <p className="text-muted-foreground tabular-nums">
        {total ? (
          <>
            Showing <span className="font-medium text-foreground">{from}–{to}</span> of <span className="font-medium text-foreground">{total}</span>
          </>
        ) : (
          "No results"
        )}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {onLimitChange && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="hidden sm:inline">Rows</span>
            <SelectField
              className="h-8 w-20"
              value={String(limit)}
              onValueChange={(v) => onLimitChange(Number(v))}
              options={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
              aria-label="Rows per page"
            />
          </div>
        )}
        <nav className="flex items-center gap-1" aria-label="Pages">
          <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
            <ChevronLeft />
          </Button>
          {pageList(page, pages).map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="px-1 text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === page ? "default" : "ghost"}
                size="icon-sm"
                className="tabular-nums"
                onClick={() => p !== page && onPageChange(p)}
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
              >
                {p}
              </Button>
            ),
          )}
          <Button variant="outline" size="icon-sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
            <ChevronRight />
          </Button>
        </nav>
      </div>
    </div>
  );
}
