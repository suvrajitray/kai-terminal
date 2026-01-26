// import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  // const navigate = useNavigate();

  // const handleLogin = () => {
  //   // TEMP: replace with real Google OAuth
  //   localStorage.setItem("auth", "true");
  //   navigate("/");
  // };

  const handleGoogleLogin = () => {
    window.location.href = "http://localhost:5122/auth/google";
  };

  return (
    <div className="min-h-screen bg-[#0b0f14] flex items-center justify-center">
      <Card className="bg-[#111827] border border-gray-800 rounded-2xl w-[360px]">
        <CardContent className="p-8 flex flex-col gap-6">
          <h1 className="text-2xl font-semibold text-white text-center">
            KAI Terminal Pro
          </h1>

          <p className="text-sm text-gray-400 text-center">
            Sign in to continue
          </p>

          <Button
            className="w-full bg-white text-black hover:bg-gray-200"
            onClick={handleGoogleLogin}
          >
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
