import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom"; // Added Link import
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
// import SignUp from "./pages/SignUp"; // Temporarily comment out custom SignUp import
import QuizPage from "./pages/QuizPage";
import AddMcqPage from "./pages/AddMcqPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import ManageMcqsPage from "./pages/ManageMcqsPage";
import ManageCategoriesPage from "./pages/ManageCategoriesPage";
import ManageSubscriptionsPage from "./pages/ManageSubscriptionsPage";
import ManageUsersPage from "./pages/ManageUsersPage";
import { SessionContextProvider } from "./components/SessionContextProvider";
import AdminLayout from "./components/AdminLayout";
import UserLayout from "./components/UserLayout";
import UserDashboardPage from "./pages/UserDashboardPage";
import UserProfilePage from "./pages/UserProfilePage";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import UserProtectedRoute from "./components/UserProtectedRoute";
import TakeTestPage from "./pages/TakeTestPage";

// Import Supabase Auth UI components for temporary diagnostic
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SessionContextProvider>
          <Routes>
            <Route path="/" element={<Index />} />

            <Route path="/login" element={<Login />} />
            {/* TEMPORARY: Render Supabase Auth UI with sign_up view directly on /signup */}
            <Route path="/signup" element={
              <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
                <div className="w-full max-w-md bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
                  <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-6">Supabase Sign Up Test</h1>
                  <Auth
                    supabaseClient={supabase}
                    providers={[]}
                    appearance={{
                      theme: ThemeSupa,
                      variables: {
                        default: {
                          colors: {
                            brand: 'hsl(var(--primary))',
                            brandAccent: 'hsl(var(--primary-foreground))',
                          },
                        },
                      },
                    }}
                    theme="light"
                    view="sign_up" // Explicitly set to sign_up view
                  />
                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <Link to="/login" className="text-primary hover:underline">
                      Log In
                    </Link>
                  </p>
                </div>
              </div>
            } />
            {/* Original custom SignUp route: <Route path="/signup" element={<SignUp />} /> */}

            <Route path="/quiz" element={<QuizPage />} />
            
            {/* Admin Routes - Protected */}
            <Route path="/admin" element={<AdminProtectedRoute />}>
              <Route element={<AdminLayout />}>
                <Route index element={<AdminDashboardPage />} />
                <Route path="dashboard" element={<AdminDashboardPage />} />
                <Route path="add-mcq" element={<AddMcqPage />} />
                <Route path="manage-mcqs" element={<ManageMcqsPage />} />
                <Route path="manage-categories" element={<ManageCategoriesPage />} />
                <Route path="manage-subscriptions" element={<ManageSubscriptionsPage />} />
                <Route path="manage-users" element={<ManageUsersPage />} />
              </Route>
            </Route>

            {/* User Routes - Protected */}
            <Route path="/user" element={<UserProtectedRoute />}>
              <Route element={<UserLayout />}>
                <Route index element={<UserDashboardPage />} />
                <Route path="dashboard" element={<UserDashboardPage />} />
                <Route path="profile" element={<UserProfilePage />} />
                <Route path="take-test" element={<TakeTestPage />} />
                {/* Add more user-specific routes here */}
              </Route>
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;