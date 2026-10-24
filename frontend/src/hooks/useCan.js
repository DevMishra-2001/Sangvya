import { useSelector } from "react-redux";

// Returns can(permission) for the logged-in user. The permission list comes
// from the backend (backend/src/config/permissions.js), so the UI and API
// always agree on who can do what. The backend still enforces every rule —
// this only hides buttons/pages a user couldn't use anyway.
export default function useCan() {
  const permissions = useSelector((state) => state.auth.user?.permissions) || [];
  return (permission) => permissions.includes(permission);
}
