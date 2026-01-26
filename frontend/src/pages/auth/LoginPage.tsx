import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FcGoogle } from "react-icons/fc"; // Official Google Color Icon

export default function LoginPage() {
  const handleGoogleLogin = () => {
    window.location.href = "https://localhost:5001/auth/google";
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
            variant="outline" // Often used for social logins
            className="w-full bg-white text-black hover:bg-gray-200 flex items-center justify-center gap-2"
            onClick={handleGoogleLogin}
          >
            <FcGoogle className="h-5 w-5" /> {/* Icon added here */}
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
