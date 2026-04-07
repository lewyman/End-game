import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Empty main content area */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Bio-Sync Academy
          </h1>
          <p className="text-xl text-gray-500 mb-8">
            Coming Soon
          </p>
          <Link 
            to="/nursing" 
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            Enter Nursing Section →
          </Link>
        </div>
      </div>
    </div>
  );
}