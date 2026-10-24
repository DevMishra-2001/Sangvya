import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import client from "../../api/client";

const errorMessage = (err, fallback) => err.response?.data?.error || fallback;
const thunk = (type, fn, fallback) =>
  createAsyncThunk(type, async (arg, { rejectWithValue }) => {
    try {
      return await fn(arg);
    } catch (err) {
      return rejectWithValue(errorMessage(err, fallback));
    }
  });

// Tasks assigned TO me (+ chart stats)
export const fetchMyTasks = thunk("tasks/mine", async () => (await client.get("/tasks/mine")).data, "Could not load tasks");
export const updateTaskProgress = thunk(
  "tasks/progress",
  async ({ id, ...payload }) => (await client.patch(`/tasks/${id}/progress`, payload)).data.task,
  "Could not update task"
);

// Tasks I assigned
export const fetchAssignedTasks = thunk("tasks/assigned", async () => (await client.get("/tasks/assigned")).data.tasks, "Could not load tasks");
export const fetchAssignable = thunk("tasks/assignable", async () => (await client.get("/tasks/assignable")).data.employees, "Could not load team");
export const createTask = thunk("tasks/create", async (payload) => (await client.post("/tasks", payload)).data.task, "Could not assign task");
export const reviewTask = thunk(
  "tasks/review",
  async ({ id, action }) => (await client.patch(`/tasks/${id}/review`, { action })).data.task,
  "Could not update task"
);
export const deleteTask = thunk("tasks/delete", async (id) => { await client.delete(`/tasks/${id}`); return id; }, "Could not delete task");

const replace = (list, task) => {
  const idx = list.findIndex((t) => t.id === task.id);
  if (idx !== -1) list[idx] = task;
};

const tasksSlice = createSlice({
  name: "tasks",
  initialState: { mine: [], stats: null, assigned: [], assignable: [], error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyTasks.fulfilled, (state, action) => {
        state.mine = action.payload.tasks;
        state.stats = action.payload.stats;
      })
      .addCase(updateTaskProgress.fulfilled, (state, action) => { replace(state.mine, action.payload); state.error = null; })
      .addCase(fetchAssignedTasks.fulfilled, (state, action) => { state.assigned = action.payload; })
      .addCase(fetchAssignable.fulfilled, (state, action) => { state.assignable = action.payload; })
      .addCase(createTask.fulfilled, (state, action) => { state.assigned.unshift(action.payload); state.error = null; })
      .addCase(reviewTask.fulfilled, (state, action) => { replace(state.assigned, action.payload); state.error = null; })
      .addCase(deleteTask.fulfilled, (state, action) => { state.assigned = state.assigned.filter((t) => t.id !== action.payload); })
      .addMatcher(
        (action) => action.type.startsWith("tasks/") && action.type.endsWith("/rejected"),
        (state, action) => { state.error = action.payload; }
      );
  },
});

export default tasksSlice.reducer;
