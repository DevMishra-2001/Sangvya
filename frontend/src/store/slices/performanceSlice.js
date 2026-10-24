import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import client from "../../api/client";

// ---- Cycles ----
export const fetchCycles = createAsyncThunk("performance/fetchCycles", async () => {
  const { data } = await client.get("/performance/cycles");
  return data.cycles;
});

export const addCycle = createAsyncThunk("performance/addCycle", async (payload) => {
  const { data } = await client.post("/performance/cycles", payload);
  return data.cycle;
});

export const setCycleStatus = createAsyncThunk("performance/setCycleStatus", async ({ id, status }) => {
  const { data } = await client.patch(`/performance/cycles/${id}/status`, { status });
  return data.cycle;
});

// ---- Reviews ----
export const fetchReviewsForCycle = createAsyncThunk("performance/fetchReviewsForCycle", async (cycleId) => {
  const { data } = await client.get(`/performance/cycles/${cycleId}/reviews`);
  return { cycleId, reviews: data.reviews };
});

export const saveReview = createAsyncThunk("performance/saveReview", async (payload) => {
  const { data } = await client.post("/performance/reviews", payload);
  return data.review;
});

export const updateReviewStatus = createAsyncThunk("performance/updateReviewStatus", async ({ id, status }) => {
  const { data } = await client.patch(`/performance/reviews/${id}/status`, { status });
  return data.review;
});

const performanceSlice = createSlice({
  name: "performance",
  initialState: { cycles: [], reviewsByCycle: {}, status: "idle" },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCycles.fulfilled, (state, action) => { state.cycles = action.payload; state.status = "succeeded"; })
      .addCase(addCycle.fulfilled, (state, action) => { state.cycles.unshift(action.payload); })
      .addCase(setCycleStatus.fulfilled, (state, action) => {
        const idx = state.cycles.findIndex((c) => c.id === action.payload.id);
        if (idx !== -1) state.cycles[idx] = { ...state.cycles[idx], ...action.payload };
      })
      .addCase(fetchReviewsForCycle.fulfilled, (state, action) => {
        state.reviewsByCycle[action.payload.cycleId] = action.payload.reviews;
      })
      .addCase(saveReview.fulfilled, (state, action) => {
        const list = state.reviewsByCycle[action.payload.cycle_id] || [];
        const idx = list.findIndex((r) => r.employee_id === action.payload.employee_id);
        if (idx !== -1) list[idx] = { ...list[idx], ...action.payload };
        else list.push(action.payload);
        state.reviewsByCycle[action.payload.cycle_id] = list;
      })
      .addCase(updateReviewStatus.fulfilled, (state, action) => {
        const list = state.reviewsByCycle[action.payload.cycle_id] || [];
        const idx = list.findIndex((r) => r.id === action.payload.id);
        if (idx !== -1) list[idx] = { ...list[idx], ...action.payload };
      });
  },
});

export default performanceSlice.reducer;
