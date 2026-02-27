import { Navigate, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { useAuthStore } from "@/stores/auth-store";
import { APP_NAME, MOCK_USER } from "@/lib/constants";

export function LoginPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const login = useAuthStore((s) => s.login);
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/dashboard";

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const handleLogin = () => {
    login(MOCK_USER);
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="w-full max-w-sm">
          <CardHeader className="items-center text-center">
            <motion.div
              initial={{ y: -10 }}
              animate={{ y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
            >
              <Activity className="mb-2 size-10 text-primary" />
            </motion.div>
            <CardTitle className="text-xl">{APP_NAME}</CardTitle>
            <CardDescription>Welcome back. Sign in to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <GoogleLoginButton onClick={handleLogin} />
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
