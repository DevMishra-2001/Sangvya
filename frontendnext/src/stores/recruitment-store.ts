import { create } from "zustand";
import { run } from "@/lib/api/run";
import type { CandidatePayload, JobInput } from "@/lib/schemas/recruitment";
import { recruitmentService } from "@/lib/services/recruitment";
import type { Candidate, CandidateStage, Id, JobPosting } from "@/lib/types";

interface RecruitmentState {
  jobs: JobPosting[];
  candidates: Candidate[];
  load: () => Promise<void>;
  addJob: (input: JobInput) => Promise<boolean>;
  setJobStatus: (id: Id, status: "open" | "closed") => Promise<void>;
  removeJob: (id: Id) => Promise<void>;
  addCandidate: (payload: CandidatePayload) => Promise<boolean>;
  setStage: (id: Id, stage: CandidateStage) => Promise<void>;
  removeCandidate: (id: Id) => Promise<void>;
  convertToEmployee: (id: Id) => Promise<void>;
}

export const useRecruitmentStore = create<RecruitmentState>((set, get) => ({
  jobs: [],
  candidates: [],

  async load() {
    const [jobs, candidates] = await Promise.all([run(recruitmentService.jobs), run(recruitmentService.candidates)]);
    set({ ...(jobs.ok ? { jobs: jobs.data } : {}), ...(candidates.ok ? { candidates: candidates.data } : {}) });
  },

  async addJob(input) {
    const result = await run(() => recruitmentService.createJob(input), { success: "Job posted" });
    if (result.ok) set({ jobs: [{ ...result.data, candidate_count: 0 }, ...get().jobs] });
    return result.ok;
  },

  async setJobStatus(id, status) {
    const result = await run(() => recruitmentService.setJobStatus(id, status), { success: "Job status updated" });
    if (result.ok) set({ jobs: get().jobs.map((j) => (j.id === id ? { ...j, status } : j)) });
  },

  async removeJob(id) {
    const result = await run(() => recruitmentService.removeJob(id), { success: "Job deleted" });
    if (result.ok) await get().load(); // its candidates go too
  },

  async addCandidate(payload) {
    const result = await run(() => recruitmentService.createCandidate(payload), { success: "Candidate added" });
    if (result.ok) await get().load(); // job_title + candidate counts
    return result.ok;
  },

  async setStage(id, stage) {
    const result = await run(() => recruitmentService.setStage(id, stage), { success: "Candidate stage updated" });
    if (result.ok) set({ candidates: get().candidates.map((c) => (c.id === id ? { ...c, stage } : c)) });
  },

  async removeCandidate(id) {
    const result = await run(() => recruitmentService.removeCandidate(id), { success: "Candidate removed" });
    if (result.ok) await get().load();
  },

  async convertToEmployee(id) {
    await run(() => recruitmentService.convertToEmployee(id), { success: "Candidate added to employees" });
  },
}));
