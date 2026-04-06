import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex flex-col relative">
      {/* Logo - Upper Left (1.5 inches = ~144px) */}
      <div className="absolute top-4 left-4">
        <img 
          src="/images/bio-sync-academy-logo.png" 
          alt="Bio-Sync Academy Logo" 
          className="w-[144px] h-[144px] object-contain"
        />
      </div>
      
      {/* Logo - Upper Right (1.5 inches = ~144px) */}
      <div className="absolute top-4 right-4">
        <img 
          src="/images/bio-sync-academy-logo.png" 
          alt="Bio-Sync Academy Logo" 
          className="w-[144px] h-[144px] object-contain"
        />
      </div>
      
      {/* Empty main content area */}
      <div className="flex-1">
      </div>
    </div>
  );
}
