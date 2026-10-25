import { create } from "zustand";
import { errorMessage } from "@/lib/api/client";
import { run } from "@/lib/api/run";
import { billingService } from "@/lib/services/billing";
import type { BillingStatus, Invoice } from "@/lib/types";
import { toast } from "sonner";

interface RazorpayOptions {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  handler: () => void;
  modal: { ondismiss: () => void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

interface BillingState {
  status: BillingStatus | null;
  invoices: Invoice[];
  load: () => Promise<void>;
  subscribe: () => Promise<void>;
  cancel: () => Promise<void>;
}

export const useBillingStore = create<BillingState>((set, get) => ({
  status: null,
  invoices: [],

  async load() {
    const [status, invoices] = await Promise.all([run(billingService.status), run(billingService.invoices)]);
    set({ ...(status.ok ? { status: status.data } : {}), ...(invoices.ok ? { invoices: invoices.data } : {}) });
  },

  // Creates the Razorpay subscription on the backend, then opens Razorpay
  // Checkout so the admin can authorize the card/UPI mandate. Whether the
  // payment worked arrives via the backend webhook, so status is re-read after.
  async subscribe() {
    try {
      const data = await billingService.subscribe();
      if (!window.Razorpay) throw new Error("Razorpay Checkout didn't load — check your connection and try again.");
      new window.Razorpay({
        key: data.razorpayKeyId,
        subscription_id: data.razorpaySubscriptionId,
        name: "Sangvya",
        description: `${data.quantity} employees × ₹${get().status?.pricePerEmployee ?? 15}/month`,
        handler: () => setTimeout(() => get().load(), 2500),
        modal: { ondismiss: () => toast.info("Checkout closed before completing payment") },
      }).open();
    } catch (err) {
      toast.error(errorMessage(err, "Could not start subscription"));
    }
  },

  async cancel() {
    const result = await run(billingService.cancel, { success: "Subscription cancelled", error: "Could not cancel subscription" });
    if (result.ok) await get().load();
  },
}));
