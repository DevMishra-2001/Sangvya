import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import client from "../../api/client";

const apiError = (err, fallback) => err.response?.data?.error || fallback;

export const fetchLeavePolicy = createAsyncThunk("leavePolicy/fetch", async (_, { rejectWithValue }) => {
  try {
    return (await client.get("/leave-policy")).data.policy;
  } catch (err) {
    return rejectWithValue(apiError(err, "Could not load leave policy"));
  }
});

// { clPerYear, slPerYear, olPerYear, elPerMonth }
export const saveLeavePolicy = createAsyncThunk("leavePolicy/save", async (payload, { rejectWithValue }) => {
  try {
    return (await client.put("/leave-policy", payload)).data.policy;
  } catch (err) {
    return rejectWithValue(apiError(err, "Could not save leave policy"));
  }
});

const leavePolicySlice = createSlice({
  name: "leavePolicy",
  initialState: { policy: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchLeavePolicy.fulfilled, (state, action) => { state.policy = action.payload; })
      .addCase(saveLeavePolicy.fulfilled, (state, action) => { state.policy = action.payload; });
  },
});

export default leavePolicySlice.reducer;
