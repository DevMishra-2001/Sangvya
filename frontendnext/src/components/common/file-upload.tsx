"use client";

// One picker for every upload: images, PDFs, documents. The caller passes what to accept and how to upload.
//   <FileUpload variant="avatar" accept="image" value={url} upload={(f, p) => uploadService.image(f, "employee-photo", f.name, p).then((r) => r.url)} onChange={setUrl} />
//   <FileUpload variant="dropzone" accept="document" upload={(f, p) => employeesService.uploadDocument(id, f, meta, p)} />
import { useRef, useState } from "react";
import { FileUp, ImagePlus, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export const ACCEPT = {
  image: "image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/heic,image/heif",
  document: "application/pdf,image/jpeg,image/png,image/webp,.doc,.docx",
} as const;
const DEFAULT_HINT = { image: "PNG, JPG, WebP or SVG, up to 5 MB.", document: "PDF, image or Word file, up to 10 MB." };

export interface FileUploadProps {
  upload: (file: File, onProgress: (percent: number) => void) => Promise<string | null | void>; // may return a preview URL
  accept?: keyof typeof ACCEPT | string; // "image" | "document" | a custom accept list
  maxSizeMB?: number;
  variant?: "avatar" | "tile" | "dropzone";
  value?: string | null; // current image preview
  onChange?: (url: string | null) => void; // gets the URL the upload returned (or null on remove)
  removable?: boolean;
  id?: string;
  label?: string;
  title?: string; // dropzone heading
  hint?: string;
  disabled?: boolean;
  className?: string;
  onUploadingChange?: (uploading: boolean) => void;
}

// Does the file match an accept list like "image/png,.pdf,image/*"?
function accepts(list: string, file: File) {
  const name = file.name.toLowerCase();
  return list.split(",").some((rule) => {
    const r = rule.trim().toLowerCase();
    if (r.startsWith(".")) return name.endsWith(r);
    if (r.endsWith("/*")) return file.type.startsWith(r.slice(0, -1));
    return file.type === r;
  });
}

export function FileUpload({
  upload,
  accept = "document",
  maxSizeMB,
  variant = "dropzone",
  value,
  onChange,
  removable = true,
  id,
  label,
  title,
  hint,
  disabled,
  className,
  onUploadingChange,
}: FileUploadProps) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const uploading = progress !== null;
  const acceptList = accept in ACCEPT ? ACCEPT[accept as keyof typeof ACCEPT] : accept;
  const isImage = accept === "image";
  const limitMB = maxSizeMB ?? (isImage ? 5 : 10);
  const help = hint ?? (accept in DEFAULT_HINT ? DEFAULT_HINT[accept as keyof typeof DEFAULT_HINT] : `Up to ${limitMB} MB.`);

  async function pick(file: File | undefined) {
    if (!file || disabled || uploading) return;
    if (!accepts(acceptList, file)) return toast.error(isImage ? "Choose an image file" : "This file type isn't allowed");
    if (file.size > limitMB * 1024 * 1024) return toast.error(`The file must be ${limitMB} MB or smaller`);
    setProgress(0);
    onUploadingChange?.(true);
    try {
      const url = await upload(file, setProgress);
      if (typeof url === "string") onChange?.(url);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't upload the file"));
    } finally {
      setProgress(null);
      onUploadingChange?.(false);
      if (input.current) input.current.value = "";
    }
  }

  const open = () => input.current?.click();
  const dropProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      pick(e.dataTransfer.files[0]);
    },
  };
  const overlay = uploading && (
    <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/80 text-xs font-medium text-foreground">
      <Spinner />
      {progress}%
    </span>
  );
  const fileInput = (
    <input
      ref={input}
      id={id}
      type="file"
      accept={acceptList}
      className="sr-only"
      tabIndex={-1}
      onChange={(e) => pick(e.target.files?.[0])}
    />
  );

  if (variant === "dropzone") {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={open}
          {...dropProps}
          disabled={disabled || uploading}
          aria-label={label ?? title ?? "Upload a file"}
          className={cn(
            "relative flex w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-5 text-center transition-colors hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-70",
            dragging && "border-primary bg-primary/5",
          )}
        >
          <FileUp className="size-5 text-muted-foreground" />
          <span className="text-sm font-medium">{title ?? "Drop a file here or click to choose"}</span>
          <span className="text-xs text-muted-foreground">{help}</span>
          {overlay}
        </button>
        {fileInput}
      </div>
    );
  }

  const round = variant === "avatar";
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <button
        type="button"
        onClick={open}
        {...dropProps}
        disabled={disabled || uploading}
        aria-label={label ?? "Upload image"}
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden border-2 border-dashed border-border bg-muted/40 text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-70",
          round ? "size-24 rounded-full" : "size-20 rounded-xl",
          dragging && "border-primary",
        )}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- ImageKit already serves an optimised file
          <img src={value} alt="" className={cn("size-full", round ? "object-cover" : "object-contain")} />
        ) : round ? (
          <User className="size-8" />
        ) : (
          <ImagePlus className="size-6" />
        )}
        {overlay}
      </button>
      <div className="flex flex-col items-start gap-1.5">
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={open} disabled={disabled || uploading}>
            {value ? "Change" : (title ?? "Upload")}
          </Button>
          {value && removable && onChange && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} disabled={disabled || uploading} aria-label="Remove image">
              <Trash2 /> Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{help}</p>
      </div>
      {fileInput}
    </div>
  );
}
