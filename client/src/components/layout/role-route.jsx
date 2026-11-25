import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/auth-context.js";

// Must be nested inside <ProtectedRoute/>: sends users whose role isn't
// allowed back to their own dashboard.
function RoleRoute({ roles }) {
  const { user } = useAuth();
  if (!roles.includes(user?.role)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export default RoleRoute;
