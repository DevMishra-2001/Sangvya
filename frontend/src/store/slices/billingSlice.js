import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import client from "../../api/client";

export const fetchBillingStatus = createAsyncThunk("billing/fetchStatus", async () => {
  const { data } = await client.get("/billing/status");
  return data;
});

export const fetchInvoices = createAsyncThunk("billing/fetchInvoices", async () => {
  const { data } = await client.get("/billing/invoices");
  return data.invoices;
});

// Creates the Razorpay subscription on our backend, then opens Razorpay's
// Checkout widget so the admin can authorize the card/UPI mandate. Razorpay's
// checkout.js script must already be loaded on the page (see BillingPage).
export const startSubscription = createAsyncThunk(
  "billing/startSubscription",
  async (_, { rejectWithValue, dispatch }) => {
    try {
      const { data } = await client.post("/billing/subscribe");

      return new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: data.razorpayKeyId,
          subscription_id: data.razorpaySubscriptionId,
          name: "Sangvya",
          description: `${data.quantity} employees × ₹15/month`,
          theme: { color: "#1F3A34" },
          handler: () => {
            // The actual "payment succeeded" confirmation comes from the
            // Razorpay webhook, not this callback — re-fetch status after a
            // short delay so the UI reflects the webhook's update.
            setTimeout(() => dispatch(fetchBillingStatus()), 2500);
            resolve(data);
          },
          modal: {
            ondismiss: () => reject(new Error("Checkout closed before completing payment")),
          },
        });
        rzp.open();
      });
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Could not start subscription");
    }
  }
);

export const cancelSubscription = createAsyncThunk("billing/cancel", async (_, { rejectWithValue }) => {
  try {
    const { data } = await client.post("/billing/cancel");
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || "Could not cancel subscription");
  }
});

const billingSlice = createSlice({
  name: "billing",
  initialState: {
    status: null, // full /billing/status payload
    invoices: [],
    loadState: "idle",
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchBillingStatus.pending, (state) => { state.loadState = "loading"; })
      .addCase(fetchBillingStatus.fulfilled, (state, action) => { state.status = action.payload; state.loadState = "succeeded"; })
      .addCase(fetchBillingStatus.rejected, (state) => { state.loadState = "failed"; })
      .addCase(fetchInvoices.fulfilled, (state, action) => { state.invoices = action.payload; })
      .addCase(startSubscription.pending, (state) => { state.error = null; })
      .addCase(startSubscription.rejected, (state, action) => { state.error = action.payload; })
      .addCase(cancelSubscription.fulfilled, (state, action) => {
        if (state.status?.subscription) state.status.subscription.status = "cancelled";
      });
  },
});

export default billingSlice.reducer;
