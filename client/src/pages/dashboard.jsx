import { useAuth } from "../context/auth-context.js";
import AdminDashboard from "./dashboards/admin-dashboard.jsx";
import CandidateDashboard from "./dashboards/candidate-dashboard.jsx";
import EmployerDashboard from "./dashboards/employer-dashboard.jsx";
import InstituteDashboard from "./dashboards/institute-dashboard.jsx";

const dashboards = {
  admin: AdminDashboard,
  candidate: CandidateDashboard,
  employer: EmployerDashboard,
  institute: InstituteDashboard,
};

function AdminPlaceholder({ user }) {
  return (
    <main className="mx-auto max-w-[640px] px-5 py-20 text-center">
      <h1 className="text-2xl tracking-[-0.03em]">Welcome, {user.full_name}</h1>
      <p className="mt-3 text-text-secondary">You are signed in as a platform administrator.</p>
    </main>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const RoleDashboard = dashboards[user.role];
  return RoleDashboard ? <RoleDashboard /> : <AdminPlaceholder user={user} />;
}

export default Dashboard;
