import { Link } from "react-router-dom";
import EducatorChat from "@/components/EducatorChat";
import { useState, useEffect } from "react";
import { GraduationCap, Crown } from "lucide-react";

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
        setHasMaiaAccess(tier === "tier2_monthly" || tier === "tier2_yearly" || tier === "price_monthly" || tier === "price_yearly");
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
    <div className="min-h-screen pt-24 bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col relative">
      {/* Logo - Upper Left */}
      <div className="absolute top-4 left-4 z-10">
        <Link to="/">
          <img 
            src="/images/Bio_Logo_white-87f86ab6b807.png" 
            alt="Bio-Sync Academy Logo" 
            className="w-[288px] h-[288px] object-contain"
          />
        </Link>
      </div>
      
      {/* Main Content - Tier Selection */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to Bio-Sync Academy</h1>
            <p className="text-xl text-gray-600">Choose your learning path</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Free */}
            <div className="bg-white border-2 border-gray-200 rounded-xl p-6 text-center hover:border-blue-400 transition-colors">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <GraduationCap className="w-6 h-6 text-gray-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Free</h3>
              <p className="text-2xl font-bold text-gray-900 mb-2">$0</p>
              <p className="text-gray-600 text-sm mb-4">Free Forever</p>
              <Link to="/tier0" className="inline-block px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                Get Started
              </Link>
            </div>
            
            {/* Pro Monthly */}
            <div className="bg-white border-2 border-blue-500 rounded-xl p-6 text-center ring-2 ring-blue-200 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                Most Popular
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">P</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Pro Monthly</h3>
              <p className="text-2xl font-bold text-gray-900 mb-2">$4.99<span className="text-sm font-normal">/mo</span></p>
              <p className="text-gray-600 text-sm mb-4">Full access for serious nursing students</p>
              <Link to="/pricing" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Subscribe
              </Link>
            </div>
            
            {/* Pro Yearly */}
            <div className="bg-white border-2 border-gray-200 rounded-xl p-6 text-center hover:border-blue-400 transition-colors relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                Best Value
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Crown className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Pro Yearly</h3>
              <p className="text-2xl font-bold text-gray-900 mb-2">$29.99<span className="text-sm font-normal">/yr</span></p>
              <p className="text-gray-600 text-sm mb-4">Save 50% vs monthly</p>
              <Link to="/pricing" className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                Subscribe
              </Link>
            </div>
          </div>
          
          <div className="text-center mt-8">
            <p className="text-gray-600">
              Already have an account?{" "}
              <Link to="/login" className="text-blue-600 hover:underline">Login here</Link>
            </p>
          </div>
        </div>
      </div>

      {/* MAIA Chat Section */}
      <div className="container mx-auto max-w-4xl px-8 pb-12">
        <div className="bg-slate-50 rounded-2xl p-6 border border-gray-200">
          {!hasMaiaAccess && !showCodeInput ? (
            <div className="text-center py-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Meet MAIA</h2>
              <p className="text-gray-600 mb-6">Your AI Medical Tutor — Enter the access code or subscribe to chat with MAIA</p>
              <button
                onClick={() => setShowCodeInput(true)}
                className="px-8 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
              >
                Access MAIA
              </button>
            </div>
          ) : !hasMaiaAccess && showCodeInput ? (
            <div className="max-w-md mx-auto py-4">
              <h3 className="text-xl font-bold text-gray-900 text-center mb-4">Enter Access Code</h3>
              <form onSubmit={handleCodeSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={codeInput}
                  onChange={(e) => { setCodeInput(e.target.value); setCodeError(false); }}
                  placeholder="XXXX-XXXX-XXXX"
                  className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700"
                >
                  Enter
                </button>
              </form>
              {codeError && <p className="text-red-500 text-center mt-3">Invalid code. Try again.</p>}
              <button onClick={() => setShowCodeInput(false)} className="mt-4 text-gray-500 hover:text-gray-700 text-sm mx-auto block">
                ← Back
              </button>
            </div>
          ) : (
            <EducatorChat userId={userId} />
          )}
        </div>
      </div>
    </div>
  );
}
