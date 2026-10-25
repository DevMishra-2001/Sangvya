import { api } from "@/lib/api/client";
import type { Candidate, CandidateStage, Employee, Id, JobPosting } from "@/lib/types";
import type { CandidatePayload, JobInput } from "@/lib/schemas/recruitment";

export const recruitmentService = {
  jobs: async () => (await api.get<{ jobs: JobPosting[] }>("/recruitment/jobs")).data.jobs,
  createJob: async (input: JobInput) => (await api.post<{ job: JobPosting }>("/recruitment/jobs", input)).data.job,
  setJobStatus: async (id: Id, status: "open" | "closed") =>
    (await api.patch<{ job: JobPosting }>(`/recruitment/jobs/${id}/status`, { status })).data.job,
  removeJob: async (id: Id) => {
    await api.delete(`/recruitment/jobs/${id}`);
  },
  candidates: async () => (await api.get<{ candidates: Candidate[] }>("/recruitment/candidates")).data.candidates,
  createCandidate: async (payload: CandidatePayload) =>
    (await api.post<{ candidate: Candidate }>("/recruitment/candidates", payload)).data.candidate,
  setStage: async (id: Id, stage: CandidateStage) =>
    (await api.patch<{ candidate: Candidate }>(`/recruitment/candidates/${id}/stage`, { stage })).data.candidate,
  removeCandidate: async (id: Id) => {
    await api.delete(`/recruitment/candidates/${id}`);
  },
  convertToEmployee: async (id: Id) =>
    (await api.post<{ employee: Employee }>(`/recruitment/candidates/${id}/convert-to-employee`)).data.employee,
};
