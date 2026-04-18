import { Link } from "react-router-dom";
import { ArrowLeft, Download, Clock } from "lucide-react";

export default function Downloads() {
  return (
    <div className="min-h-screen pt-24 bg-white py-16 px-4">
      {/* Logo - Upper Left (3 inches = 288px) */}
      <div className="absolute top-4 left-4 z-10">
        <img 
          src="/images/Bio_Logo_white-87f86ab6b807.png" 
          alt="Bio-Sync Academy Logo" 
          className="w-[288px] h-[288px] object-contain"
        />
      </div>

      <div className="max-w-2xl mx-auto text-center">
        <Link to="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
        
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="w-10 h-10 text-blue-600" />
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Coming Soon</h1>
        <p className="text-gray-600 mb-8">
          Downloadable study guides, cheat sheets, and printable drug cards are in development. 
          Check back soon!
        </p>
        
        <Link 
          to="/drugs" 
          className="inline-flex items-center gap-2 px-6 py-3 bg-white text-white rounded-xl font-semibold hover:bg-white transition-colors"
        >
          <Download className="w-5 h-5" />
          Explore Drug Cards
        </Link>
      </div>
    </div>
  );
}
