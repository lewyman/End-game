import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex flex-col relative">
      {/* Logo - Upper Left (3 inches = 288px) */}
      <div className="absolute top-4 left-4 z-10 bg-white rounded-lg p-2 shadow-sm">
        <img 
          src="/images/bio-sync-academy-logo.png" 
          alt="Bio-Sync Academy Logo" 
          className="w-[288px] h-[288px] object-contain"
        />
      </div>
      
      {/* Empty main content area */}
      <div className="flex-1">
      </div>
    </div>
  );
}
