import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import client from "../../api/client";

export const fetchSalaryStructures = createAsyncThunk("payroll/fetchStructures", async () => {
  const { data } = await client.get("/payroll/salary-structure");
  return data.structures;
});

export const setSalaryStructure = createAsyncThunk("payroll/setStructure", async (payload) => {
  const { data } = await client.post("/payroll/salary-structure", payload);
  return data.structure;
});

export const runPayroll = createAsyncThunk("payroll/run", async ({ month, year }, { rejectWithValue }) => {
  try {
    const { data } = await client.post("/payroll/run", { month, year });
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || "Payroll run failed");
  }
});

export const fetchRuns = createAsyncThunk("payroll/fetchRuns", async () => {
  const { data } = await client.get("/payroll/runs");
  return data.runs;
});

export const fetchPayslipsForRun = createAsyncThunk("payroll/fetchPayslips", async (runId) => {
  const { data } = await client.get(`/payroll/runs/${runId}/payslips`);
  return { runId, payslips: data.payslips };
});

// Downloads the PDF via a blob so the auth token (attached by the axios
// interceptor) is sent — a plain <a href> can't carry the Authorization header.
export const downloadPayslip = createAsyncThunk("payroll/downloadPdf", async (payslipId) => {
  const response = await client.get(`/payroll/payslips/${payslipId}/pdf`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "payslip.pdf");
  document.body.appendChild(link);
  link.click();
  link.remove();
});

const payrollSlice = createSlice({
  name: "payroll",
  initialState: {
    structures: [],
    runs: [],
    payslipsByRun: {},
    status: "idle",
    runError: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSalaryStructures.fulfilled, (state, action) => { state.structures = action.payload; })
      .addCase(setSalaryStructure.fulfilled, (state, action) => {
        const idx = state.structures.findIndex((s) => s.employee_id === action.payload.employee_id);
        if (idx !== -1) state.structures[idx] = { ...state.structures[idx], ...action.payload };
        else state.structures.push(action.payload);
      })
      .addCase(runPayroll.pending, (state) => { state.status = "loading"; state.runError = null; })
      .addCase(runPayroll.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.runs.unshift(action.payload.run);
        state.payslipsByRun[action.payload.run.id] = action.payload.payslips;
      })
      .addCase(runPayroll.rejected, (state, action) => { state.status = "failed"; state.runError = action.payload; })
      .addCase(fetchRuns.fulfilled, (state, action) => { state.runs = action.payload; })
      .addCase(fetchPayslipsForRun.fulfilled, (state, action) => {
        state.payslipsByRun[action.payload.runId] = action.payload.payslips;
      });
  },
});

export default payrollSlice.reducer;
