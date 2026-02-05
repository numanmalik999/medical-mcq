import { useEffect, lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ScrollToTop from "./components/ScrollToTop";
import BackToTop from "./components/BackToTop";
import { SessionContextProvider, useSession } from "./components/SessionContextProvider";
import Header from "./components/Header";
import Footer from "./components/Footer";
import SchemaMarkup from "./components/SchemaMarkup";
import LoadingBar from "./components/LoadingBar";
import { useGoogleAnalytics } from "@/hooks/use-google-analytics";

// Lazy-loaded Pages
const LandingPage = lazy(() => import("./pages/LandingPage"));
const DashboardRedirect = lazy(() => import("./pages/DashboardRedirect"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/Login"));
const SignUp = lazy(() => import("./pages/SignUp"));
const QuizPage = lazy(() => import("./pages/QuizPage"));
const AddMcqPage = lazy(() => import("./pages/AddMcqPage"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const ManageMcqsPage = lazy(() => import("./pages/ManageMcqsPage"));
const ManageCategoriesPage = lazy(() => import("./pages/ManageCategoriesPage"));
const ManageSubscriptionsPage = lazy(() => import("./pages/ManageSubscriptionsPage"));
const ManageUsersPage = lazy(() => import("./pages/ManageUsersPage"));
const UserSubscriptionsPage = lazy(() => import("./pages/UserSubscriptionsPage"));
const BulkUploadMcqsPage = lazy(() => import("./pages/BulkUploadMcqsPage"));
const SubmitMcqPage = lazy(() => import("./pages/SubmitMcqPage"));
const ManageSubmittedMcqsPage = lazy(() => import("./pages/ManageSubmittedMcqsPage"));
const ManageMcqFeedbackPage = lazy(() => import("./pages/ManageMcqFeedbackPage"));
const UserDashboardPage = lazy(() => import("./pages/UserDashboardPage"));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage"));
const TakeTestPage = lazy(() => import("./pages/TakeTestPage"));
const SubscriptionPage = lazy(() => import("./pages/SubscriptionPage"));
const PaymentPage = lazy(() => import("./pages/PaymentPage"));
const GenericStaticPage = lazy(() => import("./pages/GenericStaticPage"));
const BookmarkedMcqsPage = lazy(() => import("./pages/BookmarkedMcqsPage"));
const AdminSettingsPage = lazy(() => import("./pages/AdminSettingsPage"));
const ManageLandingPage = lazy(() => import("./pages/ManageLandingPage"));
const ManageCoursesPage = lazy(() => import("./pages/ManageCoursesPage"));
const ManageCourseTopicsPage = lazy(() => import("./pages/ManageCourseTopicsPage"));
const UserCoursesPage = lazy(() => import("./pages/UserCoursesPage"));
const UserCourseDetailsPage = lazy(() => import("./pages/UserCourseDetailsPage"));
const QuestionOfTheDayPage = lazy(() => import("./pages/QuestionOfTheDayPage"));
const ManageDailyMcqsPage = lazy(() => import("./pages/ManageDailyMcqsPage"));
const PasswordResetPage = lazy(() => import("./pages/PasswordResetPage"));
const ReviewsPage = lazy(() => import("./pages/ReviewsPage"));
const UserSuggestionsPage = lazy(() => import("./pages/UserSuggestionsPage"));
const ManageSuggestionsPage = lazy(() => import("./pages/ManageSuggestionsPage"));
const ManageVideosPage = lazy(() => import("./pages/ManageVideosPage"));
const UserVideosPage = lazy(() => import("./pages/UserVideosPage"));
const CaseStudiesPage = lazy(() => import("./pages/CaseStudiesPage"));
const ManageSeoPage = lazy(() => import("./pages/ManageSeoPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const FaqPage = lazy(() => import("./pages/FaqPage"));
const AboutUsPage = lazy(() => import("./pages/AboutUsPage"));
const SitemapPage = lazy(() => import("./pages/SitemapPage"));
const BlogListPage = lazy(() => import("./pages/BlogListPage"));
const BlogDetailsPage = lazy(() => import("./pages/BlogDetailsPage"));

// Components & Layouts
const AdminLayout = lazy(() => import("./components/AdminLayout"));
const UserLayout = lazy(() => import("./components/UserLayout"));
const AdminProtectedRoute = lazy(() => import("./components/AdminProtectedRoute"));
const UserProtectedRoute = lazy(() => import("./components/UserProtectedRoute"));
const AiChatbot = lazy(() => import("./components/AiChatbot"));

const queryClient = new QueryClient();

const AppContent = () => {
  useSession();
  useGoogleAnalytics();
  const location = useLocation();

  useEffect(() => {
    let link = document.querySelector("link[rel='canonical']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    const baseUrl = "https://www.studyprometric.com";
    const cleanPath = location.pathname === "/" ? "" : location.pathname;
    link.setAttribute("href", `${baseUrl}${cleanPath}`);
  }, [location]);

  return (
    <>
      <ScrollToTop />
      <BackToTop />
      <SchemaMarkup />
      <Header />
      <div className="flex flex-col min-h-screen">
        <main id="main-content" className="flex-grow">
          <Suspense fallback={<LoadingBar />}>
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
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/faq" element={<FaqPage />} />
              <Route path="/about" element={<AboutUsPage />} />
              <Route path="/sitemap" element={<SitemapPage />} />
              <Route path="/blog" element={<BlogListPage />} />
              <Route path="/blog/:slug" element={<BlogDetailsPage />} />

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
          </Suspense>
        </main>
        <Footer />
      </div>
      <Suspense fallback={null}>
        <AiChatbot />
      </Suspense>
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