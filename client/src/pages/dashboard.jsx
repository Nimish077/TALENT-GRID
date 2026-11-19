import { useNavigate } from "react-router-dom";
import AuthLayout from "../components/layout/auth-layout.jsx";
import Button from "../components/ui/button.jsx";
import { useAuth } from "../context/auth-context.js";

const roleCopy = {
  candidate: "Build your profile, add skills, and take assessments to verify them.",
  employer: "Your organization is pending verification. You can post jobs once an admin approves it.",
  institute: "Your institution is pending verification. You can manage students and drives once approved.",
  admin: "You are signed in as a platform administrator.",
};

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-[640px] rounded-xl border border-border bg-surface p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">{user.role}</p>
        <h1 className="mt-2 text-2xl tracking-[-0.03em]">Welcome, {user.full_name}</h1>
        <p className="mt-3 text-text-secondary">{roleCopy[user.role]}</p>
        <p className="mt-1 text-sm text-text-muted">{user.email}</p>
        <Button variant="outline" className="mt-7" onClick={handleLogout}>Log out</Button>
      </div>
    </AuthLayout>
  );
}

export default Dashboard;
