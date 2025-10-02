import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import QuizPage from "./pages/QuizPage";
import AddMcqPage from "./pages/AddMcqPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import ManageMcqsPage from "./pages/ManageMcqsPage";
import ManageCategoriesPage from "./pages/ManageCategoriesPage";
import ManageSubscriptionsPage from "./pages/ManageSubscriptionsPage";
import ManageUsersPage from "./pages/ManageUsersPage";
import UserSubscriptionsPage from "./pages/UserSubscriptionsPage";
import BulkUploadMcqsPage from "./pages/BulkUploadMcqsPage";
import SubmitMcqPage from "./pages/SubmitMcqPage";
import ManageSubmittedMcqsPage from "./pages/ManageSubmittedMcqsPage"; // Import new page
import ManageMcqFeedbackPage from "./pages/ManageMcqFeedbackPage"; // Import new page
import { SessionContextProvider } from "./components/SessionContextProvider";
import AdminLayout from "./components/AdminLayout";
import UserLayout from "./components/UserLayout";
import UserDashboardPage from "./pages/UserDashboardPage";
import UserProfilePage from "./pages/UserProfilePage";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import UserProtectedRoute from "./components/UserProtectedRoute";
import TakeTestPage from "./pages/TakeTestPage";

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
            <Route path="/signup" element={<SignUp />} />
            <Route path="/quiz" element={<QuizPage />} />
            
            {/* Admin Routes - Protected */}
            <Route path="/admin" element={<AdminProtectedRoute />}>
              <Route element={<AdminLayout />}>
                <Route index element={<AdminDashboardPage />} />
                <Route path="dashboard" element={<AdminDashboardPage />} />
                <Route path="add-mcq" element={<AddMcqPage />} />
                <Route path="bulk-upload-mcqs" element={<BulkUploadMcqsPage />} />
                <Route path="manage-mcqs" element={<ManageMcqsPage />} />
                <Route path="manage-submitted-mcqs" element={<ManageSubmittedMcqsPage />} /> {/* New route */}
                <Route path="manage-categories" element={<ManageCategoriesPage />} />
                <Route path="manage-subscriptions" element={<ManageSubscriptionsPage />} />
                <Route path="manage-users" element={<ManageUsersPage />} />
                <Route path="manage-feedback" element={<ManageMcqFeedbackPage />} /> {/* New route */}
              </Route>
            </Route>

            {/* User Routes - Protected */}
            <Route path="/user" element={<UserProtectedRoute />}>
              <Route element={<UserLayout />}>
                <Route index element={<UserDashboardPage />} />
                <Route path="dashboard" element={<UserDashboardPage />} />
                <Route path="profile" element={<UserProfilePage />} />
                <Route path="take-test" element={<TakeTestPage />} />
                <Route path="subscriptions" element={<UserSubscriptionsPage />} />
                <Route path="submit-mcq" element={<SubmitMcqPage />} />
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