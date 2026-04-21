import { Link } from "react-router-dom";
import { Pill, ArrowRight, BookOpen, Heart, Brain, Stethoscope } from "lucide-react";

const features = [
  {
    icon: BookOpen,
    title: "Drug Cards",
    description: "Access essential drug information including mechanisms of action, side effects, and nursing considerations."
  },
  {
    icon: Heart,
    title: "Basic Quizzes",
    description: "Test your knowledge with multiple choice questions and true/false quizzes."
  },
  {
    icon: Brain,
    title: "Study Guides",
    description: "Learn with printable study guides designed for NCLEX preparation."
  },
  {
    icon: Stethoscope,
    title: "Community Support",
    description: "Connect with other nursing students in our community forums."
  }
];

export default function Tier0() {
  return (
    <div className="min-h-screen pt-24 bg-white flex flex-col relative">
      {/* Logo - Upper Left */}
      <div className="absolute top-4 left-4 z-10">
        <Link to="/">
          <img 
            src="/images/Bio_Logo_white-87f86ab6b807.png" 
            alt="Bio-Sync Academy Logo" 
            className="w-[288px] h-[288px] object-contain"
          />
        </Link>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full mb-4">
              <span className="text-2xl font-bold text-gray-600">T0</span>
              <span className="text-gray-600">Free Tier</span>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to Bio-Sync Academy</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Get started with free access to essential drug cards and basic quizzes. 
              Perfect for trying out the platform before upgrading.
            </p>
          </div>
          
          <div className="bg-white border-2 border-gray-200 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">What's Included</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">📚</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Free Drug Cards</h3>
                <p className="text-gray-600 text-sm">Access to selected essential drug cards</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">✅</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Basic Quizzes</h3>
                <p className="text-gray-600 text-sm">Test your knowledge with practice questions</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">👥</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Community Support</h3>
                <p className="text-gray-600 text-sm">Join our student community forums</p>
              </div>
            </div>
          </div>
          
          <div className="text-center">
            <Link to="/drugs" className="inline-block px-8 py-3 bg-gray-600 text-white rounded-xl font-semibold hover:bg-gray-700 mb-4">
              Start Learning
            </Link>
            <p className="text-gray-600">
              Want more?{" "}
              <Link to="/pricing" className="text-blue-600 hover:underline">View all plans</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
