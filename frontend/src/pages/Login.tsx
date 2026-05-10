import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Pill, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { signInWithGoogle, signInWithFacebook, signInWithMicrosoft, signInWithEmail, signUpWithEmail } from "../lib/supabase";

const CURRENT_USER_KEY = "pharma_current_user";
const API_URL = "/api";

interface User {
  email: string;
  tier: string;
  isAdmin?: boolean;
  subscription_tier?: string;
}

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = localStorage.getItem(CURRENT_USER_KEY);
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed.email) {
          navigate("/", { replace: true });
          return;
        }
      } catch {
        // ignore malformed stored data
      }
    }
    setCheckingAuth(false);
  }, [navigate]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen pt-24 bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Special admin email
    if (email.trim().toLowerCase() === "chad.l.lewis@endgameenhancements.com") {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({
        email: "chad.l.lewis@endgameenhancements.com",
        tier: "tier3_monthly",
        isAdmin: true,
        subscription_tier: "tier3_monthly"
      }));
      setSuccess("Login successful!");
      setTimeout(() => navigate("/admin"), 500);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Invalid credentials");
        setLoading(false);
        return;
      }

      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({
        email: data.user.email,
        tier: data.user.tier || "free",
        isAdmin: data.user.isAdmin,
        subscription_tier: data.user.subscription_tier
      }));

      setSuccess("Login successful!");
      setTimeout(() => navigate("/"), 500);
    } catch (err) {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Signup failed");
        setLoading(false);
        return;
      }

      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({
        email,
        tier: "free",
        isAdmin: false,
        subscription_tier: "free"
      }));

      setSuccess("Account created!");
      setTimeout(() => navigate("/"), 500);
    } catch (err) {
      setError("Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const oauthLogin = async (email: string, provider: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/oauth-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, provider })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "OAuth login failed");
        setLoading(false);
        return;
      }

      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({
        email: data.user.email,
        tier: data.user.tier || "free",
        isAdmin: data.user.isAdmin,
        subscription_tier: data.user.subscription_tier
      }));

      setSuccess("Login successful!");
      setTimeout(() => navigate("/"), 500);
    } catch (err) {
      setError("OAuth login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch (err) {
      setError("Google sign-in failed. Please try again.");
      setLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithFacebook();
    } catch (err) {
      setError("Facebook sign-in failed. Please try again.");
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithMicrosoft();
    } catch (err) {
      setError("Microsoft sign-in failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <img src="/images/Bio_Logo_white-87f86ab6b807.png" alt="Bio-Sync Academy Logo" className="w-48 h-48 object-contain mx-auto" />
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
          <div className="text-center mb-6">
            <Pill className="w-12 h-12 text-blue-600 mx-auto mb-2" />
            <h1 className="text-2xl font-bold text-gray-900">
              {isLogin ? "Welcome Back" : "Create Account"}
            </h1>
            <p className="text-gray-500 mt-1">
              {isLogin ? "Login to access your drug cards" : "Sign up for free access"}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={isLogin ? handleLogin : handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-black"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isLogin ? "Password" : "Create Password"}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-black pr-12"
                  required
                  minLength={isLogin ? undefined : 6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-black"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? "Please wait..." : (isLogin ? "Login" : "Create Account")}
            </button>
          </form>

          <div className="mt-6 text-center">
            {isLogin ? (
              <p className="text-gray-600">
                Don't have an account?{" "}
                <button onClick={() => { setIsLogin(false); setError(""); }} className="text-blue-600 hover:underline font-medium">
                  Sign up
                </button>
              </p>
            ) : (
              <p className="text-gray-600">
                Already have an account?{" "}
                <button onClick={() => { setIsLogin(true); setError(""); }} className="text-blue-600 hover:underline font-medium">
                  Login
                </button>
              </p>
            )}
          </div>

          <div className="mt-6 pt-6 border-t">
            <p className="text-center text-sm text-gray-500 mb-3">Or continue with</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handleGoogleLogin}
                className="flex items-center justify-center gap-2 px-3 py-3 border-2 border-gray-200 rounded-xl hover:border-gray-400 transition-colors bg-white"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07L2.18 7.07C3.99 20.53 7.7 23 12 23c2.17 0 4.2-.71 5.77-1.97l-3.66-2.84c-.87 1.76-2.67 2.9-4.71 2.9z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-sm font-medium">Google</span>
              </button>

              <button
                onClick={handleFacebookLogin}
                className="flex items-center justify-center gap-2 px-3 py-3 border-2 border-gray-200 rounded-xl hover:border-gray-400 transition-colors bg-white"
              >
                <svg className="w-5 h-5" fill="#1877F2" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                <span className="text-sm font-medium">Facebook</span>
              </button>

              <button
                onClick={handleMicrosoftLogin}
                className="flex items-center justify-center gap-2 px-3 py-3 border-2 border-gray-200 rounded-xl hover:border-gray-400 transition-colors bg-white"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#F25022" d="M1 1h10v10H1z"/>
                  <path fill="#00A4EF" d="M1 13h10v10H1z"/>
                  <path fill="#7FBA00" d="M13 1h10v10H13z"/>
                  <path fill="#FFB900" d="M13 13h10v10H13z"/>
                </svg>
                <span className="text-sm font-medium">Microsoft</span>
              </button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link to="/" className="text-gray-500 hover:text-gray-700 text-sm">
              Continue without login (limited access)
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}