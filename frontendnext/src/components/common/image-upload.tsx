"use client";

// Pick an image → uploads it to /api/upload (ImageKit) → gives back its URL.
//   <ImageUpload kind="company-logo" value={logoUrl} onChange={setLogoUrl} />
import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage } from "@/lib/api/client";
import { IMAGE_ACCEPT, MAX_IMAGE_BYTES, uploadService, type UploadKind } from "@/lib/services/upload";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  kind: UploadKind;
  value: string | null;
  onChange: (url: string | null) => void;
  id?: string;
  label?: string; // accessible name of the picker
  hint?: string;
  disabled?: boolean;
  className?: string;
  // Lets a parent form block submit while a file is still uploading
  onUploadingChange?: (uploading: boolean) => void;
}

export function ImageUpload({ kind, value, onChange, id, label = "Upload image", hint, disabled, className, onUploadingChange }: ImageUploadProps) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const uploading = progress !== null;

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Choose an image file");
    if (file.size > MAX_IMAGE_BYTES) return toast.error("Image must be 5 MB or smaller");
    setProgress(0);
    onUploadingChange?.(true);
    try {
      const result = await uploadService.image(file, kind, file.name, setProgress);
      onChange(result.url);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't upload the image"));
    } finally {
      setProgress(null);
      onUploadingChange?.(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file && !disabled && !uploading) upload(file);
        }}
        disabled={disabled || uploading}
        aria-label={label}
        className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/40 text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-70"
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- ImageKit already serves an optimised file
          <img src={value} alt="" className="size-full object-contain" />
        ) : (
          <ImagePlus className="size-6" />
        )}
        {uploading && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/80 text-xs font-medium text-foreground">
            <Spinner />
            {progress}%
          </span>
        )}
      </button>
      <div className="flex flex-col items-start gap-1.5">
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={disabled || uploading}>
            {value ? "Change" : "Upload"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} disabled={disabled || uploading} aria-label="Remove image">
              <Trash2 /> Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{hint ?? "PNG, JPG, WebP or SVG, up to 5 MB."}</p>
      </div>
      <input
        ref={input}
        id={id}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
    </div>
  );
}
