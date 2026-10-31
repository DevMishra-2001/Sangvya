import { api } from "@/lib/api/client";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/constants";
import type { DocumentCategory, OnboardingForm } from "@/lib/types";

// Public self-onboarding (no login — the token in the link is the key)
export const onboardingService = {
  open: async (token: string) => (await api.get<OnboardingForm>(`/onboarding/${token}`)).data,
  save: async (token: string, body: Record<string, unknown>) => {
    await api.put(`/onboarding/${token}`, body);
  },
  upload: async (token: string, file: File, category: DocumentCategory, onProgress?: (p: number) => void) => {
    const form = new FormData();
    form.append("category", category);
    form.append("name", DOCUMENT_CATEGORY_LABELS[category]);
    form.append("file", file, file.name);
    await api.post(`/onboarding/${token}/documents`, form, { onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)) });
  },
  submit: async (token: string) => {
    await api.post(`/onboarding/${token}/submit`);
  },
};
