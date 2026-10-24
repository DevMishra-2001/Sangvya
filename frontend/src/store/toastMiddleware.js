import { toast } from "../components/Toast";

// One place that turns API results into toasts, so no component has to:
//  • every failed thunk  → error toast with the server's message
//  • listed successes    → success toast (a string, or a function of the thunk's argument)
const SUCCESS = {
  "auth/saveFontSize": "Font size saved",
  "auth/changePassword": "Password updated successfully",
  "auth/forgotPassword": "If this email is registered, an OTP has been sent to it",
  "auth/verifyOtp": "OTP verified — set your new password",
  "auth/resetPassword": "Password changed — please log in with your new password",
  "attendance/mark": "Attendance marked",
  "self/punch": (arg) => ({
    "punch-in": "Checked in — have a great day!",
    "break-start": "Break started",
    "break-end": "Welcome back — break ended",
    "punch-out": "Checked out",
  })[typeof arg === "string" ? arg : arg?.action],
  "leave/request": (arg) => (arg?.leaveType === "comp_off" ? "Comp off request submitted" : "Leave request submitted"),
  "leavePolicy/save": "Leave policy saved",
  "leave/updateStatus": (arg) => (arg?.status === "approved" ? "Leave approved" : "Leave rejected"),
  "employees/add": "Employee added",
  "employees/edit": "Employee updated",
  "employees/delete": "Employee removed",
  "users/add": "User login created",
  "users/edit": "User updated",
  "users/delete": "User removed",
  "holidays/add": "Holiday added",
  "holidays/delete": "Holiday removed",
  "feed/post": "Announcement published",
  "feed/delete": "Announcement deleted",
  "tasks/create": "Ticket assigned",
  "tasks/progress": (arg) => (arg?.status === "done" ? "Ticket marked done — waiting for approval" : "Progress updated"),
  "tasks/review": (arg) => (arg?.action === "approve" ? "Ticket approved" : "Ticket reopened"),
  "tasks/delete": "Ticket deleted",
  "recruitment/addJob": "Job posted",
  "recruitment/setJobStatus": "Job status updated",
  "recruitment/deleteJob": "Job deleted",
  "recruitment/addCandidate": "Candidate added",
  "recruitment/updateStage": "Candidate stage updated",
  "recruitment/deleteCandidate": "Candidate removed",
  "recruitment/convertToEmployee": "Candidate added to employees",
  "performance/addCycle": "Review cycle created",
  "performance/setCycleStatus": "Cycle status updated",
  "performance/saveReview": (arg) => (arg?.status === "submitted" ? "Review submitted" : "Review saved as draft"),
  "performance/updateReviewStatus": "Review updated",
  "payroll/setStructure": "Salary structure saved",
  "payroll/run": "Payroll run completed",
  "billing/cancel": "Subscription cancelled",
};

// Failures that shouldn't pop a toast (the app already redirects/handles them).
const SILENT_ERRORS = new Set(["auth/me"]);

const GENERIC_ERROR = "Something went wrong. Please try again.";

export const toastMiddleware = () => (next) => (action) => {
  const result = next(action);
  const type = action.type || "";

  if (type.endsWith("/fulfilled")) {
    const base = type.slice(0, -"/fulfilled".length);
    const msg = SUCCESS[base];
    const text = typeof msg === "function" ? msg(action.meta?.arg) : msg;
    if (text) toast.success(text);
  } else if (type.endsWith("/rejected")) {
    const base = type.slice(0, -"/rejected".length);
    const err = action.error || {};
    const cancelled = err.name === "CanceledError" || err.message?.includes("Session changed");
    if (!SILENT_ERRORS.has(base) && !cancelled && !action.meta?.aborted) {
      const text = typeof action.payload === "string" ? action.payload : err.message;
      toast.error(text && !text.startsWith("Request failed with status code") ? text : GENERIC_ERROR);
    }
  }
  return result;
};
