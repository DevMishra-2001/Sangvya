import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import client from "../../api/client";

export const fetchHolidays = createAsyncThunk("holidays/fetchAll", async () => {
  const { data } = await client.get("/holidays");
  return data.holidays;
});

export const addHoliday = createAsyncThunk("holidays/add", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await client.post("/holidays", payload);
    return data.holiday;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || "Could not add holiday");
  }
});

export const deleteHoliday = createAsyncThunk("holidays/delete", async (id) => {
  await client.delete(`/holidays/${id}`);
  return id;
});

const holidaysSlice = createSlice({
  name: "holidays",
  initialState: { list: [], status: "idle" },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchHolidays.fulfilled, (state, action) => { state.list = action.payload; state.status = "succeeded"; })
      .addCase(addHoliday.fulfilled, (state, action) => {
        state.list.push(action.payload);
        state.list.sort((a, b) => a.date.localeCompare(b.date));
      })
      .addCase(deleteHoliday.fulfilled, (state, action) => {
        state.list = state.list.filter((h) => h.id !== action.payload);
      });
  },
});

export default holidaysSlice.reducer;
