import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import client from "../../api/client";

export const fetchAttendanceByDate = createAsyncThunk("attendance/fetchByDate", async (date) => {
  const { data } = await client.get(`/attendance?date=${date}`);
  return { date, records: data.attendance };
});

export const markAttendance = createAsyncThunk("attendance/mark", async ({ employeeId, date, status }) => {
  const { data } = await client.post("/attendance", { employeeId, date, status });
  return { date, record: data.attendance };
});

const attendanceSlice = createSlice({
  name: "attendance",
  // byDate: { "2026-09-02": [{employee_id, status, ...}] }
  initialState: { byDate: {}, status: "idle" },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAttendanceByDate.fulfilled, (state, action) => {
        state.byDate[action.payload.date] = action.payload.records;
        state.status = "succeeded";
      })
      .addCase(markAttendance.fulfilled, (state, action) => {
        const { date, record } = action.payload;
        const existing = state.byDate[date] || [];
        const idx = existing.findIndex((r) => r.employee_id === record.employee_id);
        if (idx !== -1) existing[idx] = record; else existing.push(record);
        state.byDate[date] = existing;
      });
  },
});

export default attendanceSlice.reducer;
