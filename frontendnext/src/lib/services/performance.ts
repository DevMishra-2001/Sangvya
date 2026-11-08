import { api } from "@/lib/api/client";
import type { Id, ReviewCycle, ReviewDetail, ReviewRow } from "@/lib/types";

type Body = Record<string, unknown>;

export const performanceService = {
  cycles: async () => (await api.get<{ cycles: ReviewCycle[] }>("/performance/cycles")).data.cycles,
  createCycle: async (body: Body) => (await api.post<{ cycle: ReviewCycle }>("/performance/cycles", body)).data.cycle,
  updateCycle: async (id: Id, body: Body) => (await api.put<{ cycle: ReviewCycle }>(`/performance/cycles/${id}`, body)).data.cycle,
  setCycleStatus: async (id: Id, status: "active" | "closed") => (await api.patch<{ cycles: ReviewCycle[] }>(`/performance/cycles/${id}/status`, { status })).data.cycles,
  launch: async (id: Id, body: { departmentIds?: number[] }) => (await api.post<{ added: number; cycles: ReviewCycle[] }>(`/performance/cycles/${id}/launch`, body)).data,
  cycleReviews: async (id: Id) => (await api.get<{ reviews: ReviewRow[] }>(`/performance/cycles/${id}/reviews`)).data.reviews,
  me: async () => (await api.get<{ mine: ReviewRow[]; team: ReviewRow[] }>("/performance/me")).data,
  review: async (id: Id) => (await api.get<ReviewDetail>(`/performance/reviews/${id}`)).data,
  addGoal: async (reviewId: Id, body: Body) => (await api.post<ReviewDetail>(`/performance/reviews/${reviewId}/goals`, body)).data,
  updateGoal: async (goalId: Id, body: Body) => (await api.put<ReviewDetail>(`/performance/goals/${goalId}`, body)).data,
  deleteGoal: async (goalId: Id) => (await api.delete<ReviewDetail>(`/performance/goals/${goalId}`)).data,
  checkin: async (goalId: Id, body: Body) => (await api.post<ReviewDetail>(`/performance/goals/${goalId}/checkins`, body)).data,
  self: async (id: Id, body: Body) => (await api.post<ReviewDetail>(`/performance/reviews/${id}/self`, body)).data,
  manager: async (id: Id, body: Body) => (await api.post<ReviewDetail>(`/performance/reviews/${id}/manager`, body)).data,
  finalize: async (id: Id, body: { finalRating: number; hrComments?: string }) => (await api.post<ReviewDetail>(`/performance/reviews/${id}/finalize`, body)).data,
  reopen: async (id: Id) => (await api.post<ReviewDetail>(`/performance/reviews/${id}/reopen`)).data,
  acknowledge: async (id: Id, comment?: string) => (await api.post<ReviewDetail>(`/performance/reviews/${id}/acknowledge`, { comment })).data,
  setReviewer: async (id: Id, managerId: number | null) => (await api.patch<ReviewDetail>(`/performance/reviews/${id}/reviewer`, { managerId })).data,
};
