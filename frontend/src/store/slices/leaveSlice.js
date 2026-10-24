import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import client from "../../api/client";

export const fetchLeaves = createAsyncThunk("leave/fetchAll", async () => {
  const { data } = await client.get("/leaves");
  return data.leaves;
});

export const requestLeave = createAsyncThunk("leave/request", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await client.post("/leaves", payload);
    return data.leave;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || "Could not submit leave request");
  }
});

export const updateLeaveStatus = createAsyncThunk("leave/updateStatus", async ({ id, status }) => {
  const { data } = await client.patch(`/leaves/${id}/status`, { status });
  return data.leave;
});

const leaveSlice = createSlice({
  name: "leave",
  initialState: { list: [], status: "idle" },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchLeaves.fulfilled, (state, action) => { state.list = action.payload; state.status = "succeeded"; })
      .addCase(requestLeave.fulfilled, (state, action) => { state.list.unshift(action.payload); })
      .addCase(updateLeaveStatus.fulfilled, (state, action) => {
        const idx = state.list.findIndex((l) => l.id === action.payload.id);
        if (idx !== -1) state.list[idx] = action.payload;
      });
  },
});

export default leaveSlice.reducer;
