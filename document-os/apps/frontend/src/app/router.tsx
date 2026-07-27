import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "@/app/app-shell";
import { LoginPage, RegisterPage } from "@/features/auth/auth-pages";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { EditorPage } from "@/features/editor/editor-page";
import { NotFoundPage } from "@/features/not-found";
import { TemplatesPage } from "@/features/templates/templates-page";
import { PublicDocumentPage } from "@/features/public/public-document-page";
import { useAuthStore } from "@/lib/auth-store";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const location = useLocation();
  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (accessToken) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ShellLayout() {
  return (
    <RequireAuth>
      <AppShell />
    </RequireAuth>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/share/:documentId" element={<PublicDocumentPage />} />
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <LoginPage />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/register"
        element={
          <RedirectIfAuthed>
            <RegisterPage />
          </RedirectIfAuthed>
        }
      />
      <Route element={<ShellLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/doc/:documentId" element={<EditorPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
