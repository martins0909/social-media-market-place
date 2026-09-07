import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const token = useMemo(() => (params.get("token") || "").trim(), [params]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error("Reset token is missing. Please use the link from your email.");
      return;
    }

    if (!password || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    setIsSaving(true);
    try {
      await apiFetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      toast.success("Password reset successfully. Please sign in.");
      navigate("/auth");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-gray-50 dark:bg-black">
      <div className="w-full max-w-md">
        <Card className="bg-white/95 dark:bg-black/95 backdrop-blur-xl shadow-2xl border-white/60 dark:border-gray-800 border-2 overflow-hidden">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-[#0d4f9f] dark:text-[#4d9cff] flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Reset Password
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Set a new password for your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="new-password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  New Password
                </label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 border-2 border-gray-200 dark:border-gray-700 focus:border-[#1565C0] rounded-xl bg-white/80 dark:bg-[#09090b]/80"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="confirm-password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Confirm Password
                </label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 border-2 border-gray-200 dark:border-gray-700 focus:border-[#1565C0] rounded-xl bg-white/80 dark:bg-[#09090b]/80"
                  required
                />
              </div>

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-11 rounded-xl border-2"
                  onClick={() => navigate("/auth")}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 h-11 bg-[#1565C0] hover:bg-[#0d4f9f] text-white rounded-xl font-semibold"
                >
                  {isSaving ? "Saving..." : "Save Password"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
