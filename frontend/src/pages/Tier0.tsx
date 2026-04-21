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
    <div className="min-h-screen pt-24 bg-white">
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

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Pill className="w-10 h-10 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">Free Tier</h1>
          </div>
          <p className="text-xl text-gray-600 mb-8">
            You've accessed the free tier of Bio-Sync Academy. Get started with basic pharmacology content.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              to="/drugs" 
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              View Free Drug Cards
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link 
              to="/pricing" 
              className="px-6 py-3 border-2 border-blue-600 text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-colors"
            >
              Upgrade to Pro
            </Link>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">What's Included in Free Tier</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-blue-400 transition-colors">
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upgrade CTA */}
      <div className="container mx-auto px-4 py-12">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Unlock All Features</h2>
          <p className="text-gray-600 mb-6">
            Get access to all 500+ drug cards, MAIA AI Chat Assistant, interactive quizzes, printable study guides, and more!
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className="bg-white rounded-xl p-4">
              <p className="text-2xl font-bold text-gray-900">$9.99</p>
              <p className="text-gray-500 text-sm">Tier 1/month</p>
            </div>
            <div className="bg-white rounded-xl p-4">
              <p className="text-2xl font-bold text-gray-900">$50</p>
              <p className="text-gray-500 text-sm">Tier 2/month</p>
            </div>
            <Link 
              to="/pricing" 
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              View All Tiers
            </Link>
          </div>
        </div>
      </div>

      {/* Back Links */}
      <div className="container mx-auto px-4 py-8 text-center">
        <Link to="/drugs" className="text-blue-600 hover:text-blue-800 font-medium mr-4">
          ← View Free Drug Cards
        </Link>
        <Link to="/pricing" className="text-blue-600 hover:text-blue-800 font-medium">
          View Pricing →
        </Link>
      </div>
    </div>
  );
}
