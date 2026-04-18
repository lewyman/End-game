import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Pill, ArrowLeft, Heart, Loader2, Crown, Search, CheckCircle, LayoutGrid, List, ChevronDown, ChevronRight } from "lucide-react";

const API_URL = "/api";

interface Drug {
  slug: string;
  name: string;
  class: string;
  description: string;
  image: string;
  tier: "free" | "premium";
}

export default function Drugs() {
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [filteredDrugs, setFilteredDrugs] = useState<Drug[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "accordion">("grid");
  const [expandedClasses, setExpandedClasses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [userTier, setUserTier] = useState<"free" | "premium">("free");
  const [completedDrugs, setCompletedDrugs] = useState<string[]>([]);

  useEffect(() => {
    const currentUser = localStorage.getItem("pharma_current_user");
    if (currentUser) {
      const user = JSON.parse(currentUser);
      setUserTier(user.tier || "free");
    }
    
    const saved = localStorage.getItem("completed_drugs");
    if (saved) {
      setCompletedDrugs(JSON.parse(saved));
    }

    fetch(`${API_URL}/drugs`)
      .then(res => res.json())
      .then(data => {
        setDrugs(data.drugs || []);
        setFilteredDrugs(data.drugs || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load drugs:", err);
        setLoading(false);
      });
  }, []);

  // Filter drugs based on search
  useEffect(() => {
    let filtered = drugs;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(drug => 
        drug.name.toLowerCase().includes(query) ||
        drug.class.toLowerCase().includes(query) ||
        drug.description.toLowerCase().includes(query)
      );
    }
    
    setFilteredDrugs(filtered);
  }, [searchQuery, drugs]);

  // Extract unique drug classes
  const drugClasses = Array.from(new Set(drugs.map(d => d.class))).sort();

  // Group drugs by class for accordion view
  const drugsByClass = drugClasses.reduce((acc, cls) => {
    acc[cls] = filteredDrugs.filter(d => d.class === cls);
    return acc;
  }, {} as Record<string, Drug[]>);

  const canAccess = (drug: Drug) => {
    return drug.tier === "free" || userTier === "premium";
  };

  const isCompleted = (slug: string) => {
    return completedDrugs.includes(slug);
  };

  const toggleClass = (cls: string) => {
    if (expandedClasses.includes(cls)) {
      setExpandedClasses(expandedClasses.filter(c => c !== cls));
    } else {
      setExpandedClasses([...expandedClasses, cls]);
    }
  };

  const expandAll = () => {
    setExpandedClasses(drugClasses);
  };

  const collapseAll = () => {
    setExpandedClasses([]);
  };

  const completionRate = drugs.length > 0 
    ? Math.round((completedDrugs.length / drugs.length) * 100) 
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white relative">
      {/* Logo - Upper Left (3 inches = 288px) */}
      <div className="absolute top-4 left-4 z-10">
        <img 
          src="/images/Bio_Logo_white-87f86ab6b807.png" 
          alt="Bio-Sync Academy Logo" 
          className="w-[288px] h-[288px] object-contain"
        />
      </div>

      {/* Logo */}
      <div className="absolute top-4 left-4 z-10">
        <img src="/images/bio-sync-academy-logo.png" alt="Bio-Sync Academy Logo" className="w-[288px] h-[288px] object-contain" />
      </div>
      {/* Header */}
      <header className="border-b px-4 py-4">
        <div className="container mx-auto flex items-center gap-2">
          <Pill className="w-5 h-5 text-blue-600" />
          <span className="font-bold text-lg">Pharmacology</span>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-8">
        <Link to="/nursing" className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Nursing
        </Link>
        
        {/* Progress, Search, and View Toggle */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Drug Library</h1>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              Progress: <span className="font-semibold text-blue-600">{completedDrugs.length}/{drugs.length}</span> 
              <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                {completionRate}%
              </span>
            </div>
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === "grid"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                Grid
              </button>
              <button
                onClick={() => setViewMode("accordion")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === "accordion"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                <List className="w-4 h-4" />
                By Class
              </button>
            </div>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search drugs by name, class, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-black"
          />
        </div>

        {/* Accordion View Controls */}
        {viewMode === "accordion" && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={expandAll}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Expand All
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={collapseAll}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Collapse All
            </button>
          </div>
        )}
        
        {/* GRID VIEW */}
        {viewMode === "grid" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDrugs.map((drug) => {
              const accessible = canAccess(drug);
              const completed = isCompleted(drug.slug);
              
              return (
                <div
                  key={drug.slug}
                  className={`block p-6 border-2 rounded-xl transition-all bg-white ${
                    accessible 
                      ? "hover:border-blue-500 hover:shadow-lg" 
                      : "opacity-75 border-gray-200"
                  } ${completed ? "border-green-200 bg-green-50/30" : ""}`}
                >
                  <Link
                    to={accessible ? `/drugs/${drug.slug}` : "#"}
                    className="block"
                    onClick={(e) => !accessible && e.preventDefault()}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${completed ? "bg-green-100" : "bg-blue-100"}`}>
                          {completed ? (
                            <CheckCircle className="w-6 h-6 text-green-600" />
                          ) : drug.image ? (
                            <img 
                              src={drug.image} 
                              alt="" 
                              loading="lazy"
                              className="w-10 h-10 object-contain"
                            />
                          ) : (
                            <Heart className="w-6 h-6 text-red-500" />
                          )}
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-gray-900">{drug.name}</h2>
                          <p className="text-sm text-blue-600 font-medium">{drug.class}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {drug.tier === "premium" && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded flex items-center gap-1">
                            <Crown className="w-3 h-3" />
                            PREMIUM
                          </span>
                        )}
                        {completed && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                            ✓ Completed
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">{drug.description}</p>
                  </Link>
                  
                  {!accessible && (
                    <Link
                      to="/pricing"
                      className="mt-4 block w-full py-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white text-center rounded-lg font-semibold hover:from-yellow-500 hover:to-yellow-600 transition-all shadow-sm"
                    >
                      🔓 Unlock Premium
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ACCORDION VIEW */}
        {viewMode === "accordion" && (
          <div className="space-y-3">
            {drugClasses.map((cls) => {
              const classDrugs = drugsByClass[cls] || [];
              const isExpanded = expandedClasses.includes(cls);
              const visibleDrugs = classDrugs;
              
              if (visibleDrugs.length === 0) return null;
              
              return (
                <div key={cls} className="border-2 border-gray-200 rounded-xl overflow-hidden">
                  {/* Class Header */}
                  <button
                    onClick={() => toggleClass(cls)}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      )}
                      <h3 className="text-lg font-semibold text-gray-900">{cls}</h3>
                      <span className="text-sm text-gray-500">
                        ({visibleDrugs.length} drug{visibleDrugs.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {visibleDrugs.filter(d => isCompleted(d.slug)).length} completed
                    </div>
                  </button>
                  
                  {/* Drugs in this class */}
                  {isExpanded && (
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 bg-white">
                      {visibleDrugs.map((drug) => {
                        const accessible = canAccess(drug);
                        const completed = isCompleted(drug.slug);
                        
                        return (
                          <div
                            key={drug.slug}
                            className={`block p-4 border rounded-lg transition-all bg-white ${
                              accessible 
                                ? "hover:border-blue-400 hover:shadow" 
                                : "opacity-60"
                            } ${completed ? "border-green-200 bg-green-50/30" : "border-gray-200"}`}
                          >
                            <Link
                              to={accessible ? `/drugs/${drug.slug}` : "#"}
                              className="block"
                              onClick={(e) => !accessible && e.preventDefault()}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${completed ? "bg-green-100" : "bg-blue-100"}`}>
                                    {completed ? (
                                      <CheckCircle className="w-5 h-5 text-green-600" />
                                    ) : drug.image ? (
                                      <img 
                                        src={drug.image} 
                                        alt="" 
                                        loading="lazy"
                                        className="w-8 h-8 object-contain"
                                      />
                                    ) : (
                                      <Heart className="w-5 h-5 text-red-500" />
                                    )}
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-gray-900">{drug.name}</h4>
                                    <p className="text-xs text-gray-500">{drug.description.slice(0, 60)}...</p>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  {drug.tier === "premium" && (
                                    <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">
                                      <Crown className="w-3 h-3 inline" />
                                    </span>
                                  )}
                                  {completed && (
                                    <span className="text-green-600 text-xs">✓</span>
                                  )}
                                </div>
                              </div>
                            </Link>
                            
                            {!accessible && (
                              <Link
                                to="/pricing"
                                className="mt-2 block w-full py-1.5 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white text-center rounded text-sm font-semibold hover:from-yellow-500 hover:to-yellow-600 transition-all"
                              >
                                🔓 Unlock
                              </Link>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {filteredDrugs.length === 0 && searchQuery && (
          <div className="text-center py-16">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No drugs match "{searchQuery}"</p>
            <button 
              onClick={() => setSearchQuery("")}
              className="mt-2 text-blue-600 hover:underline"
            >
              Clear search
            </button>
          </div>
        )}

        {drugs.length === 0 && (
          <div className="text-center py-16">
            <Pill className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No drugs available yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
