import { Link } from "react-router-dom";
import { ArrowLeft, Pill, Clock } from "lucide-react";

export default function Interactions() {
  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
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
        
        <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="w-10 h-10 text-purple-600" />
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Coming Soon</h1>
        <p className="text-gray-600 mb-8">
          Drug interaction checker and contraindication database are being built. 
          You'll be able to check medication interactions and nursing considerations.
        </p>
        
        <Link 
          to="/drugs" 
          className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors"
        >
          <Pill className="w-5 h-5" />
          Explore Drug Cards
        </Link>
      </div>
    </div>
  );
}
