// The company's uploaded logo, or its first letter when there isn't one
import { cn } from "@/lib/utils";

export function CompanyLogo({ name, logoUrl, className }: { name: string; logoUrl?: string | null; className?: string }) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- ImageKit already serves an optimised file
      <img src={logoUrl} alt={`${name} logo`} className={cn("size-8 shrink-0 rounded-lg bg-white object-contain", className)} />
    );
  }
  return (
    <div
      aria-hidden
      className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-base font-semibold text-primary-foreground shadow-sm", className)}
    >
      {name.trim().charAt(0).toUpperCase() || "S"}
    </div>
  );
}
