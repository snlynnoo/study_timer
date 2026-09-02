import React, { useState } from "react";
import { Timer as TimerIcon, LogIn, UserPlus, Mail, Lock, User, AlertCircle, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "../lib/supabase";

interface AuthViewProps {
  onSuccess?: () => void;
}

export default function AuthView({ onSuccess }: AuthViewProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);

    try {
      const isInIframe = window.self !== window.top;
      const redirectTo = window.location.origin;

      if (isInIframe) {
        // In iframe environment: request OAuth URL and open in dedicated popup window
        const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
            skipBrowserRedirect: true,
            queryParams: {
              access_type: "offline",
              prompt: "consent",
            },
          },
        });

        if (oauthError) throw oauthError;

        if (data?.url) {
          const width = 500;
          const height = 620;
          const left = window.screenX + (window.outerWidth - width) / 2;
          const top = window.screenY + (window.outerHeight - height) / 2;
          const popup = window.open(
            data.url,
            "supabase_google_login",
            `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
          );

          if (!popup || popup.closed || typeof popup.closed === "undefined") {
            // Popup blocked by browser: fallback to redirect
            window.location.href = data.url;
            return;
          }

          // Listen for cross-window message & poll for session completion
          const checkInterval = setInterval(async () => {
            try {
              const { data: sessionData } = await supabase.auth.getSession();
              if (sessionData?.session?.user) {
                clearInterval(checkInterval);
                if (!popup.closed) {
                  try {
                    popup.close();
                  } catch {
                    // ignore
                  }
                }
                setIsGoogleLoading(false);
                onSuccess?.();
              } else if (popup.closed) {
                clearInterval(checkInterval);
                setIsGoogleLoading(false);
              }
            } catch {
              // ignore polling error
            }
          }, 800);

          const messageListener = async (event: MessageEvent) => {
            if (event.data?.type === "SUPABASE_AUTH_SESSION" && event.data?.session?.access_token) {
              clearInterval(checkInterval);
              window.removeEventListener("message", messageListener);
              if (!popup.closed) {
                try {
                  popup.close();
                } catch {
                  // ignore
                }
              }
              try {
                const { data: authData } = await supabase.auth.setSession({
                  access_token: event.data.session.access_token,
                  refresh_token: event.data.session.refresh_token,
                });
                if (authData.session?.user) {
                  setIsGoogleLoading(false);
                  onSuccess?.();
                }
              } catch (e) {
                console.error("Error setting session:", e);
                setIsGoogleLoading(false);
              }
            }
          };

          window.addEventListener("message", messageListener);
        }
      } else {
        // Direct top-level window redirect
        const { error: oauthError } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
            queryParams: {
              access_type: "offline",
              prompt: "consent",
            },
          },
        });

        if (oauthError) throw oauthError;
      }
    } catch (err: any) {
      console.error("Google sign in error:", err);
      setError(err.message || "Failed to initiate Google sign in.");
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (isSignUp && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              name: displayName.trim() || email.trim().split("@")[0],
            },
          },
        });

        if (signUpError) throw signUpError;

        if (data.session) {
          onSuccess?.();
        } else {
          setSuccessMessage("Account created successfully! You can now sign in.");
          setIsSignUp(false);
          setPassword("");
          setConfirmPassword("");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) throw signInError;
        onSuccess?.();
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(err.message || "An authentication error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-500 via-rose-600 to-indigo-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 sm:p-10 rounded-3xl shadow-2xl max-w-md w-full"
      >
        <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
          <TimerIcon className="w-8 h-8" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-1">
          Study Timer by Sai
        </h1>
        <p className="text-gray-500 text-sm text-center mb-6">
          {isSignUp
            ? "Create an account or continue with Google"
            : "Sign in to access your sessions and settings"}
        </p>

        {/* Google Sign In Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading || isLoading}
          className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-2xl font-bold text-sm shadow-sm transition-all active:scale-98 disabled:opacity-60 mb-6"
        >
          {isGoogleLoading ? (
            <div className="w-5 h-5 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin" />
          ) : (
            <GoogleIcon className="w-5 h-5 shrink-0" />
          )}
          <span>Continue with Google</span>
        </button>

        {/* Divider */}
        <div className="relative flex items-center justify-center mb-6">
          <div className="border-t border-gray-200 w-full" />
          <span className="bg-white px-3 text-xs font-bold uppercase tracking-wider text-gray-400 absolute">
            Or with email
          </span>
        </div>

        {/* Tab switch */}
        <div className="flex bg-gray-100 p-1 rounded-2xl mb-6">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false);
              setError(null);
              setSuccessMessage(null);
            }}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              !isSignUp
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true);
              setError(null);
              setSuccessMessage(null);
            }}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              isSignUp
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Create Account
          </button>
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl flex items-center gap-2 text-xs font-medium"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {successMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-2 text-xs font-medium"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                Your Name
              </label>
              <div className="relative">
                <User className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="e.g. Sai"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all text-sm font-medium"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all text-sm font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all text-sm font-medium"
              />
            </div>
          </div>

          {isSignUp && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all text-sm font-medium"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || isGoogleLoading}
            className="w-full mt-2 flex items-center justify-center gap-2 bg-gray-900 text-white py-3.5 rounded-2xl font-bold hover:bg-gray-800 active:scale-98 transition-all shadow-lg disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : isSignUp ? (
              <>
                <UserPlus className="w-5 h-5" />
                <span>Create Account</span>
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-gray-400 text-xs font-medium tracking-wide">
            Made with <span className="text-rose-500 animate-pulse">♥️</span> by{" "}
            <span className="text-gray-900 font-bold">Sai</span>, Enjoy!
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}
