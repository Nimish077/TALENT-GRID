import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/layout/navbar.jsx";
import ProtectedRoute from "./components/layout/protected-route.jsx";
import Landing from "./components/landing/landing-page.jsx";
import AuthProvider from "./context/auth-provider.jsx";
import Dashboard from "./pages/dashboard.jsx";
import Login from "./pages/login.jsx";
import Register from "./pages/register.jsx";

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
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
