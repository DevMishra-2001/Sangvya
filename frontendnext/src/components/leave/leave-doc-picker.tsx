"use client";

// Supporting documents for a leave request (e.g. a medical certificate) — uploaded right away
import { useRef, useState } from "react";
import { FileUp, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { run } from "@/lib/api/run";
import { leavesService } from "@/lib/services/leaves";

type Doc = { path: string; name: string };

export function LeaveDocPicker({ files, onChange, hint }: { files: Doc[]; onChange: (f: Doc[]) => void; hint?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    const added: Doc[] = [];
    for (const f of Array.from(list).slice(0, 5 - files.length)) {
      const r = await run(() => leavesService.upload(f));
      if (r.ok) added.push(r.data);
    }
    setBusy(false);
    onChange([...files, ...added]);
    if (ref.current) ref.current.value = "";
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={ref} type="file" multiple accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={(e) => pick(e.target.files)} />
      <Button type="button" variant="secondary" size="sm" disabled={busy || files.length >= 5} onClick={() => ref.current?.click()}>
        {busy ? <Spinner /> : <FileUp />} Attach document
      </Button>
      {files.map((f, i) => (
        <span key={f.path} className="flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-xs">
          <Paperclip className="size-3" /> <span className="max-w-40 truncate">{f.name}</span>
          <button type="button" aria-label={`Remove ${f.name}`} className="text-muted-foreground hover:text-destructive" onClick={() => onChange(files.filter((_, j) => j !== i))}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
