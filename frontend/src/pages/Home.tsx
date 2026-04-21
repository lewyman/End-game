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
    <div className="min-h-screen pt-24 bg-white flex flex-col relative">
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
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Tier 0 */}
            <div className="bg-white border-2 border-gray-200 rounded-xl p-6 text-center hover:border-blue-400 transition-colors">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-gray-600">T0</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Tier 0</h3>
              <p className="text-2xl font-bold text-gray-900 mb-2">$0</p>
              <p className="text-gray-600 text-sm mb-4">Free Forever</p>
              <Link to="/tier0" className="inline-block px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                Get Started
              </Link>
            </div>
            
            {/* Tier 1 */}
            <div className="bg-white border-2 border-gray-200 rounded-xl p-6 text-center hover:border-blue-400 transition-colors">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">T1</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Tier 1</h3>
              <p className="text-2xl font-bold text-gray-900 mb-2">$9.99<span className="text-sm font-normal">/mo</span></p>
              <p className="text-gray-600 text-sm mb-4">or $100/year</p>
              <Link to="/pricing" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Subscribe
              </Link>
            </div>
            
            {/* Tier 2 */}
            <div className="bg-white border-2 border-blue-500 rounded-xl p-6 text-center ring-2 ring-blue-200">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                Popular
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">T2</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Tier 2</h3>
              <p className="text-2xl font-bold text-gray-900 mb-2">$50<span className="text-sm font-normal">/mo</span></p>
              <p className="text-gray-600 text-sm mb-4">or $550/year</p>
              <Link to="/pricing" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Subscribe
              </Link>
            </div>
            
            {/* Tier 3 */}
            <div className="bg-white border-2 border-gray-200 rounded-xl p-6 text-center hover:border-blue-400 transition-colors">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-yellow-600">T3</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Tier 3</h3>
              <p className="text-2xl font-bold text-gray-900 mb-2">$200<span className="text-sm font-normal">/mo</span></p>
              <p className="text-gray-600 text-sm mb-4">+ 2hr Tutoring</p>
              <Link to="/pricing" className="inline-block px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700">
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
    </div>
  );
}
