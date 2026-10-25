import { api } from "@/lib/api/client";

// What the image is for — the server picks the folder and size from this
export type UploadKind = "company-logo" | "employee-photo" | "attendance-photo";

export interface UploadedImage {
  url: string;
  fileId: string;
  width?: number;
  height?: number;
}

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/heic,image/heif";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // keep in sync with the backend (5 MB)

// POST /api/upload (multipart) → ImageKit URL
export const uploadService = {
  image: async (file: Blob, kind: UploadKind, fileName = "image.jpg", onProgress?: (percent: number) => void) => {
    const form = new FormData();
    form.append("kind", kind);
    form.append("file", file, file instanceof File ? file.name : fileName);
    const { data } = await api.post<UploadedImage>("/upload", form, {
      onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
    });
    return data;
  },
};
