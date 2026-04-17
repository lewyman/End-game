import { Link } from "react-router-dom";
import EducatorChat from "@/components/EducatorChat";
import { useState, useEffect } from "react";

export default function Home() {
  const [userId, setUserId] = useState<string>("guest");
  const [hasMaiaAccess, setHasMaiaAccess] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem("pharma_current_user");
    if (user) {
      try {
        const parsed = JSON.parse(user);
        setUserId(parsed.email || "guest");
        // Check subscription tier for MAIA access
        const tier = parsed.subscription_tier || parsed.tier;
        setHasMaiaAccess(tier === "price_monthly" || tier === "price_yearly");
      } catch {
        setUserId("guest");
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col relative">
      {/* Logo - Upper Left (3 inches = 288px) */}
      <div className="absolute top-4 left-4 z-10">
        <img 
          src="/images/Bio_Logo_white-87f86ab6b807.png" 
          alt="Bio-Sync Academy Logo" 
          className="w-[288px] h-[288px] object-contain"
        />
      </div>
      
      {/* Chat in Center - Only show for paid tiers */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">MAIA</h2>
            <p className="text-gray-600">Your Medical AI Assistant - Ask me anything!</p>
          </div>
          {hasMaiaAccess ? (
            <EducatorChat userId={userId} />
          ) : (
            <div className="bg-gray-100 rounded-lg p-8 text-center">
              <p className="text-gray-600 mb-4">
                MAIA is available with Pro Monthly or Pro Yearly subscription.
              </p>
              <Link to="/pricing" className="text-blue-600 hover:text-blue-800 font-semibold">
                Upgrade to Access MAIA →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
