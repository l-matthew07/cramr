import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Dashboard } from "./pages/Dashboard";
import { SessionPage } from "./pages/Session";
import { GroupPage } from "./pages/Group";
import { CoursePage } from "./pages/Course";
import { CreateCourse } from "./pages/CreateCourse";
import { Profile } from "./pages/Profile";
import { UserProfilePage } from "./pages/UserProfile";
import { Onboarding } from "./pages/Onboarding";
import { Join } from "./pages/Join";
import { NotFound } from "./pages/NotFound";
import { Layout } from "./components/Layout";
import { SignIn } from "./pages/SignIn";
import { useMe } from "./lib/api";
import { ClerkTokenProvider, DevTokenProvider } from "./lib/auth";
import { identifyUser } from "./lib/analytics";

const hasClerk = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export function App() {
  if (hasClerk) {
    return (
      <ClerkTokenProvider>
        <AuthedApp />
      </ClerkTokenProvider>
    );
  }
  return (
    <DevTokenProvider>
      <Shell />
    </DevTokenProvider>
  );
}

function AuthedApp() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <FullscreenSpinner />;
  if (!isSignedIn) {
    return (
      <Routes>
        <Route path="/sign-in/*" element={<SignIn />} />
        <Route path="/join/:code" element={<Join />} />
        <Route path="*" element={<Navigate to="/sign-in" replace />} />
      </Routes>
    );
  }
  return <Shell />;
}

function Shell() {
  const me = useMe();

  // Identify user in PostHog once their data is loaded
  useEffect(() => {
    if (me.data) {
      identifyUser(me.data.id, {
        email: me.data.email,
        displayName: me.data.displayName,
      });
    }
  }, [me.data?.id]);

  if (me.isLoading) return <FullscreenSpinner />;
  if (me.isError) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center">
        <div className="text-red-500 mb-2">Error connecting to the API.</div>
        <p className="text-ink-300 text-sm">Make sure the backend is running (run <code>pnpm dev</code> from the root).</p>
      </div>
    );
  }
  const needsOnboarding = me.data && !me.data.onboarded;

  return (
    <Routes>
      <Route path="/join/:code" element={<Join />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route element={<Layout />}>
        <Route
          path="/"
          element={needsOnboarding ? <Navigate to="/onboarding" replace /> : <Dashboard />}
        />
        <Route path="/session" element={<SessionPage />} />
        <Route path="/groups/:id" element={<GroupPage />} />
        <Route path="/users/:id" element={<UserProfilePage />} />
        <Route path="/courses/new" element={<CreateCourse />} />
        <Route path="/courses/:id" element={<CoursePage />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function FullscreenSpinner() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="animate-pulse text-ink-400">loading…</div>
    </div>
  );
}
