import { api } from "@/lib/api/client";
import { openFile } from "@/lib/download";
import type { Candidate, CandidateDetail, CandidateStage, Employee, Id, Interview, JobPosting, OfferStatus, RecruitmentOverview } from "@/lib/types";

export type JobPayload = Record<string, unknown>;
export type CandidatePayload = Record<string, unknown>;

export const recruitmentService = {
  overview: async () => (await api.get<RecruitmentOverview>("/recruitment/overview")).data,
  jobs: async () => (await api.get<{ jobs: JobPosting[] }>("/recruitment/jobs")).data.jobs,
  createJob: async (body: JobPayload) => (await api.post<{ job: JobPosting }>("/recruitment/jobs", body)).data.job,
  updateJob: async (id: Id, body: JobPayload) => (await api.put<{ job: JobPosting }>(`/recruitment/jobs/${id}`, body)).data.job,
  setJobStatus: async (id: Id, status: string) => (await api.patch<{ job: JobPosting }>(`/recruitment/jobs/${id}/status`, { status })).data.job,
  removeJob: async (id: Id) => {
    await api.delete(`/recruitment/jobs/${id}`);
  },
  candidates: async (params: { jobId?: Id; search?: string } = {}) => (await api.get<{ candidates: Candidate[] }>("/recruitment/candidates", { params })).data.candidates,
  candidate: async (id: Id) => (await api.get<CandidateDetail>(`/recruitment/candidates/${id}`)).data,
  createCandidate: async (body: CandidatePayload) => (await api.post<CandidateDetail>("/recruitment/candidates", body)).data,
  updateCandidate: async (id: Id, body: CandidatePayload) => (await api.put<CandidateDetail>(`/recruitment/candidates/${id}`, body)).data,
  setStage: async (id: Id, stage: CandidateStage, reason?: string) => (await api.patch<CandidateDetail>(`/recruitment/candidates/${id}/stage`, { stage, reason })).data,
  addNote: async (id: Id, text: string) => (await api.post<CandidateDetail>(`/recruitment/candidates/${id}/notes`, { text })).data,
  uploadResume: async (id: Id, file: File) => {
    const form = new FormData();
    form.append("file", file, file.name);
    return (await api.post<CandidateDetail>(`/recruitment/candidates/${id}/resume`, form)).data;
  },
  resumeLink: async (id: Id) => (await api.get<{ url: string }>(`/recruitment/candidates/${id}/resume`)).data.url,
  removeCandidate: async (id: Id) => {
    await api.delete(`/recruitment/candidates/${id}`);
  },
  schedule: async (id: Id, body: Record<string, unknown>) => (await api.post<CandidateDetail>(`/recruitment/candidates/${id}/interviews`, body)).data,
  updateInterview: async (id: Id, body: Record<string, unknown>) => (await api.patch<CandidateDetail>(`/recruitment/interviews/${id}`, body)).data,
  feedback: async (id: Id, body: { rating: number; recommendation: string; feedback: string }) => (await api.post(`/recruitment/interviews/${id}/feedback`, body)).data,
  myInterviews: async () => (await api.get<{ interviews: Interview[] }>("/recruitment/my-interviews")).data.interviews,
  saveOffer: async (id: Id, body: Record<string, unknown>) => (await api.put<CandidateDetail>(`/recruitment/candidates/${id}/offer`, body)).data,
  setOfferStatus: async (id: Id, status: Exclude<OfferStatus, "draft">) => (await api.patch<CandidateDetail>(`/recruitment/candidates/${id}/offer`, { status })).data,
  offerPdf: (id: Id) => openFile(`/recruitment/candidates/${id}/offer/pdf`, undefined, "offer-letter.pdf"),
  hire: async (id: Id) => (await api.post<{ employee: Employee }>(`/recruitment/candidates/${id}/hire`)).data.employee,
};
