import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Pill, Eye, EyeOff, ArrowLeft } from "lucide-react";

const USERS_KEY = "pharma_users";
const CURRENT_USER_KEY = "pharma_current_user";
const PASSWORD_RESET_KEY = "password_reset_tokens";
const API_URL = "/api";

interface User {
  email: string;
  tier: "free" | "premium";
  isAdmin?: boolean;
  sessionKey?: string;
}

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    // Check if already logged in
    const currentUser = localStorage.getItem(CURRENT_USER_KEY);
    if (currentUser) {
      navigate("/drugs");
    }
    
    // Check for reset token in URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      setResetToken(token);
      setIsResetPassword(true);
      setIsLogin(false);
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || "Invalid email or password");
        return;
      }
      
      // Store user in localStorage (without password)
      const user: User = {
        email: data.user.email,
        tier: data.user.tier || "free",
        isAdmin: data.user.isAdmin,
        sessionKey: data.user.sessionKey
      };
      
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      setSuccess("Login successful! Redirecting...");
      setTimeout(() => navigate("/drugs"), 1000);
    } catch (err) {
      setError("Login failed. Please try again.");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || "Signup failed. Email may already be registered.");
        return;
      }
      
      // Store user in localStorage (without password)
      const user: User = {
        email: data.user.email,
        tier: data.user.tier || "free",
        isAdmin: data.user.isAdmin
      };
      
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      setSuccess("Account created! Redirecting...");
      setTimeout(() => navigate("/drugs"), 1000);
    } catch (err) {
      setError("Signup failed. Please try again.");
    }
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    const users = getUsers();
    const user = users.find(u => u.email === email);
    
    if (!user) {
      setError("No account found with that email");
      return;
    }
    
    // Generate reset token
    const token = "reset-" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    
    // Store reset token
    const resetTokens = JSON.parse(localStorage.getItem(PASSWORD_RESET_KEY) || "{}");
    resetTokens[token] = { email, expires: Date.now() + 24 * 60 * 60 * 1000 }; // 24 hours
    localStorage.setItem(PASSWORD_RESET_KEY, JSON.stringify(resetTokens));
    
    // Show reset link (in production, this would be sent via email)
    const resetLink = `${window.location.origin}/login?token=${token}`;
    setSuccess(`Password reset link generated! Click here to reset: ${resetLink}`);
  };

  const handleResetPassword = (e: React.FormEvent) => {
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
    
    // Verify token
    const resetTokens = JSON.parse(localStorage.getItem(PASSWORD_RESET_KEY) || "{}");
    const tokenData = resetTokens[resetToken];
    
    if (!tokenData || Date.now() > tokenData.expires) {
      setError("Invalid or expired reset link");
      return;
    }
    
    // Update password
    const users = getUsers();
    const userIndex = users.findIndex(u => u.email === tokenData.email);
    
    if (userIndex === -1) {
      setError("User not found");
      return;
    }
    
    users[userIndex].password = password;
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    
    // Clear reset token
    delete resetTokens[resetToken];
    localStorage.setItem(PASSWORD_RESET_KEY, JSON.stringify(resetTokens));
    
    setSuccess("Password reset successful! Please login with your new password.");
    setIsResetPassword(false);
    setIsLogin(true);
    setEmail(tokenData.email);
    setPassword("");
    setConfirmPassword("");
  };

  if (isResetPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Pill className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
            <p className="text-gray-500 mt-2">Enter your new password</p>
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

          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-black pr-12"
                  required
                  minLength={6}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-black"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              Reset Password
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsResetPassword(false); setIsLogin(true); }}
              className="text-blue-600 hover:underline"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isForgotPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Pill className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Forgot Password</h1>
            <p className="text-gray-500 mt-2">Enter your email to reset your password</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm whitespace-pre-wrap">
              {success}
            </div>
          )}

          <form onSubmit={handleForgotPassword} className="space-y-4">
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

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              Send Reset Link
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsForgotPassword(false); setIsLogin(true); }}
              className="flex items-center justify-center gap-1 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Pill className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isLogin ? "Welcome Back" : "Create Account"}
          </h1>
          <p className="text-gray-500 mt-2">
            {isLogin ? "Login to access your drug cards" : "Sign up for free access to pharmacology content"}
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
            {!isLogin && (
              <p className="text-xs text-gray-500 mt-1">Password must be at least 6 characters</p>
            )}
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
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            {isLogin ? "Login" : "Create Account"}
          </button>
        </form>

        <div className="mt-6 text-center">
          {isLogin ? (
            <>
              <p className="text-gray-600 mb-2">
                Don't have an account?{" "}
                <button
                  onClick={() => {
                    setIsLogin(false);
                    setError("");
                    setSuccess("");
                    setConfirmPassword("");
                  }}
                  className="text-blue-600 hover:underline font-medium"
                >
                  Sign up
                </button>
              </p>
              <button
                onClick={() => { setIsForgotPassword(true); setError(""); setSuccess(""); }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Forgot password?
              </button>
            </>
          ) : (
            <p className="text-gray-600">
              Already have an account?{" "}
              <button
                onClick={() => {
                  setIsLogin(true);
                  setError("");
                  setSuccess("");
                  setConfirmPassword("");
                }}
                className="text-blue-600 hover:underline font-medium"
              >
                Login
              </button>
            </p>
          )}
        </div>

        <div className="mt-6 pt-6 border-t text-center">
          <Link to="/drugs" className="text-gray-500 hover:text-gray-700 text-sm">
            Continue without login (limited access)
          </Link>
        </div>

        <div className="mt-4 bg-blue-50 rounded-lg p-3">
          <p className="text-xs text-blue-800 text-center">
            <strong>Free users:</strong> Access free drugs only<br/>
            <strong>Premium users:</strong> Access all drugs and content
          </p>
        </div>
      </div>
    </div>
  );
}
