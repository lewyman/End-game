import { Link } from "react-router-dom";
import EducatorChat from "@/components/EducatorChat";
import { useState, useEffect } from "react";

const MASTER_CODE = "MAIA-TEST-2024";

export default function Home() {
  const [userId, setUserId] = useState<string>("guest");
  const [hasMaiaAccess, setHasMaiaAccess] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem("pharma_current_user");
    if (user) {
      try {
        const parsed = JSON.parse(user);
        setUserId(parsed.email || "guest");
        // Check subscription tier for MAIA access
        const tier = parsed.subscription_tier || parsed.tier;
        setHasMaiaAccess(tier === "tier2_monthly" || tier === "tier2_yearly");
      } catch {
        setUserId("guest");
      }
    }
  }, []);

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (codeInput.trim().toUpperCase() === MASTER_CODE) {
      setHasMaiaAccess(true);
      setShowCodeInput(false);
      setCodeError(false);
      // Store the code in localStorage so it persists
      localStorage.setItem("maia_test_code", MASTER_CODE);
    } else {
      setCodeError(true);
    }
  };

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
      {/* NavBar is already showing Bio-Sync Academy branding - no additional logo needed */}
      
      {/* Chat in Center - Only show for paid tiers */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">MAIA</h2>
            <p className="text-gray-600">Your Medical AI Assistant - Ask me anything!</p>
          </div>
          {hasMaiaAccess ? (
            <EducatorChat userId={userId} />
          ) : showCodeInput ? (
            <div className="bg-white rounded-lg p-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Enter Test Code</h3>
              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <input
                  type="text"
                  value={codeInput}
                  onChange={(e) => {
                    setCodeInput(e.target.value);
                    setCodeError(false);
                  }}
                  placeholder="Enter master code..."
                  className="w-full p-3 border border-gray-300 rounded-lg text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                {codeError && (
                  <p className="text-red-600 text-sm">Invalid code. Please try again.</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-white text-white rounded-lg hover:bg-white"
                  >
                    Submit Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCodeInput(false)}
                    className="px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-white"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-lg p-8 text-center">
              <p className="text-gray-600 mb-4">
                MAIA is available with Pro Monthly or Pro Yearly subscription.
              </p>
              <Link to="/pricing" className="block text-blue-600 hover:text-blue-800 font-semibold mb-4">
                Upgrade to Access MAIA →
              </Link>
              <button
                onClick={() => setShowCodeInput(true)}
                className="text-gray-500 hover:text-gray-700 text-sm underline"
              >
                Have a test code?
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
