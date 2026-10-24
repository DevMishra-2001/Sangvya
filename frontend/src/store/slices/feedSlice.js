import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import client from "../../api/client";

// Notification bar: announcements + upcoming birthdays
export const fetchFeed = createAsyncThunk("feed/fetch", async () => (await client.get("/announcements/feed")).data);

export const postAnnouncement = createAsyncThunk("feed/post", async (payload, { rejectWithValue }) => {
  try {
    return (await client.post("/announcements", payload)).data.announcement;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || "Could not post announcement");
  }
});

export const deleteAnnouncement = createAsyncThunk("feed/delete", async (id) => {
  await client.delete(`/announcements/${id}`);
  return id;
});

const feedSlice = createSlice({
  name: "feed",
  initialState: { announcements: [], birthdays: [], loaded: false },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchFeed.fulfilled, (state, action) => {
        state.announcements = action.payload.announcements;
        state.birthdays = action.payload.birthdays;
        state.loaded = true;
      })
      .addCase(postAnnouncement.fulfilled, (state, action) => { state.announcements.unshift(action.payload); })
      .addCase(deleteAnnouncement.fulfilled, (state, action) => {
        state.announcements = state.announcements.filter((a) => a.id !== action.payload);
      });
  },
});

export default feedSlice.reducer;
