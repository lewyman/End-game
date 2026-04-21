import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Pill, Eye, EyeOff, ArrowLeft } from "lucide-react";

const USERS_KEY = "pharma_users";
const CURRENT_USER_KEY = "pharma_current_user";
const PASSWORD_RESET_KEY = "password_reset_tokens";
const API_URL = "/api";

const MASTER_CODE = "admin logon";

interface User {
  email: string;
  tier: "free" | "premium";
  isAdmin?: boolean;
  sessionKey?: string;
}

export default function Login({ isAdminMaster = false }: { isAdminMaster?: boolean }) {
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

  const handleOAuthLogin = async (provider: string) => {
    // For demo: simulate OAuth login by creating/finding user by email
    const demoEmails: Record<string, string> = {
      google: 'user@gmail.com',
      facebook: 'user@facebook.com',
      microsoft: 'user@microsoft.com'
    };
    
    const email = prompt(`Enter your ${provider} email to simulate OAuth login:`);
    if (!email) return;
    
    setError("");
    
    try {
      // Simulate OAuth: check if user exists or create new one
      const response = await fetch(`${API_URL}/oauth-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, provider })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || "OAuth login failed");
        return;
      }
      
      // Store user in localStorage
      const user: User = {
        email: data.user.email,
        tier: data.user.tier || "free",
        isAdmin: data.user.isAdmin
      };
      
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      setSuccess("Login successful! Redirecting...");
      setTimeout(() => navigate("/drugs"), 1000);
    } catch (err) {
      setError("OAuth login failed. Please try again.");
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
      <div className="min-h-screen bg-white">
      {/* Logo - Upper Left (3 inches = 288px) */}
      <div className="absolute top-4 left-4 z-10">
        <img 
          src="/images/Bio_Logo_white-87f86ab6b807.png" 
          alt="Bio-Sync Academy Logo" 
          className="w-[288px] h-[288px] object-contain"
        />
      </div>

        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
              <Pill className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
            <p className="text-gray-500 mt-2">Enter your new password</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-white border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-white border border-green-200 rounded-lg text-green-700 text-sm">
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
              className="w-full py-3 bg-white text-white rounded-xl font-semibold hover:bg-white transition-colors"
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
      <div className="min-h-screen bg-white">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
              <Pill className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Forgot Password</h1>
            <p className="text-gray-500 mt-2">Enter your email to reset your password</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-white border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-white border border-green-200 rounded-lg text-green-700 text-sm whitespace-pre-wrap">
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
              className="w-full py-3 bg-white text-white rounded-xl font-semibold hover:bg-white transition-colors"
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
    <div className="min-h-screen bg-white">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
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
          <div className="mb-4 p-3 bg-white border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-white border border-green-200 rounded-lg text-green-700 text-sm">
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
            className="w-full py-3 bg-white text-white rounded-xl font-semibold hover:bg-white transition-colors"
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

        {/* OAuth Login Section */}
        <div className="mt-6 pt-6 border-t">
          <p className="text-gray-500 text-sm text-center mb-4">Or continue with</p>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => handleOAuthLogin("google")}
              className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-200 rounded-xl hover:border-gray-400 transition-colors bg-white"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18c-1.49 2.96-1.49 6.54 0 9.54l3.66-2.52z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="text-sm font-medium text-gray-700">Google</span>
            </button>
            
            <button
              onClick={() => handleOAuthLogin("facebook")}
              className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-200 rounded-xl hover:border-gray-400 transition-colors bg-white"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.166h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span className="text-sm font-medium text-gray-700">Facebook</span>
            </button>
            
            <button
              onClick={() => handleOAuthLogin("microsoft")}
              className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-200 rounded-xl hover:border-gray-400 transition-colors bg-white"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#f25022" d="M1 1h10v10H1z"/>
                <path fill="#00a4ef" d="M1 13h10v10H1z"/>
                <path fill="#7fba00" d="M13 1h10v10H13z"/>
                <path fill="#ffb900" d="M13 13h10v10H13z"/>
              </svg>
              <span className="text-sm font-medium text-gray-700">Microsoft</span>
            </button>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t text-center">
          <Link to="/drugs" className="text-gray-500 hover:text-gray-700 text-sm">
            Continue without login (limited access)
          </Link>
        </div>

        <div className="mt-4 bg-white rounded-lg p-3">
          <p className="text-xs text-blue-800 text-center">
            <strong>Free users:</strong> Access free drugs only<br/>
            <strong>Premium users:</strong> Access all drugs and content
          </p>
        </div>
      </div>
    </div>
  );
}
