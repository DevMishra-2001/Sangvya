import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import client from "../../api/client";

export const fetchEmployees = createAsyncThunk("employees/fetchAll", async () => {
  const { data } = await client.get("/employees");
  return data.employees;
});

export const addEmployee = createAsyncThunk("employees/add", async (payload) => {
  const { data } = await client.post("/employees", payload);
  return data.employee;
});

export const editEmployee = createAsyncThunk("employees/edit", async ({ id, ...payload }) => {
  const { data } = await client.put(`/employees/${id}`, payload);
  return data.employee;
});

export const deleteEmployee = createAsyncThunk("employees/delete", async (id) => {
  await client.delete(`/employees/${id}`);
  return id;
});

const employeesSlice = createSlice({
  name: "employees",
  initialState: { list: [], status: "idle", error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchEmployees.pending, (state) => { state.status = "loading"; })
      .addCase(fetchEmployees.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.list = action.payload;
      })
      .addCase(fetchEmployees.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message;
      })
      .addCase(addEmployee.fulfilled, (state, action) => { state.list.unshift(action.payload); })
      .addCase(editEmployee.fulfilled, (state, action) => {
        const idx = state.list.findIndex((e) => e.id === action.payload.id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(deleteEmployee.fulfilled, (state, action) => {
        state.list = state.list.filter((e) => e.id !== action.payload);
      });
  },
});

export default employeesSlice.reducer;
