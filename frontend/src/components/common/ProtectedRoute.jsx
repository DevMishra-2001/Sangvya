import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import useCan from "../../hooks/useCan";

// Wraps any page that requires login. Not logged in → /login.
// With `permission`, also bounces users whose role lacks it back to the dashboard.
// (App waits for the startup session check before rendering routes.)
export default function ProtectedRoute({ children, permission }) {
  const user = useSelector((state) => state.auth.user);
  const can = useCan();

  if (!user) return <Navigate to="/login" replace />;
  if (permission && !can(permission)) return <Navigate to="/" replace />;
  return children;
}
