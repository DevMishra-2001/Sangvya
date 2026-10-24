import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import client from "../../api/client";

// The logged-in employee's own attendance: today's punch card + month calendar.
const errorMessage = (err, fallback) => err.response?.data?.error || fallback;

export const fetchToday = createAsyncThunk("self/today", async (_, { rejectWithValue }) => {
  try {
    const { data } = await client.get("/me/today");
    return data;
  } catch (err) {
    return rejectWithValue(errorMessage(err, "Could not load today's attendance"));
  }
});

// punchAction("break-start") or punchAction({ action: "punch-in", location, remarks })
// action: "punch-in" | "break-start" | "break-end" | "punch-out"
export const punchAction = createAsyncThunk("self/punch", async (arg, { rejectWithValue }) => {
  const { action, ...details } = typeof arg === "string" ? { action: arg } : arg;
  try {
    const { data } = await client.post(`/me/${action}`, details);
    return data.day;
  } catch (err) {
    return rejectWithValue(errorMessage(err, "Something went wrong"));
  }
});

export const fetchCalendar = createAsyncThunk("self/calendar", async (month, { rejectWithValue }) => {
  try {
    const { data } = await client.get(`/me/calendar?month=${month}`);
    return data;
  } catch (err) {
    return rejectWithValue(errorMessage(err, "Could not load calendar"));
  }
});

// One day for the Attendance tab: record, status flags, main status
export const fetchAttendanceDay = createAsyncThunk("self/attendanceDay", async (date, { rejectWithValue }) => {
  try {
    const { data } = await client.get(`/me/attendance?date=${date}`);
    return data;
  } catch (err) {
    return rejectWithValue(errorMessage(err, "Could not load attendance"));
  }
});

// Same day data for the header's punch-details modal — kept out of the store so it
// doesn't change the Attendance tab the user may have open.
export const fetchDayDetails = createAsyncThunk("self/dayDetails", async (date, { rejectWithValue }) => {
  try {
    const { data } = await client.get(`/me/attendance?date=${date}`);
    return data;
  } catch (err) {
    return rejectWithValue(errorMessage(err, "Could not load punch details"));
  }
});

// This month's leave requests (Leave View Approval / Leave Report)
export const fetchMyLeaves = createAsyncThunk("self/leaves", async (month, { rejectWithValue }) => {
  try {
    const { data } = await client.get(`/me/leaves?month=${month}`);
    return data;
  } catch (err) {
    return rejectWithValue(errorMessage(err, "Could not load leaves"));
  }
});

export const fetchLeaveBalance = createAsyncThunk("self/leaveBalance", async (_, { rejectWithValue }) => {
  try {
    const { data } = await client.get("/me/leave-balance");
    return data.balances;
  } catch (err) {
    return rejectWithValue(errorMessage(err, "Could not load leave balance"));
  }
});

const selfSlice = createSlice({
  name: "self",
  initialState: {
    today: null,     // { date, isSunday, holiday, day, rules }
    calendar: null,  // { month, today, days, holidays, leaves, balances, rules }
    attendanceDay: null, // { date, day, flags, status, locations, … }
    leaves: null,    // { month, employee, leaves }
    balances: null,  // { cl, sl, ol, el }
    busy: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchToday.fulfilled, (state, action) => { state.today = action.payload; state.error = null; })
      .addCase(fetchToday.rejected, (state, action) => { state.error = action.payload; })
      .addCase(punchAction.pending, (state) => { state.busy = true; state.error = null; })
      .addCase(punchAction.fulfilled, (state, action) => {
        state.busy = false;
        if (state.today) state.today.day = action.payload;
      })
      .addCase(punchAction.rejected, (state, action) => { state.busy = false; state.error = action.payload; })
      .addCase(fetchCalendar.fulfilled, (state, action) => {
        state.calendar = action.payload;
        state.balances = action.payload.balances;
      })
      .addCase(fetchAttendanceDay.fulfilled, (state, action) => { state.attendanceDay = action.payload; })
      .addCase(fetchMyLeaves.fulfilled, (state, action) => { state.leaves = action.payload; })
      .addCase(fetchLeaveBalance.fulfilled, (state, action) => { state.balances = action.payload; })
      .addCase(fetchCalendar.rejected, (state, action) => { state.error = action.payload; });
  },
});

export default selfSlice.reducer;
