import { create } from "zustand";
import { run } from "@/lib/api/run";
import type { CycleInput, ReviewPayload } from "@/lib/schemas/performance";
import { performanceService } from "@/lib/services/performance";
import type { Id, Review, ReviewCycle, ReviewStatus } from "@/lib/types";

interface PerformanceState {
  cycles: ReviewCycle[];
  reviewsByCycle: Record<Id, Review[]>;
  loadCycles: () => Promise<void>;
  loadReviews: (cycleId: Id) => Promise<void>;
  addCycle: (input: CycleInput) => Promise<boolean>;
  setCycleStatus: (id: Id, status: "active" | "closed") => Promise<void>;
  saveReview: (payload: ReviewPayload) => Promise<boolean>;
  setReviewStatus: (cycleId: Id, id: Id, status: ReviewStatus) => Promise<void>;
}

export const usePerformanceStore = create<PerformanceState>((set, get) => ({
  cycles: [],
  reviewsByCycle: {},

  async loadCycles() {
    const result = await run(performanceService.cycles);
    if (result.ok) set({ cycles: result.data });
  },

  async loadReviews(cycleId) {
    const result = await run(() => performanceService.reviews(cycleId));
    if (result.ok) set({ reviewsByCycle: { ...get().reviewsByCycle, [cycleId]: result.data } });
  },

  async addCycle(input) {
    const result = await run(() => performanceService.createCycle(input), { success: "Review cycle created" });
    if (result.ok) await get().loadCycles();
    return result.ok;
  },

  async setCycleStatus(id, status) {
    const result = await run(() => performanceService.setCycleStatus(id, status), { success: "Cycle status updated" });
    if (result.ok) set({ cycles: get().cycles.map((c) => (c.id === id ? { ...c, status } : c)) });
  },

  async saveReview(payload) {
    const result = await run(() => performanceService.saveReview(payload), {
      success: payload.status === "submitted" ? "Review submitted" : "Review saved as draft",
    });
    if (result.ok) {
      await get().loadReviews(payload.cycleId);
      await get().loadCycles(); // review counts
    }
    return result.ok;
  },

  async setReviewStatus(cycleId, id, status) {
    const result = await run(() => performanceService.setReviewStatus(id, status), { success: "Review updated" });
    if (result.ok) await get().loadReviews(cycleId);
  },
}));
