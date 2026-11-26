import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/layout/navbar.jsx";
import ProtectedRoute from "./components/layout/protected-route.jsx";
import PortalLayout from "./components/layout/portal-layout.jsx";
import RoleRoute from "./components/layout/role-route.jsx";
import Landing from "./components/landing/landing-page.jsx";
import AuthProvider from "./context/auth-provider.jsx";
import Dashboard from "./pages/dashboard.jsx";
import Login from "./pages/login.jsx";
import Register from "./pages/register.jsx";
import ApplicationsPage from "./pages/candidate/applications-page.jsx";
import AssessmentsPage from "./pages/candidate/assessments-page.jsx";
import JobsPage from "./pages/candidate/jobs-page.jsx";
import ApplicantsPage from "./pages/employer/applicants-page.jsx";
import ManageJobsPage from "./pages/employer/manage-jobs-page.jsx";
import PostJobPage from "./pages/employer/post-job-page.jsx";
import StudentsPage from "./pages/institute/students-page.jsx";

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
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<PortalLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route element={<RoleRoute roles={["candidate"]} />}>
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/applications" element={<ApplicationsPage />} />
            <Route path="/assessments" element={<AssessmentsPage />} />
          </Route>
          <Route element={<RoleRoute roles={["employer"]} />}>
            <Route path="/employer/jobs" element={<ManageJobsPage />} />
            <Route path="/employer/jobs/new" element={<PostJobPage />} />
            <Route path="/employer/jobs/:jobId/applicants" element={<ApplicantsPage />} />
          </Route>
          <Route element={<RoleRoute roles={["institute"]} />}>
            <Route path="/institute/students" element={<StudentsPage />} />
          </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
