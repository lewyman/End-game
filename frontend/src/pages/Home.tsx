import { Link } from "react-router-dom";
import EducatorChat from "@/components/EducatorChat";
import { useState, useEffect } from "react";

export default function Home() {
  const [userId, setUserId] = useState<string>("guest");

  useEffect(() => {
    const user = localStorage.getItem("pharma_current_user");
    if (user) {
      try {
        const parsed = JSON.parse(user);
        setUserId(parsed.email || "guest");
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
          src="/images/bio-sync-academy-logo.png" 
          alt="Bio-Sync Academy Logo" 
          className="w-[288px] h-[288px] object-contain"
        />
      </div>
      
      {/* Chat in Center */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">MAIA</h2>
            <p className="text-gray-600">Your Medical AI Assistant - Ask me anything!</p>
          </div>
          <EducatorChat userId={userId} />
        </div>
      </div>
    </div>
  );
}
