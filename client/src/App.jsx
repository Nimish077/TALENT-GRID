import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/layout/navbar.jsx";
import ProtectedRoute from "./components/layout/protected-route.jsx";
import PortalLayout from "./components/layout/portal-layout.jsx";
import RoleRoute from "./components/layout/role-route.jsx";
import Landing from "./components/landing/landing-page.jsx";
import AuthProvider from "./context/auth-provider.jsx";
import Dashboard from "./pages/dashboard.jsx";
import AdminLogin from "./pages/admin-login.jsx";
import Login from "./pages/login.jsx";
import Register from "./pages/register.jsx";
import ApplicationsPage from "./pages/candidate/applications-page.jsx";
import AssessmentsPage from "./pages/candidate/assessments-page.jsx";
import JobsPage from "./pages/candidate/jobs-page.jsx";
import ApplicantsPage from "./pages/employer/applicants-page.jsx";
import ManageJobsPage from "./pages/employer/manage-jobs-page.jsx";
import PostJobPage from "./pages/employer/post-job-page.jsx";
import StudentsPage from "./pages/institute/students-page.jsx";
import DrivesPage from "./pages/institute/drives-page.jsx";
import SkillsPage from "./pages/candidate/skills-page.jsx";
import TakeAssessmentPage from "./pages/candidate/take-assessment-page.jsx";
import TalentPage from "./pages/employer/talent-page.jsx";
import CandidateDetailPage from "./pages/employer/candidate-detail-page.jsx";
import ApprovalsPage from "./pages/admin/approvals-page.jsx";
import UsersPage from "./pages/admin/users-page.jsx";

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <Navbar />
              <Landing />
            </>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<PortalLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route element={<RoleRoute roles={["candidate"]} />}>
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/applications" element={<ApplicationsPage />} />
            <Route path="/skills" element={<SkillsPage />} />
            <Route path="/assessments" element={<AssessmentsPage />} />
            <Route path="/assessments/attempts/:attemptId" element={<TakeAssessmentPage />} />
          </Route>
          <Route element={<RoleRoute roles={["employer"]} />}>
            <Route path="/employer/talent" element={<TalentPage />} />
            <Route path="/employer/talent/:candidateId" element={<CandidateDetailPage />} />
            <Route path="/employer/jobs" element={<ManageJobsPage />} />
            <Route path="/employer/jobs/new" element={<PostJobPage />} />
            <Route path="/employer/jobs/:jobId/applicants" element={<ApplicantsPage />} />
          </Route>
          <Route element={<RoleRoute roles={["admin"]} />}>
            <Route path="/admin/approvals" element={<ApprovalsPage />} />
            <Route path="/admin/users" element={<UsersPage />} />
          </Route>
          <Route element={<RoleRoute roles={["institute"]} />}>
            <Route path="/institute/students" element={<StudentsPage />} />
            <Route path="/institute/drives" element={<DrivesPage />} />
          </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
