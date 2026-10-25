import { api } from "@/lib/api/client";
import type { Id, Review, ReviewCycle, ReviewStatus } from "@/lib/types";
import type { CycleInput, ReviewPayload } from "@/lib/schemas/performance";

export const performanceService = {
  cycles: async () => (await api.get<{ cycles: ReviewCycle[] }>("/performance/cycles")).data.cycles,
  createCycle: async (input: CycleInput) => (await api.post<{ cycle: ReviewCycle }>("/performance/cycles", input)).data.cycle,
  setCycleStatus: async (id: Id, status: "active" | "closed") =>
    (await api.patch<{ cycle: ReviewCycle }>(`/performance/cycles/${id}/status`, { status })).data.cycle,
  reviews: async (cycleId: Id) => (await api.get<{ reviews: Review[] }>(`/performance/cycles/${cycleId}/reviews`)).data.reviews,
  saveReview: async (payload: ReviewPayload) => (await api.post<{ review: Review }>("/performance/reviews", payload)).data.review,
  setReviewStatus: async (id: Id, status: ReviewStatus) =>
    (await api.patch<{ review: Review }>(`/performance/reviews/${id}/status`, { status })).data.review,
};
