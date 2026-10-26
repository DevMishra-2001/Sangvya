import type { Metadata } from "next";
import Link from "next/link";
import { ShieldX } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "No access" };

// proxy.ts sends users here when their role can't open a page
export default function ForbiddenPage() {
  return (
    <EmptyState
      icon={ShieldX}
      title="You don't have access to this page"
      description="Your designation doesn't include this page. Ask your HR or company admin if you think you should."
      action={
        <Button asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
      }
    />
  );
}
