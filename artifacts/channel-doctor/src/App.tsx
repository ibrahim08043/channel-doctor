import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { registerTokenGetter } from "./main";
import Layout from "@/components/Layout";
import HomePage from "@/pages/Home";
import ChannelPage from "@/pages/Channel";
import DashboardPage from "@/pages/Dashboard";
import SavedPage from "@/pages/Saved";
import SettingsPage from "@/pages/Settings";
import ProfilePage from "@/pages/Profile";
import PlannerPage from "@/pages/Planner";
import SocialAnalyzerPage from "@/pages/SocialAnalyzer";
import ConnectPage from "@/pages/Connect";
import SignInPage from "@/pages/SignIn";
import SignUpPage from "@/pages/SignUp";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AuthBridge() {
  const { getToken, isSignedIn } = useAuth();
  useEffect(() => {
    registerTokenGetter(isSignedIn ? () => getToken() : null);
    return () => registerTokenGetter(null);
  }, [getToken, isSignedIn]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/channel/:id" component={ChannelPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/saved" component={SavedPage} />
      <Route path="/planner" component={PlannerPage} />
      <Route path="/social" component={SocialAnalyzerPage} />
      <Route path="/connect" component={ConnectPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/sign-in" component={SignInPage} />
      <Route path="/sign-in/:rest*" component={SignInPage} />
      <Route path="/sign-up" component={SignUpPage} />
      <Route path="/sign-up/:rest*" component={SignUpPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthBridge />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Layout>
            <Router />
          </Layout>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
