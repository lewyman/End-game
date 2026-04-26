import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Check } from "lucide-react";

const MASTER_CODE = "admin logon";

export default function AdminLogin() {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().toLowerCase() === MASTER_CODE.toLowerCase()) {
      // Set admin session
      localStorage.setItem("pharma_current_user", JSON.stringify({
        email: "admin@biosync.academy",
        tier: "tier3_monthly",
        isAdmin: true,
        subscription_tier: "tier3_monthly"
      }));
      navigate("/admin");
      // Set master admin session so Admin page doesn't ask for API key
      localStorage.setItem("pharma_master_admin", "true");
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen pt-24 bg-white flex items-center justify-center">
      <div className="max-w-md w-full p-8 bg-white border-2 border-yellow-400 rounded-xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-yellow-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Access</h1>
          <p className="text-gray-500 mt-2">Enter the master code to access admin features</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
            Invalid master code. Please try again.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError(false);
              }}
              placeholder="Enter master code..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-yellow-400 focus:outline-none text-black text-center text-lg"
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-yellow-500 text-white rounded-xl font-semibold hover:bg-yellow-600 transition-colors"
          >
            Access Admin
          </button>
        </form>

        <div className="mt-6 text-center">
          <a href="/" className="text-gray-500 hover:text-gray-700 text-sm">
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
