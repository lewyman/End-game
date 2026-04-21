import { Link } from "react-router-dom";
import { BookOpen, Stethoscope, Heart, Brain, Activity, ArrowRight, Pill, MessageSquare } from "lucide-react";
import EducatorChat from "@/components/EducatorChat";
import { useState, useEffect } from "react";

export default function Nursing() {
  const [userId, setUserId] = useState<string>("");
  const [tier, setTier] = useState<string>("");
  const [showChat, setShowChat] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
    const user = localStorage.getItem("pharma_current_user");
    if (user) {
      try {
        const parsed = JSON.parse(user);
        setUserId(parsed.email || "");
        setTier(parsed.subscription_tier || parsed.tier || "");
      } catch {
        setUserId("");
      }
    }
  }, []);

  // Gate: Only allow access to logged-in users with a valid tier
  const validTiers = ["tier1_monthly", "tier1_yearly", "tier2_monthly", "tier2_yearly", "tier3_monthly", "tier3_yearly"];
  if (!userId || !tier || !validTiers.includes(tier)) {
    return (
      <div className="min-h-screen pt-24 bg-white flex items-center justify-center">
        <div className="max-w-md w-full p-8 bg-white border-2 border-gray-200 rounded-xl text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔒</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Login Required</h2>
          <p className="text-gray-600 mb-6">
            Please login or subscribe to access the Nursing page and all learning content.
          </p>
          <div className="space-y-3">
            <Link to="/login" className="block w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
              Login
            </Link>
            <Link to="/pricing" className="block w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold">
              View Subscription Plans
            </Link>
            <Link to="/" className="block w-full px-4 py-3 text-gray-500 hover:text-gray-700">
              Go Back Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const nursingSections = [
    {
      title: "Pharmacology",
      description: "Master medication administration, drug classes, and therapeutic monitoring",
      icon: Pill,
      path: "/nursing/pharmacology",
      color: "blue",
      available: true,
    },
    {
      title: "Pathophysiology",
      description: "Understand disease processes and their impact on patient care",
      icon: Activity,
      path: "/nursing/pathophysiology",
      color: "red",
      available: false,
    },
    {
      title: "Clinical Skills",
      description: "Hands-on nursing procedures and patient assessment techniques",
      icon: Stethoscope,
      path: "/nursing/clinical-skills",
      color: "green",
      available: false,
    },
    {
      title: "Patient Care",
      description: "Holistic care planning and patient-centered interventions",
      icon: Heart,
      path: "/nursing/patient-care",
      color: "pink",
      available: false,
    },
    {
      title: "Mental Health",
      description: "Psychiatric nursing and therapeutic communication",
      icon: Brain,
      path: "/nursing/mental-health",
      color: "purple",
      available: false,
    },
    {
      title: "Study Resources",
      description: "Flashcards, practice exams, and NCLEX prep materials",
      icon: BookOpen,
      path: "/nursing/resources",
      color: "orange",
      available: false,
    },
  ];

  return (
    <div className="min-h-screen pt-24 bg-white relative">
      {/* Logo - Upper Left (3 inches = 288px) */}
      <div className="absolute top-4 left-4 z-10">
        <img 
          src="/images/Bio_Logo_white-87f86ab6b807.png" 
          alt="Bio-Sync Academy Logo" 
          className="w-[288px] h-[288px] object-contain"
        />
      </div>
      
      {/* Hero Section */}
      <div className="bg-white">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Nursing Education
            </h1>
            <p className="text-xl text-blue-100 mb-6">
              Comprehensive resources for nursing students and professionals. 
              Master the knowledge and skills needed for exceptional patient care.
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                NCLEX Prep
              </span>
              <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                Drug Guides
              </span>
              <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                Clinical Skills
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Educator Section */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">AI Medical Educator</h2>
            <p className="text-gray-600">Chat with your personal nursing tutor</p>
          </div>
          <button
            onClick={() => setShowChat(!showChat)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-white rounded-lg hover:bg-white transition-colors"
          >
            <MessageSquare className="w-5 h-5" />
            {showChat ? "Hide Chat" : "Open Chat"}
          </button>
        </div>
        
        {showChat && (
          <div className="mb-8">
            <EducatorChat userId={userId} />
          </div>
        )}
      </div>

      {/* Content Sections */}
      <div className="container mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">Learning Paths</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {nursingSections.map((section) => {
            const Icon = section.icon;
            const colorClasses = {
              blue: "bg-white border-blue-200 hover:border-blue-400",
              red: "bg-white border-red-200 hover:border-red-400",
              green: "bg-white border-green-200 hover:border-green-400",
              pink: "bg-white border-pink-200 hover:border-pink-400",
              purple: "bg-white border-purple-200 hover:border-purple-400",
              orange: "bg-white border-orange-200 hover:border-orange-400",
            }[section.color];

            const iconColors = {
              blue: "text-blue-600",
              red: "text-red-600",
              green: "text-green-600",
              pink: "text-pink-600",
              purple: "text-purple-600",
              orange: "text-orange-600",
            }[section.color];

            return section.available ? (
              <Link
                key={section.title}
                to={section.path}
                className={`block p-6 border-2 rounded-xl transition-all ${colorClasses} hover:shadow-lg`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-lg bg-white flex items-center justify-center ${iconColors}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{section.title}</h3>
                <p className="text-gray-600 text-sm">{section.description}</p>
              </Link>
            ) : (
              <div
                key={section.title}
                className={`block p-6 border-2 rounded-xl opacity-60 ${colorClasses}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-lg bg-white flex items-center justify-center ${iconColors}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="px-2 py-1 bg-white text-gray-600 text-xs rounded-full">
                    Coming Soon
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{section.title}</h3>
                <p className="text-gray-600 text-sm">{section.description}</p>
              </div>
            );
          })}
        </div>

        {/* Featured Section */}
        <div className="mt-12 bg-white rounded-2xl p-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1">
              <span className="px-3 py-1 bg-white text-blue-700 rounded-full text-sm font-medium">
                Now Available
              </span>
              <h3 className="text-2xl font-bold text-gray-900 mt-4 mb-3">
                Nursing Pharmacology Drug Library
              </h3>
              <p className="text-gray-600 mb-6">
                Explore our comprehensive collection of drug cards, including mechanisms of action, 
                nursing considerations, adverse effects, and administration guidelines. 
                Perfect for NCLEX preparation and clinical rotations.
              </p>
              <Link
                to="/nursing/pharmacology"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-white rounded-lg font-medium hover:bg-white transition-colors"
              >
                Explore Drug Library
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="w-full md:w-64 h-48 bg-white">
              <Pill className="w-20 h-20 text-blue-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// trigger redeploy
