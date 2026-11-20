import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/auth-context.js";

function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p role="status" className="p-10 text-center text-text-secondary">Loading…</p>;
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

export default ProtectedRoute;
