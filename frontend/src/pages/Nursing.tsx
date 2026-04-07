import { Link } from "react-router-dom";
import { BookOpen, Stethoscope, Heart, Brain, Activity, ArrowRight, Pill } from "lucide-react";

export default function Nursing() {
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
    <div className="min-h-screen bg-white relative">

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white">
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

      {/* Content Sections */}
      <div className="container mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">Learning Paths</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {nursingSections.map((section) => {
            const Icon = section.icon;
            const colorClasses = {
              blue: "bg-blue-50 border-blue-200 hover:border-blue-400",
              red: "bg-red-50 border-red-200 hover:border-red-400",
              green: "bg-green-50 border-green-200 hover:border-green-400",
              pink: "bg-pink-50 border-pink-200 hover:border-pink-400",
              purple: "bg-purple-50 border-purple-200 hover:border-purple-400",
              orange: "bg-orange-50 border-orange-200 hover:border-orange-400",
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
                  <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-full">
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
        <div className="mt-12 bg-gray-50 rounded-2xl p-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
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
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Explore Drug Library
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="w-full md:w-64 h-48 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center">
              <Pill className="w-20 h-20 text-blue-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}