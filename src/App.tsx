import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useViewportHeight } from "@/hooks/useViewportHeight";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Conversas from "./pages/Conversas";
import Kanban from "./pages/Kanban";
import Config from "./pages/Config";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  useViewportHeight();
  
  return (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-right" />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected routes with layout */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute adminOnly>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="/conversas" element={<Conversas />} />
              <Route path="/kanban" element={<Kanban />} />
              <Route path="/config" element={<Config />} />
            </Route>

            {/* Redirects */}
            <Route path="/" element={<Navigate to="/conversas" replace />} />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
};

export default App;
