import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import client, { setSessionUser } from "../../api/client";
import { broadcast } from "../../session/activity";

// The login token lives in an HttpOnly cookie set by the backend — nothing
// about the session is stored in localStorage. "Am I logged in?" is answered
// by GET /auth/me when the app starts.

export const signup = createAsyncThunk("auth/signup", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await client.post("/auth/signup", payload);
    setSessionUser(data.user.id);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || "Signup failed");
  }
});

export const login = createAsyncThunk("auth/login", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await client.post("/auth/login", payload);
    setSessionUser(data.user.id);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || "Login failed");
  }
});

// Who is logged in (from the cookie)? Runs once when the app loads.
export const fetchMe = createAsyncThunk("auth/me", async (_, { rejectWithValue }) => {
  try {
    const { data } = await client.get("/auth/me");
    setSessionUser(data.user.id);
    return data; // { user, session }
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || "Not logged in");
  }
});

// Ends the session on the server and tells the other open tabs to log out too.
// { fromOtherTab: true } = another tab already did the server call.
export const logout = createAsyncThunk("auth/logout", async ({ fromOtherTab = false } = {}) => {
  setSessionUser(null);
  if (fromOtherTab) return true;
  broadcast({ type: "logout" });
  try {
    await client.post("/auth/logout");
  } catch {
    // Already logged out / offline — the local state is cleared either way
  }
  return true;
});

// Saves the logged-in user's own font size (PUT /api/settings/font-size).
export const saveFontSize = createAsyncThunk("auth/saveFontSize", async (fontSize, { rejectWithValue }) => {
  try {
    const { data } = await client.put("/settings/font-size", { fontSize });
    return data.fontSize;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || "Could not save font size");
  }
});

// Changes the logged-in user's own password (PUT /api/settings/password).
export const changePassword = createAsyncThunk("auth/changePassword", async ({ newPassword }, { rejectWithValue }) => {
  try {
    await client.put("/settings/password", { newPassword });
    return true;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || "Could not change password");
  }
});

// ---- Forgot password (logged out): email OTP → verify → new password ----
const apiError = (err, fallback) => err.response?.data?.error || fallback;

export const requestPasswordOtp = createAsyncThunk("auth/forgotPassword", async (email, { rejectWithValue }) => {
  try {
    const { data } = await client.post("/auth/forgot-password", { email });
    return data; // { message, resendAfterSec, otpValidMin }
  } catch (err) {
    return rejectWithValue(apiError(err, "Could not send OTP"));
  }
});

export const verifyPasswordOtp = createAsyncThunk("auth/verifyOtp", async ({ email, otp }, { rejectWithValue }) => {
  try {
    const { data } = await client.post("/auth/verify-otp", { email, otp });
    return data.resetToken;
  } catch (err) {
    return rejectWithValue(apiError(err, "Could not verify OTP"));
  }
});

export const resetForgottenPassword = createAsyncThunk("auth/resetPassword", async ({ resetToken, newPassword }, { rejectWithValue }) => {
  try {
    await client.post("/auth/reset-password", { resetToken, newPassword });
    return true;
  } catch (err) {
    return rejectWithValue(apiError(err, "Could not reset password"));
  }
});

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,       // the logged-in user, or null
    company: null,
    checked: false,   // has the startup "who am I?" check (fetchMe) finished?
    session: { accessTtlMin: 5, idleMin: 20 }, // timings from the API (keep-alive / idle logout)
    status: "idle",   // idle | loading | succeeded | failed (login/signup form)
    error: null,
  },
  reducers: {
    // Live preview while dragging the font slider (not saved yet)
    previewFontSize(state, action) {
      if (state.user) state.user.font_size = action.payload;
    },
    // The session could not be refreshed / was revoked — drop the user locally
    sessionEnded(state) {
      state.user = null;
      state.company = null;
      state.status = "idle";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signup.pending, (state) => { state.status = "loading"; state.error = null; })
      .addCase(signup.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload.user;
        state.company = action.payload.company;
        if (action.payload.session) state.session = action.payload.session;
        state.checked = true;
      })
      .addCase(signup.rejected, (state, action) => { state.status = "failed"; state.error = action.payload; })
      .addCase(login.pending, (state) => { state.status = "loading"; state.error = null; })
      .addCase(login.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload.user;
        if (action.payload.session) state.session = action.payload.session;
        state.checked = true;
      })
      .addCase(login.rejected, (state, action) => { state.status = "failed"; state.error = action.payload; })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload.user;
        if (action.payload.session) state.session = action.payload.session;
        state.checked = true;
      })
      .addCase(fetchMe.rejected, (state) => { state.user = null; state.checked = true; })
      .addCase(logout.pending, (state) => {
        // Clear right away so the UI leaves protected pages immediately
        state.user = null;
        state.company = null;
        state.status = "idle";
      })
      .addCase(saveFontSize.fulfilled, (state, action) => {
        if (state.user) state.user.font_size = action.payload;
      });
  },
});

export const { previewFontSize, sessionEnded } = authSlice.actions;
export default authSlice.reducer;
