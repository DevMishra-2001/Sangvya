"use client";

// Image picker that uploads to /api/upload — a FileUpload preset kept for existing forms
//   <ImageUpload kind="company-logo" value={logoUrl} onChange={setLogoUrl} />
import { uploadService, type UploadKind } from "@/lib/services/upload";
import { FileUpload } from "./file-upload";

interface ImageUploadProps {
  kind: UploadKind;
  value: string | null;
  onChange: (url: string | null) => void;
  id?: string;
  label?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
  round?: boolean; // profile photo look
  onUploadingChange?: (uploading: boolean) => void;
}

export function ImageUpload({ kind, round, label = "Upload image", ...props }: ImageUploadProps) {
  return (
    <FileUpload
      {...props}
      label={label}
      accept="image"
      variant={round ? "avatar" : "tile"}
      upload={async (file, onProgress) => (await uploadService.image(file, kind, file.name, onProgress)).url}
    />
  );
}
