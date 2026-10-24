import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import client from "../../api/client";

const errorMessage = (err, fallback) => err.response?.data?.error || fallback;

export const fetchUsers = createAsyncThunk("users/fetchAll", async () => {
  const { data } = await client.get("/users");
  return data;
});

export const addUser = createAsyncThunk("users/add", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await client.post("/users", payload);
    return data.user;
  } catch (err) {
    return rejectWithValue(errorMessage(err, "Could not create user"));
  }
});

export const editUser = createAsyncThunk("users/edit", async ({ id, ...payload }, { rejectWithValue }) => {
  try {
    const { data } = await client.put(`/users/${id}`, payload);
    return data.user;
  } catch (err) {
    return rejectWithValue(errorMessage(err, "Could not update user"));
  }
});

export const deleteUser = createAsyncThunk("users/delete", async (id, { rejectWithValue }) => {
  try {
    await client.delete(`/users/${id}`);
    return id;
  } catch (err) {
    return rejectWithValue(errorMessage(err, "Could not delete user"));
  }
});

const usersSlice = createSlice({
  name: "users",
  initialState: { list: [], roles: [], status: "idle", error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => { state.status = "loading"; })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.list = action.payload.users;
        state.roles = action.payload.roles;
      })
      .addCase(addUser.fulfilled, (state, action) => { state.list.push(action.payload); state.error = null; })
      .addCase(editUser.fulfilled, (state, action) => {
        const idx = state.list.findIndex((u) => u.id === action.payload.id);
        if (idx !== -1) state.list[idx] = { ...state.list[idx], ...action.payload };
        state.error = null;
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.list = state.list.filter((u) => u.id !== action.payload);
        state.error = null;
      })
      .addMatcher(
        (action) => action.type.startsWith("users/") && action.type.endsWith("/rejected"),
        (state, action) => { state.error = action.payload || action.error.message; }
      );
  },
});

export default usersSlice.reducer;
