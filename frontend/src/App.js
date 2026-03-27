import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Toaster } from "./components/ui/sonner";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import InterestsPage from "./pages/InterestsPage";
import SourcesPage from "./pages/SourcesPage";
import NotificationsPage from "./pages/NotificationsPage";
import ProfilePage from "./pages/ProfilePage";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#D86246] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg text-[#4A4A4A]">Loading...</p>
        </div>
      </div>
    );
  }

  if (user === false) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#D86246] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user && user !== false) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="interests" element={<InterestsPage />} />
            <Route path="sources" element={<SourcesPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </AuthProvider>
  );
}

export default App;
