import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import employeesReducer from "./slices/employeesSlice";
import attendanceReducer from "./slices/attendanceSlice";
import leaveReducer from "./slices/leaveSlice";
import payrollReducer from "./slices/payrollSlice";
import recruitmentReducer from "./slices/recruitmentSlice";
import performanceReducer from "./slices/performanceSlice";
import billingReducer from "./slices/billingSlice";
import usersReducer from "./slices/usersSlice";
import selfReducer from "./slices/selfSlice";
import holidaysReducer from "./slices/holidaysSlice";
import tasksReducer from "./slices/tasksSlice";
import feedReducer from "./slices/feedSlice";
import leavePolicyReducer from "./slices/leavePolicySlice";
import { toastMiddleware } from "./toastMiddleware";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    employees: employeesReducer,
    attendance: attendanceReducer,
    leave: leaveReducer,
    payroll: payrollReducer,
    recruitment: recruitmentReducer,
    performance: performanceReducer,
    billing: billingReducer,
    users: usersReducer,
    self: selfReducer,
    holidays: holidaysReducer,
    tasks: tasksReducer,
    feed: feedReducer,
    leavePolicy: leavePolicyReducer,
  },
  // API success/error → toast messages for the whole app (see toastMiddleware.js)
  middleware: (getDefault) => getDefault().concat(toastMiddleware),
});
