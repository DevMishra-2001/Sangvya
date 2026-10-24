import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import ProtectedRoute from "./components/common/ProtectedRoute";
import Sidebar from "./components/common/Sidebar";
import Header from "./components/common/Header";
import { fetchMe } from "./store/slices/authSlice";
import useFontSize from "./hooks/useFontSize";
import useSessionKeepAlive from "./hooks/useSessionKeepAlive";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import EmployeesPage from "./pages/EmployeesPage";
import AttendancePage from "./pages/AttendancePage";
import LeavePage from "./pages/LeavePage";
import PayrollPage from "./pages/PayrollPage";
import RecruitmentPage from "./pages/RecruitmentPage";
import PerformancePage from "./pages/PerformancePage";
import BillingPage from "./pages/BillingPage";
import UsersPage from "./pages/UsersPage";
import AttendanceTodayPage from "./pages/attendance/AttendanceTodayPage";
import AttendanceCalendarPage from "./pages/attendance/AttendanceCalendarPage";
import AttendanceReportPage from "./pages/attendance/AttendanceReportPage";
import LeaveViewApprovalPage from "./pages/attendance/LeaveViewApprovalPage";
import LeavePolicyPage from "./pages/LeavePolicyPage";
import HolidaysPage from "./pages/HolidaysPage";
import TicketsPage from "./pages/TicketsPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";

// Shared shell (sidebar + content area) for every protected page.
function AppShell({ children }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 px-10 py-8">{children}</main>
      </div>
    </div>
  );
}

// Protected page inside the app shell, optionally gated by a permission key.
function Page({ permission, children }) {
  return (
    <ProtectedRoute permission={permission}>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}

export default function App() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const checked = useSelector((state) => state.auth.checked);

  useFontSize(); // apply the user's saved font size to the whole app
  useSessionKeepAlive(); // refresh while active, log out after 20 min idle

  // On load, ask the API who is logged in (the session is an HttpOnly cookie)
  useEffect(() => {
    if (!checked) dispatch(fetchMe());
  }, [dispatch, checked]);

  if (!checked) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate">Loading…</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/signup" element={user ? <Navigate to="/" replace /> : <SignupPage />} />
      <Route path="/forgot-password" element={user ? <Navigate to="/" replace /> : <ForgotPasswordPage />} />
      <Route path="/" element={<Page><DashboardPage /></Page>} />
      <Route path="/employees" element={<Page permission="employees.view"><EmployeesPage /></Page>} />
      <Route path="/attendance" element={<Page permission="attendance.view"><AttendancePage /></Page>} />
      <Route path="/leave" element={<Page permission="leave.apply"><LeavePage /></Page>} />
      <Route path="/payroll" element={<Page permission="payroll.view"><PayrollPage /></Page>} />
      <Route path="/recruitment" element={<Page permission="recruitment.view"><RecruitmentPage /></Page>} />
      <Route path="/performance" element={<Page permission="performance.view"><PerformancePage /></Page>} />
      <Route path="/billing" element={<Page permission="billing.view"><BillingPage /></Page>} />
      <Route path="/my-attendance" element={<Page permission="attendance.self"><AttendanceTodayPage /></Page>} />
      <Route path="/my-attendance/calendar" element={<Page permission="attendance.self"><AttendanceCalendarPage /></Page>} />
      <Route path="/my-attendance/report" element={<Page permission="attendance.self"><AttendanceReportPage /></Page>} />
      <Route path="/my-attendance/leaves" element={<Page permission="attendance.self"><LeaveViewApprovalPage /></Page>} />
      <Route path="/my-attendance/view" element={<Navigate to="/my-attendance/report" replace />} />
      <Route path="/leave-policy" element={<Page permission="leavePolicy.manage"><LeavePolicyPage /></Page>} />
      <Route path="/tickets" element={<Page><TicketsPage /></Page>} />
      <Route path="/change-password" element={<Page><ChangePasswordPage /></Page>} />
      <Route path="/tasks" element={<Navigate to="/tickets" replace />} />
      <Route path="/holidays" element={<Page permission="holidays.manage"><HolidaysPage /></Page>} />
      <Route path="/users" element={<Page permission="users.manage"><UsersPage /></Page>} />
    </Routes>
  );
}
