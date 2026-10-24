import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import client from "../../api/client";

// ---- Jobs ----
export const fetchJobs = createAsyncThunk("recruitment/fetchJobs", async () => {
  const { data } = await client.get("/recruitment/jobs");
  return data.jobs;
});

export const addJob = createAsyncThunk("recruitment/addJob", async (payload) => {
  const { data } = await client.post("/recruitment/jobs", payload);
  return data.job;
});

export const setJobStatus = createAsyncThunk("recruitment/setJobStatus", async ({ id, status }) => {
  const { data } = await client.patch(`/recruitment/jobs/${id}/status`, { status });
  return data.job;
});

export const deleteJob = createAsyncThunk("recruitment/deleteJob", async (id) => {
  await client.delete(`/recruitment/jobs/${id}`);
  return id;
});

// ---- Candidates ----
export const fetchCandidates = createAsyncThunk("recruitment/fetchCandidates", async () => {
  const { data } = await client.get("/recruitment/candidates");
  return data.candidates;
});

export const addCandidate = createAsyncThunk("recruitment/addCandidate", async (payload) => {
  const { data } = await client.post("/recruitment/candidates", payload);
  return data.candidate;
});

export const updateCandidateStage = createAsyncThunk("recruitment/updateStage", async ({ id, stage }) => {
  const { data } = await client.patch(`/recruitment/candidates/${id}/stage`, { stage });
  return data.candidate;
});

export const deleteCandidate = createAsyncThunk("recruitment/deleteCandidate", async (id) => {
  await client.delete(`/recruitment/candidates/${id}`);
  return id;
});

export const convertToEmployee = createAsyncThunk("recruitment/convertToEmployee", async (candidateId) => {
  const { data } = await client.post(`/recruitment/candidates/${candidateId}/convert-to-employee`);
  return data.employee;
});

const recruitmentSlice = createSlice({
  name: "recruitment",
  initialState: { jobs: [], candidates: [], status: "idle" },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchJobs.fulfilled, (state, action) => { state.jobs = action.payload; state.status = "succeeded"; })
      .addCase(addJob.fulfilled, (state, action) => { state.jobs.unshift(action.payload); })
      .addCase(setJobStatus.fulfilled, (state, action) => {
        const idx = state.jobs.findIndex((j) => j.id === action.payload.id);
        if (idx !== -1) state.jobs[idx] = { ...state.jobs[idx], ...action.payload };
      })
      .addCase(deleteJob.fulfilled, (state, action) => {
        state.jobs = state.jobs.filter((j) => j.id !== action.payload);
      })
      .addCase(fetchCandidates.fulfilled, (state, action) => { state.candidates = action.payload; })
      .addCase(addCandidate.fulfilled, (state, action) => { state.candidates.unshift(action.payload); })
      .addCase(updateCandidateStage.fulfilled, (state, action) => {
        const idx = state.candidates.findIndex((c) => c.id === action.payload.id);
        if (idx !== -1) state.candidates[idx] = { ...state.candidates[idx], ...action.payload };
      })
      .addCase(deleteCandidate.fulfilled, (state, action) => {
        state.candidates = state.candidates.filter((c) => c.id !== action.payload);
      });
  },
});

export default recruitmentSlice.reducer;
