import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex flex-col relative">
      {/* Logo - Upper Left (2.5 inches = 240px) */}
      <div className="absolute top-4 left-4">
        <img 
          src="/images/bio-sync-academy-logo.png" 
          alt="Bio-Sync Academy Logo" 
          className="w-[240px] h-[240px] object-contain"
        />
      </div>
      
      {/* Logo - Upper Right (2.5 inches = 240px) */}
      <div className="absolute top-4 right-4">
        <img 
          src="/images/bio-sync-academy-logo.png" 
          alt="Bio-Sync Academy Logo" 
          className="w-[240px] h-[240px] object-contain"
        />
      </div>
      
      {/* Empty main content area */}
      <div className="flex-1">
      </div>
    </div>
  );
}
