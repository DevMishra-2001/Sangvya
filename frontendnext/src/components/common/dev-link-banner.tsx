"use client";

import { Copy, ExternalLink, FlaskConical, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export interface DevLink {
  name: string;
  email: string;
  link: string;
}

// An activation link the API returned outside production, so invites can be
// tested without email
export function DevLinkBanner({ devLink, onClose }: { devLink: DevLink; onClose: () => void }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(devLink.link);
      toast.success("Activation link copied");
    } catch {
      toast.error("Couldn't copy — select the link and copy it");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-warning/60 bg-warning/10 p-4 text-sm sm:flex-row sm:items-center">
      <FlaskConical className="size-5 shrink-0 text-warning" />
      <div className="min-w-0 flex-1">
        <div className="font-medium">
          Activation link for {devLink.name} <span className="font-normal text-muted-foreground">· shown only outside production</span>
        </div>
        <div className="mt-1 truncate font-mono text-xs text-muted-foreground" title={devLink.link}>
          {devLink.link}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" onClick={copy}>
          <Copy /> Copy
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href={devLink.link} target="_blank" rel="noreferrer">
            <ExternalLink /> Open
          </a>
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Hide link">
          <X />
        </Button>
      </div>
    </div>
  );
}
