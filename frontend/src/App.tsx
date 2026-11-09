import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/types";
import AccountPage from "@/pages/account";
import ApplicationDetailPage from "@/pages/application-detail";
import ApplicationsPage from "@/pages/applications";
import DashboardPage from "@/pages/dashboard";
import EditApplicationPage from "@/pages/edit-application";
import LoginPage from "@/pages/login";
import NewApplicationPage from "@/pages/new-application";
import NotFoundPage from "@/pages/not-found";
import OfficersPage from "@/pages/officers";
import PrintApplicationPage from "@/pages/print-application";

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, loading, hasRole } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !hasRole(...roles)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/applications/:reference/print"
        element={
          <RequireAuth>
            <PrintApplicationPage />
          </RequireAuth>
        }
      />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="applications" element={<ApplicationsPage />} />
        <Route path="queue" element={<ApplicationsPage queue />} />
        <Route
          path="applications/new"
          element={
            <RequireAuth roles={["capture_officer", "land_officer"]}>
              <NewApplicationPage />
            </RequireAuth>
          }
        />
        <Route path="applications/:reference" element={<ApplicationDetailPage />} />
        <Route path="applications/:reference/edit" element={<EditApplicationPage />} />
        <Route
          path="officers"
          element={
            <RequireAuth roles={["admin"]}>
              <OfficersPage />
            </RequireAuth>
          }
        />
        <Route path="account" element={<AccountPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

