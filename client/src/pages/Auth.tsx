import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Mail, Lock, User, ArrowRight, Shield } from "lucide-react";
import { apiFetch, catalogAPI, catalogCategoriesAPI, warmBackend } from "@/lib/api";
import logo from "@/assets/pics (2).png";
import customerCareImage from "@/assets/customercare.jpg";

const Auth = () => {
  const navigate = useNavigate();
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [showWakingMessage, setShowWakingMessage] = useState(false);
  const referralCode = new URLSearchParams(window.location.search).get("ref")?.trim().toUpperCase() || "";

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signInEmail || !signInPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSigningIn(true);
    
    // Show "Waking server..." hint if request takes longer than 2s
    const wakingTimer = setTimeout(() => {
      setShowWakingMessage(true);
    }, 2000);
    
    try {
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: signInEmail, password: signInPassword }),
      }) as { ok: boolean; user: { id: string; email: string; name?: string; balance: number; referralCode?: string } };

      localStorage.setItem("currentUser", JSON.stringify(data.user));
      toast.success("Welcome back!");
      // Fire-and-forget prefetch of shop data to speed up first render
      (async () => {
        try {
          const [prods, cats] = await Promise.all([
            catalogAPI.getAll(),
            catalogCategoriesAPI.getAll(),
          ]);
          sessionStorage.setItem("prefetch_products", JSON.stringify(prods));
          sessionStorage.setItem("prefetch_products_at", String(Date.now()));
          sessionStorage.setItem("prefetch_categories", JSON.stringify(cats));
          sessionStorage.setItem("prefetch_categories_at", String(Date.now()));
        } catch { /* ignore */ }
      })();
      navigate("/shop");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid credentials");
    } finally {
      clearTimeout(wakingTimer);
      setShowWakingMessage(false);
      setIsSigningIn(false);
    }
  };

  // Warm backend and prefetch shop data proactively to reduce sign-in latency
  useEffect(() => {
    let mounted = true;
    // Warm the backend (non-blocking)
    warmBackend().catch(() => {});

    // Prefetch products and categories in the background and cache for quick shop hydration
    (async () => {
      try {
        const [prods, cats] = await Promise.all([
          catalogAPI.getAll(),
          catalogCategoriesAPI.getAll(),
        ]);
        if (!mounted) return;
        sessionStorage.setItem("prefetch_products", JSON.stringify(prods));
        sessionStorage.setItem("prefetch_products_at", String(Date.now()));
        sessionStorage.setItem("prefetch_categories", JSON.stringify(cats));
        sessionStorage.setItem("prefetch_categories_at", String(Date.now()));
      } catch {
        // ignore prefetch errors
      }
    })();

    return () => { mounted = false; };
  }, []);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signUpEmail || !signUpPassword || !signUpConfirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (signUpPassword !== signUpConfirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    if (signUpPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsSigningUp(true);
    
    // Show "Waking server..." hint if request takes longer than 2s
    const wakingTimer = setTimeout(() => {
      setShowWakingMessage(true);
    }, 2000);
    
    try {
      const data = await apiFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: signUpEmail, password: signUpPassword, referralCode }),
      }) as { ok: boolean; user: { id: string; email: string; name?: string; balance: number; referralCode?: string } };

      localStorage.setItem("currentUser", JSON.stringify(data.user));
      toast.success("Account created successfully!");
      navigate("/shop");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      clearTimeout(wakingTimer);
      setShowWakingMessage(false);
      setIsSigningUp(false);
    }
  };

  useEffect(() => {
    if (!isResetDialogOpen) {
      setResetSent(false);
      setResendCooldown(0);
      setIsSendingReset(false);
    }
  }, [isResetDialogOpen]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedResetEmail = resetEmail.trim().toLowerCase();
    if (!normalizedResetEmail) {
      toast.error("Please enter your email address");
      return;
    }

    setIsSendingReset(true);
    try {
      await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedResetEmail }),
      });
      setResetSent(true);
      setResendCooldown(30);
      toast.success("If an account exists, a reset link has been sent. Check your inbox.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reset link");
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f9fc] px-4 py-8 dark:bg-[#0B0F14] sm:px-6 sm:py-12">
      {/* Animated gradient orbs */}
      {/* <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-[#4d9cff]/30 to-[#4d9cff]/30 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-br from-[#4d9cff]/30 to-[#4d9cff]/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-[#4d9cff]/20 to-[#4d9cff]/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div> */}
      
      <div className="relative z-10 grid w-full max-w-6xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#101820] lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative h-44 overflow-hidden lg:h-auto lg:min-h-[680px]">
          <img src={customerCareImage} alt="Customer care support" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F14] via-[#0B0F14]/35 to-[#1565C0]/20" />
          <div className="absolute bottom-5 left-5 right-5 text-white lg:bottom-10 lg:left-10 lg:right-10"><p className="mb-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#FFC107] lg:mb-3 lg:text-xs">Here when you need us</p><h2 className="text-2xl font-black leading-tight lg:text-4xl">A smoother way to manage your digital growth.</h2><p className="mt-2 hidden max-w-sm text-sm leading-6 text-white/75 lg:mt-4 lg:block">Create an account, fund your wallet, and get access to support whenever you need it.</p></div>
        </div>
      <div className="w-full max-w-md justify-self-center px-1 py-2 sm:px-4 lg:px-8 lg:py-10">
        {/* Header with logo */}
        <div className="text-center mb-8 animate-in fade-in slide-in-from-top duration-500">
          <div className="inline-flex items-center justify-center mb-4">
            <img 
              src={logo} 
              alt="Social Media Marketplace" 
              className="h-16 w-auto drop-shadow-2xl"
            />
          </div>
          <h1 
            className="text-2xl md:text-3xl font-bold text-[#1565C0] mb-3 animate-shimmer"
            style={{ fontFamily: 'Poppins, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial' }}
          >
            Welcome 
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">Your trusted marketplace for authentic accounts</p>
        </div>

        <Tabs defaultValue="signin" className="w-full animate-in fade-in slide-in-from-bottom duration-700">
          <TabsList className="grid w-full grid-cols-2 bg-white/90 dark:bg-black/90 backdrop-blur-md shadow-lg p-1 h-12">
            <TabsTrigger 
              value="signin" 
              className="data-[state=active]:bg-[#1565C0] data-[state=active]:text-white rounded-lg transition-all duration-300 font-medium dark:text-gray-300"
            >
              <User className="w-4 h-4 mr-2" />
              Sign In
            </TabsTrigger>
            <TabsTrigger 
              value="signup" 
              className="data-[state=active]:bg-[#1565C0] data-[state=active]:text-white rounded-lg transition-all duration-300 font-medium dark:text-gray-300"
            >
              <Mail className="w-4 h-4 mr-2" />
              Sign Up
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="signin" className="mt-6">
            <Card className="bg-white/95 dark:bg-black/95 backdrop-blur-xl shadow-2xl border-white/60 dark:border-gray-800 border-2 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#e8f1ff]/50 via-transparent to-[#e8f1ff]/50 dark:from-[#0B0F14]/30 dark:to-[#0B0F14]/30 pointer-events-none"></div>
              <CardHeader className="relative space-y-1 pb-6">
                <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#0d4f9f] to-[#0a3d7c]">Sign In</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">Enter your credentials to access your account</CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <form onSubmit={handleSignIn} className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="signin-email" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-[#1565C0]" />
                      Email
                    </label>
                    <div className="relative group">
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="your@email.com"
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        required
                        className="pl-11 h-12 border-2 border-gray-200 dark:border-gray-700 focus:border-[#1565C0] transition-all duration-300 rounded-xl bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-sm text-gray-900 dark:text-gray-100"
                      />
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#1565C0] transition-colors" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="signin-password" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-[#1565C0]" />
                      Password
                    </label>
                    <div className="relative group">
                      <Input
                        id="signin-password"
                        type="password"
                        placeholder="••••••••"
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        required
                        className="pl-11 h-12 border-2 border-gray-200 dark:border-gray-700 focus:border-[#1565C0] transition-all duration-300 rounded-xl bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-sm text-gray-900 dark:text-gray-100"
                      />
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#1565C0] transition-colors" />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={isSigningIn}
                    className="w-full bg-[#1565C0] hover:bg-[#0d4f9f] text-white h-12 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
                  >
                    <span className="flex items-center justify-center gap-2">
                      {isSigningIn ? "Signing In..." : "Sign In"}
                      {!isSigningIn && <ArrowRight className="w-4 h-4" />}
                    </span>
                  </Button>
                  
                  {showWakingMessage && (
                    <div className="text-center text-sm text-[#1565C0] dark:text-[#4d9cff] animate-pulse">
                      Waking server... This takes a moment after inactivity
                    </div>
                  )}
                </form>

                <div className="text-center pt-2">
                  <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="link" className="text-sm text-[#1565C0] hover:text-[#0d4f9f] dark:text-[#4d9cff] dark:hover:text-[#8fb5e8] font-medium">
                        Forgot Password?
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-white/95 backdrop-blur-xl border-2 border-white/60 shadow-2xl dark:bg-black/95 dark:border-gray-800">
                      <DialogHeader>
                        <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#0d4f9f] to-[#0a3d7c] dark:from-[#4d9cff] dark:to-[#1565C0] flex items-center gap-2">
                          <Mail className="w-5 h-5 text-[#1565C0]" />
                          Reset Your Password
                        </DialogTitle>
                        <DialogDescription className="text-gray-600 dark:text-gray-400">
                          Enter your email address and we'll send you a link to reset your password.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleForgotPassword} className="space-y-5 mt-4">
                        <div className="space-y-2">
                          <label htmlFor="reset-email" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Mail className="w-4 h-4 text-[#1565C0]" />
                            Email Address
                          </label>
                          <div className="relative group">
                            <Input
                              id="reset-email"
                              type="email"
                              placeholder="your@email.com"
                              value={resetEmail}
                              onChange={(e) => setResetEmail(e.target.value)}
                              required
                              className="pl-11 h-12 border-2 border-gray-200 focus:border-[#1565C0] transition-all duration-300 rounded-xl bg-white/80 backdrop-blur-sm dark:border-gray-700 dark:bg-[#09090b]/80 dark:text-gray-100 dark:placeholder:text-gray-500"
                            />
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#1565C0] transition-colors" />
                          </div>
                        </div>
                        {resetSent && (
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Didn’t get the email? You can resend the reset link.
                          </div>
                        )}

                        <div className="flex gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            className="flex-1 h-11 rounded-xl border-2 hover:bg-gray-50 transition-all duration-300"
                            onClick={() => setIsResetDialogOpen(false)}
                          >
                            Close
                          </Button>
                          <Button
                            type="submit"
                            disabled={isSendingReset || resendCooldown > 0}
                            className="flex-1 h-11 bg-[#1565C0] hover:bg-[#0d4f9f] text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                          >
                            {isSendingReset
                              ? "Sending..."
                              : resetSent
                                ? resendCooldown > 0
                                  ? `Resend (${resendCooldown}s)`
                                  : "Resend"
                                : "Send Reset Link"}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="signup" className="mt-6">
            <Card className="bg-white/95 backdrop-blur-xl shadow-2xl border-white/60 border-2 overflow-hidden dark:bg-black/95 dark:border-gray-800">
              <div className="absolute inset-0 bg-gradient-to-br from-[#e8f1ff]/50 via-transparent to-[#e8f1ff]/50 dark:from-[#0B0F14]/30 dark:via-transparent dark:to-[#0B0F14]/30 pointer-events-none"></div>
              <CardHeader className="relative space-y-1 pb-6">
                <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#0d4f9f] to-[#0a3d7c] dark:from-[#4d9cff] dark:to-[#1565C0]">Create Account</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">Sign up to start your shopping journey</CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <form onSubmit={handleSignUp} className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="signup-email" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <User className="w-4 h-4 text-[#1565C0]" />
                      Email
                    </label>
                    <div className="relative group">
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="your@email.com"
                        value={signUpEmail}
                        onChange={(e) => setSignUpEmail(e.target.value)}
                        required
                        className="pl-11 h-12 border-2 border-gray-200 focus:border-[#1565C0] transition-all duration-300 rounded-xl bg-white/80 backdrop-blur-sm dark:border-gray-700 dark:bg-[#09090b]/80 dark:text-gray-100 dark:placeholder:text-gray-500"
                      />
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#1565C0] transition-colors" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="signup-password" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-[#1565C0]" />
                      Password
                    </label>
                    <div className="relative group">
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                        required
                        className="pl-11 h-12 border-2 border-gray-200 focus:border-[#1565C0] transition-all duration-300 rounded-xl bg-white/80 backdrop-blur-sm dark:border-gray-700 dark:bg-[#09090b]/80 dark:text-gray-100 dark:placeholder:text-gray-500"
                      />
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#1565C0] transition-colors" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="signup-confirm-password" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-[#1565C0]" />
                      Confirm Password
                    </label>
                    <div className="relative group">
                      <Input
                        id="signup-confirm-password"
                        type="password"
                        placeholder="••••••••"
                        value={signUpConfirmPassword}
                        onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                        required
                        className="pl-11 h-12 border-2 border-gray-200 focus:border-[#1565C0] transition-all duration-300 rounded-xl bg-white/80 backdrop-blur-sm dark:border-gray-700 dark:bg-[#09090b]/80 dark:text-gray-100 dark:placeholder:text-gray-500"
                      />
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#1565C0] transition-colors" />
                    </div>
                  </div>
                  <Button 
                    type="submit"
                    disabled={isSigningUp}
                    className="w-full bg-[#1565C0] hover:bg-[#0d4f9f] text-white h-12 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
                  >
                    <span className="flex items-center justify-center gap-2">
                      {isSigningUp ? "Creating Account..." : "Create Account"}
                      {!isSigningUp && <ArrowRight className="w-4 h-4" />}
                    </span>
                  </Button>
                  
                  {showWakingMessage && (
                    <div className="text-center text-sm text-[#1565C0] dark:text-[#4d9cff] animate-pulse">
                      Waking server... This takes a moment after inactivity
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="text-center mt-6">
          <Button variant="ghost" onClick={() => navigate("/")}>
            Back to Home
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Auth;
