import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage"; // New Landing Page
import DashboardRedirect from "./pages/DashboardRedirect"; // Renamed Index to DashboardRedirect
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
import ManageSubmittedMcqsPage from "./pages/ManageSubmittedMcqsPage";
import ManageMcqFeedbackPage from "./pages/ManageMcqFeedbackPage";
import { SessionContextProvider, useSession } from "./components/SessionContextProvider"; // Import useSession
import AdminLayout from "./components/AdminLayout";
import UserLayout from "./components/UserLayout";
import UserDashboardPage from "./pages/UserDashboardPage";
import UserProfilePage from "./pages/UserProfilePage";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import UserProtectedRoute from "./components/UserProtectedRoute";
import TakeTestPage from "./pages/TakeTestPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import Header from "./components/Header";
import Footer from "./components/Footer"; // Import the new Footer component

// New static pages
import AboutUsPage from "./pages/AboutUsPage";
import ContactPage from "./pages/ContactPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";
import FAQPage from "./pages/FAQPage";
import BookmarkedMcqsPage from "./pages/BookmarkedMcqsPage"; // Import new page
import AdminSettingsPage from "./pages/AdminSettingsPage"; // Import new page

// New Course Pages
import ManageCoursesPage from "./pages/ManageCoursesPage";
import ManageCourseTopicsPage from "./pages/ManageCourseTopicsPage";
import UserCoursesPage from "./pages/UserCoursesPage";
import UserCourseDetailsPage from "./pages/UserCourseDetailsPage";

import QuestionOfTheDayPage from "./pages/QuestionOfTheDayPage"; // Import new page
import ManageDailyMcqsPage from "./pages/ManageDailyMcqsPage"; // Import new page

import { useGoogleAnalytics } from "@/hooks/use-google-analytics"; // Import useGoogleAnalytics hook
import ReturnRefundPolicyPage from "./pages/ReturnRefundPolicyPage"; // Import new page


const queryClient = new QueryClient();

const AppContent = () => {
  useSession();
  useGoogleAnalytics(); // Call the hook here to track page views

  return (
    <>
      <Header />
      <div className="flex flex-col min-h-screen"> {/* Added flex container for sticky footer */}
        <div className="flex-grow"> {/* Main content area */}
          <Routes>
            <Route path="/" element={<LandingPage />} /> {/* New Landing Page as root */}
            <Route path="/redirect" element={<DashboardRedirect />} /> {/* Old Index page, now a redirector */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/quiz" element={<QuizPage />} />
            <Route path="/subscription" element={<SubscriptionPage />} />
            <Route path="/quiz-of-the-day" element={<QuestionOfTheDayPage />} /> {/* New QOD route */}
            
            {/* New Static Pages */}
            <Route path="/about" element={<AboutUsPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsOfServicePage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/refund" element={<ReturnRefundPolicyPage />} /> {/* New route */}

            {/* Admin Routes - Protected */}
            <Route path="/admin" element={<AdminProtectedRoute />}>
              <Route element={<AdminLayout />}>
                <Route index element={<AdminDashboardPage />} />
                <Route path="dashboard" element={<AdminDashboardPage />} />
                <Route path="add-mcq" element={<AddMcqPage />} />
                <Route path="bulk-upload-mcqs" element={<BulkUploadMcqsPage />} />
                <Route path="manage-mcqs" element={<ManageMcqsPage />} />
                <Route path="manage-daily-mcqs" element={<ManageDailyMcqsPage />} /> {/* New route */}
                <Route path="manage-submitted-mcqs" element={<ManageSubmittedMcqsPage />} />
                <Route path="manage-categories" element={<ManageCategoriesPage />} />
                <Route path="manage-courses" element={<ManageCoursesPage />} /> {/* New route */}
                <Route path="manage-courses/:courseId/topics" element={<ManageCourseTopicsPage />} /> {/* New route */}
                <Route path="manage-subscriptions" element={<ManageSubscriptionsPage />} />
                <Route path="manage-users" element={<ManageUsersPage />} />
                <Route path="manage-feedback" element={<ManageMcqFeedbackPage />} />
                <Route path="settings" element={<AdminSettingsPage />} /> {/* New route */}
              </Route>
            </Route>

            {/* User Routes - Protected */}
            <Route path="/user" element={<UserProtectedRoute />}>
              {/* TakeTestPage is now outside UserLayout for full width */}
              <Route path="take-test" element={<TakeTestPage />} /> 
              <Route element={<UserLayout />}>
                <Route index element={<UserDashboardPage />} />
                <Route path="dashboard" element={<UserDashboardPage />} />
                <Route path="profile" element={<UserProfilePage />} />
                <Route path="subscriptions" element={<UserSubscriptionsPage />} />
                <Route path="submit-mcq" element={<SubmitMcqPage />} />
                <Route path="bookmarked-mcqs" element={<BookmarkedMcqsPage />} />
                <Route path="courses" element={<UserCoursesPage />} /> {/* New route */}
                <Route path="courses/:courseId" element={<UserCourseDetailsPage />} /> {/* New route */}
              </Route>
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        <Footer /> {/* Always render Footer */}
      </div>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SessionContextProvider>
          <AppContent />
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;