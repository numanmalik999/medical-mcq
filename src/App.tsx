import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import QuizPage from "./pages/QuizPage";
import AddMcqPage from "./pages/AddMcqPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import ManageMcqsPage from "./pages/ManageMcqsPage";
import ManageCategoriesPage from "./pages/ManageCategoriesPage";
import ManageSubscriptionsPage from "./pages/ManageSubscriptionsPage"; // Import ManageSubscriptionsPage
import { SessionContextProvider } from "./components/SessionContextProvider";
import AdminLayout from "./components/AdminLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SessionContextProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Index />} />
            <Route path="/quiz" element={<QuizPage />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="dashboard" element={<AdminDashboardPage />} />
              <Route path="add-mcq" element={<AddMcqPage />} />
              <Route path="manage-mcqs" element={<ManageMcqsPage />} />
              <Route path="manage-categories" element={<ManageCategoriesPage />} />
              <Route path="manage-subscriptions" element={<ManageSubscriptionsPage />} /> {/* New admin route */}
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