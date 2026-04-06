import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 relative">
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
      
      {/* Main Content */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Nursing Pharmacology
        </h1>
        <p className="text-xl text-gray-500 mb-8">
          Coming Soon
        </p>
        <Link 
          to="/drugs" 
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
        >
          View Drug Library →
        </Link>
      </div>
    </div>
  );
}
