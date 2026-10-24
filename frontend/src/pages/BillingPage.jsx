import { useEffect } from "react";
import { CreditCard, Download } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { fetchBillingStatus, fetchInvoices, startSubscription, cancelSubscription } from "../store/slices/billingSlice";

export default function BillingPage() {
  const dispatch = useDispatch();
  const { status, invoices } = useSelector((state) => state.billing);

  useEffect(() => {
    dispatch(fetchBillingStatus());
    dispatch(fetchInvoices());
  }, [dispatch]);

  if (!status) return <p>Loading...</p>;

  const { subscription, employeeCount, pricePerEmployee, monthlyAmount, trialDaysLeft, isTrialExpired } = status;
  const isTrial = subscription.status === "trial";
  const isActive = subscription.status === "active";
  const isPastDue = subscription.status === "past_due";
  const isCancelled = subscription.status === "cancelled";

  return (
    <div>
      <div className="mb-5">
        <h1>Billing</h1>
      </div>

      {/* Current plan summary */}
      <div className="bg-card border border-line rounded-lg p-5 mb-5">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xs text-slate mb-1">Current plan</div>
            <div className="font-serif text-2xl">₹{pricePerEmployee} / employee / month</div>
          </div>
          <span
            className={`status-pill ${
              isActive ? "status-approved" : isPastDue ? "status-rejected" : isCancelled ? "status-rejected" : "status-pending"
            }`}
          >
            {subscription.status.replace("_", " ")}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-5">
          <div>
            <div className="text-xs text-slate mb-1">Employees billed</div>
            <div className="text-lg font-medium">{employeeCount}</div>
          </div>
          <div>
            <div className="text-xs text-slate mb-1">Monthly amount</div>
            <div className="text-lg font-medium">₹{monthlyAmount.toLocaleString("en-IN")}</div>
          </div>
          <div>
            <div className="text-xs text-slate mb-1">{isTrial ? "Trial ends in" : "Renews"}</div>
            <div className="text-lg font-medium">
              {isTrial
                ? isTrialExpired ? "Expired" : `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"}`
                : subscription.current_period_end
                ? new Date(subscription.current_period_end).toLocaleDateString("en-IN")
                : "—"}
            </div>
          </div>
        </div>

        {isTrial && (
          <p className="text-sm text-slate mt-4">
            {isTrialExpired
              ? "Your free trial has ended. Subscribe to keep using Sangvya without interruption."
              : `You're on a free trial. Subscribe any time — billing is ₹${pricePerEmployee} per employee per month, and adjusts automatically as you add or remove employees.`}
          </p>
        )}
        {isPastDue && (
          <p className="text-sm text-rust mt-4">
            Your last payment attempt didn't go through. Please update your payment method to avoid losing access.
          </p>
        )}

        <div className="flex gap-3 mt-5">
          {(isTrial || isPastDue) && (
            <button
              className="btn-primary"
              onClick={() => dispatch(startSubscription())}
            >
              <CreditCard size={15} /> {isPastDue ? "Retry payment" : "Subscribe now"}
            </button>
          )}
          {isActive && (
            <button
              className="btn-primary bg-transparent border border-line !text-ink"
              onClick={() => dispatch(cancelSubscription())}
            >
              Cancel subscription
            </button>
          )}
        </div>
      </div>

      {/* Billing history */}
      <h2 className="mb-3">Billing history</h2>
      {invoices.length === 0 ? (
        <div className="empty-state">No invoices generated yet.</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Employees</th>
              <th>Amount</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td>{new Date(inv.created_at).toLocaleDateString("en-IN")}</td>
                <td>{inv.employee_count}</td>
                <td>₹{Number(inv.amount).toLocaleString("en-IN")}</td>
                <td><span className={`status-pill ${inv.status === "paid" ? "status-approved" : "status-rejected"}`}>{inv.status}</span></td>
                <td>
                  {inv.razorpay_invoice_id && (
                    <a
                      href={`https://dashboard.razorpay.com/app/invoices/${inv.razorpay_invoice_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 text-slate hover:text-ink inline-flex"
                    >
                      <Download size={14} />
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
