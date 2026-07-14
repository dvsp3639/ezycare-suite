import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ClinicDataProvider } from "@/contexts/ClinicDataContext";
import { WardsBedProvider } from "@/contexts/WardsBedContext";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import DashboardLayout from "./components/DashboardLayout";
import PatientRegistration from "./pages/PatientRegistration";
import ClinicManagement from "./pages/ClinicManagement";
import Pharmacy from "./pages/Pharmacy";
import Diagnostics from "./pages/Diagnostics";
import Inventory from "./pages/Inventory";
import DayCare from "./pages/DayCare";
import IPD from "./pages/IPD";
import StaffPayroll from "./pages/StaffPayroll";
import Accounts from "./pages/Accounts";
import DebugUpload from "./pages/DebugUpload";
import AiCoreTestUpload from "./pages/AiCoreTestUpload";
import AiEngineV2Test from "./pages/AiEngineV2Test";
import ModulePlaceholder from "./pages/ModulePlaceholder";
import UsersRoles from "./pages/UsersRoles";
import SuperAdminConsole from "./pages/SuperAdminConsole";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <DashboardLayout>{children}</DashboardLayout>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading, isHospitalAdmin, isSuperAdmin } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isHospitalAdmin && !isSuperAdmin) return <Navigate to="/dashboard" replace />;
  return <DashboardLayout>{children}</DashboardLayout>;
};

const SuperAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading, isSuperAdmin } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
    <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
    <Route path="/patient-registration" element={<ProtectedRoute><PatientRegistration /></ProtectedRoute>} />
    <Route path="/clinic-management" element={<ProtectedRoute><ClinicManagement /></ProtectedRoute>} />
    <Route path="/pharmacy" element={<ProtectedRoute><Pharmacy /></ProtectedRoute>} />
    <Route path="/diagnostics" element={<ProtectedRoute><Diagnostics /></ProtectedRoute>} />
    <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
    <Route path="/day-care" element={<ProtectedRoute><DayCare /></ProtectedRoute>} />
    <Route path="/ipd" element={<ProtectedRoute><IPD /></ProtectedRoute>} />
    <Route path="/staff-payroll" element={<ProtectedRoute><StaffPayroll /></ProtectedRoute>} />
    <Route path="/accounts" element={<ProtectedRoute><Accounts /></ProtectedRoute>} />
    <Route path="/debug-upload" element={<ProtectedRoute><DebugUpload /></ProtectedRoute>} />
    <Route path="/ai-core/test-upload" element={<ProtectedRoute><AiCoreTestUpload /></ProtectedRoute>} />
    <Route path="/ai-engine-v2/test" element={<ProtectedRoute><AiEngineV2Test /></ProtectedRoute>} />
    <Route path="/users-roles" element={<AdminRoute><UsersRoles /></AdminRoute>} />
    <Route path="/super-admin" element={<SuperAdminRoute><SuperAdminConsole /></SuperAdminRoute>} />
    <Route path="/:moduleId" element={<ProtectedRoute><ModulePlaceholder /></ProtectedRoute>} />
    <Route path="/" element={<Navigate to="/login" replace />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ClinicDataProvider>
        <WardsBedProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </WardsBedProvider>
      </ClinicDataProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
