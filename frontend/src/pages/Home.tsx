import { Link } from "react-router-dom";
import { Pill } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-6">
          <Pill className="w-8 h-8 text-blue-600" />
        </div>
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
