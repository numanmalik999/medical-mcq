import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import DashboardRedirect from "./pages/DashboardRedirect";
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
import { SessionContextProvider, useSession } from "./components/SessionContextProvider";
import AdminLayout from "./components/AdminLayout";
import UserLayout from "./components/UserLayout";
import UserDashboardPage from "./pages/UserDashboardPage";
import UserProfilePage from "./pages/UserProfilePage";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import UserProtectedRoute from "./components/UserProtectedRoute";
import TakeTestPage from "./pages/TakeTestPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import Header from "./components/Header";
import Footer from "./components/Footer";
import PaymentPage from "./pages/PaymentPage";
import AiChatbot from "./components/AiChatbot";
import GenericStaticPage from "./pages/GenericStaticPage";
import BookmarkedMcqsPage from "./pages/BookmarkedMcqsPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import ManageLandingPage from "./pages/ManageLandingPage";
import ManageCoursesPage from "./pages/ManageCoursesPage";
import ManageCourseTopicsPage from "./pages/ManageCourseTopicsPage";
import UserCoursesPage from "./pages/UserCoursesPage";
import UserCourseDetailsPage from "./pages/UserCourseDetailsPage";
import QuestionOfTheDayPage from "./pages/QuestionOfTheDayPage";
import ManageDailyMcqsPage from "./pages/ManageDailyMcqsPage";
import { useGoogleAnalytics } from "@/hooks/use-google-analytics";
import PasswordResetPage from "./pages/PasswordResetPage";
import ReviewsPage from "./pages/ReviewsPage";
import UserSuggestionsPage from "./pages/UserSuggestionsPage";
import ManageSuggestionsPage from "./pages/ManageSuggestionsPage";
import ManageVideosPage from "./pages/ManageVideosPage";
import UserVideosPage from "./pages/UserVideosPage";
import CaseStudiesPage from "./pages/CaseStudiesPage";

// New Tools
import ManageSeoPage from "./pages/ManageSeoPage";

const queryClient = new QueryClient();

const AppContent = () => {
  useSession();
  useGoogleAnalytics();

  return (
    <>
      <Header />
      <div className="flex flex-col min-h-screen">
        <div className="flex-grow">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/redirect" element={<DashboardRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/quiz" element={<QuizPage />} />
            <Route path="/subscription" element={<SubscriptionPage />} />
            <Route path="/quiz-of-the-day" element={<QuestionOfTheDayPage />} />
            <Route path="/reset-password" element={<PasswordResetPage />} />
            <Route path="/reviews" element={<ReviewsPage />} />

            <Route path="/admin" element={<AdminProtectedRoute />}>
              <Route element={<AdminLayout />}>
                <Route index element={<AdminDashboardPage />} />
                <Route path="dashboard" element={<AdminDashboardPage />} />
                <Route path="manage-landing-page" element={<ManageLandingPage />} />
                <Route path="add-mcq" element={<AddMcqPage />} />
                <Route path="bulk-upload-mcqs" element={<BulkUploadMcqsPage />} />
                <Route path="manage-mcqs" element={<ManageMcqsPage />} />
                <Route path="manage-daily-mcqs" element={<ManageDailyMcqsPage />} />
                <Route path="manage-submitted-mcqs" element={<ManageSubmittedMcqsPage />} />
                <Route path="manage-categories" element={<ManageCategoriesPage />} />
                <Route path="manage-courses" element={<ManageCoursesPage />} />
                <Route path="manage-courses/:courseId/topics" element={<ManageCourseTopicsPage />} />
                <Route path="manage-videos" element={<ManageVideosPage />} />
                <Route path="manage-subscriptions" element={<ManageSubscriptionsPage />} />
                <Route path="manage-users" element={<ManageUsersPage />} />
                <Route path="manage-feedback" element={<ManageMcqFeedbackPage />} />
                <Route path="manage-suggestions" element={<ManageSuggestionsPage />} />
                <Route path="seo" element={<ManageSeoPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
              </Route>
            </Route>

            <Route path="/user" element={<UserProtectedRoute />}>
              <Route path="take-test" element={<TakeTestPage />} /> 
              <Route path="payment/:tierId" element={<PaymentPage />} />
              <Route element={<UserLayout />}>
                <Route index element={<UserDashboardPage />} />
                <Route path="dashboard" element={<UserDashboardPage />} />
                <Route path="profile" element={<UserProfilePage />} />
                <Route path="subscriptions" element={<UserSubscriptionsPage />} />
                <Route path="submit-mcq" element={<SubmitMcqPage />} />
                <Route path="bookmarked-mcqs" element={<BookmarkedMcqsPage />} />
                <Route path="suggestions" element={<UserSuggestionsPage />} />
                <Route path="courses" element={<UserCoursesPage />} />
                <Route path="courses/:courseId" element={<UserCourseDetailsPage />} />
                <Route path="videos" element={<UserVideosPage />} />
                <Route path="case-studies" element={<CaseStudiesPage />} />
              </Route>
            </Route>

            <Route path="/:slug" element={<GenericStaticPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        <Footer />
      </div>
      <AiChatbot />
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