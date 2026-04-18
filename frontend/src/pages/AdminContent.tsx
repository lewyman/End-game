import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Save, Trash2, Edit2, X, Check, Database, Pill, ArrowRight, Users, Star, ChevronLeft, ChevronRight, Activity, AlertCircle, Eye, Heart, Upload, Loader2 } from "lucide-react";

const API_URL = "/api";

interface ContentRow {
  id?: number;
  type: "content" | "mc" | "sata";
  title: string;
  content: string;
  keyPoints: string;
  question: string;
  options: string;
  correct: string;
  explanation: string;
  rationale: string;
  image: string;
}

interface Drug {
  slug: string;
  name: string;
  class: string;
  description: string;
  image: string;
  tier: "free" | "premium";
  blocks?: ContentRow[];
  block_count?: number;
}

interface User {
  id: number;
  email: string;
  tier: "free" | "premium";
  is_admin: number;
  joined_at: string;
}

export default function AdminContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [view, setView] = useState<"drugs" | "users" | "tiers">("drugs");
  const [tierFilter, setTierFilter] = useState<"all" | "free" | "premium">("all");
  const [sessionKey, setSessionKey] = useState<string>("");
  
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedDrug, setSelectedDrug] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [blocks, setBlocks] = useState<ContentRow[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDrug, setNewDrug] = useState({ name: "", slug: "", class: "", description: "" });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getAuthHeaders = () => {
    const currentUser = localStorage.getItem("pharma_current_user");
    const userEmail = currentUser ? JSON.parse(currentUser).email : "";
    return {
      "Content-Type": "application/json",
      "X-Session-Key": sessionKey,
      "X-User-Email": userEmail
    };
  };

  useEffect(() => {
    // Check if current user is admin and auto-login
    const currentUser = localStorage.getItem("pharma_current_user");
    if (currentUser) {
      try {
        const user = JSON.parse(currentUser);
        if (user.isAdmin) {
          // Generate session key for admin
          const newKey = "admin-" + Math.random().toString(36).substring(2);
          localStorage.setItem("pharma_admin_key", newKey);
          setSessionKey(newKey);
          setIsAuthenticated(true);
          return;
        }
      } catch (e) {}
    }
    // Fall back to stored admin key
    const storedKey = localStorage.getItem("pharma_admin_key");
    if (storedKey) {
      setSessionKey(storedKey);
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && sessionKey) {
      loadDrugs();
      loadUsers();
    }
  }, [isAuthenticated, sessionKey]);

  const loadDrugs = async () => {
    try {
      const headers = getAuthHeaders();
      console.log('Loading drugs with headers:', headers);
      const res = await fetch(`${API_URL}/admin/drugs`, {
        headers
      });
      console.log('Response status:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('Drugs loaded:', data);
        setDrugs(data.drugs || []);
      } else {
        const error = await res.text();
        console.error('Failed to load drugs:', error);
      }
    } catch (err) {
      console.error("Failed to load drugs", err);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/users`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error("Failed to load users");
    }
  };

  useEffect(() => {
    if (selectedDrug) {
      loadDrugBlocks(selectedDrug);
    }
  }, [selectedDrug]);

  const loadDrugBlocks = async (slug: string) => {
    try {
      const res = await fetch(`${API_URL}/admin/drugs/${slug}/blocks`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.blocks || []).map((b: any, idx: number) => ({
          id: idx + 1,
          type: b.type,
          title: b.title,
          content: b.content || "",
          keyPoints: b.key_points || "",
          question: b.question || "",
          options: b.options || "",
          correct: b.correct || "",
          explanation: b.explanation || "",
          rationale: b.rationale || "",
          image: b.image || ""
        }));
        setBlocks(mapped);
        setPreviewIndex(0);
      }
    } catch (err) {
      console.error("Failed to load blocks");
    }
  };

  const handleLogin = () => {
    if (passwordInput === "nurse2024") {
      setIsAuthenticated(true);
      setLoginError(false);
      // Generate a temporary local key for this session
      const localKey = "admin-" + Date.now();
      localStorage.setItem("pharma_admin_session", "true");
      setSessionKey(localKey);
    } else {
      setLoginError(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("pharma_admin_key");
    localStorage.removeItem("pharma_admin_session");
    setIsAuthenticated(false);
    setSessionKey("");
    setSelectedDrug(null);
  };

  const handleCreateDrug = async () => {
    if (!newDrug.slug || !newDrug.name) return;
    const slug = newDrug.slug.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    
    try {
      const res = await fetch(`${API_URL}/admin/drugs`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          slug,
          name: newDrug.name,
          class: newDrug.class || "Unclassified",
          description: newDrug.description || "",
          image: `/images/${slug}.png`,
          tier: "free"
        })
      });
      
      if (res.ok) {
        setShowCreateModal(false);
        setNewDrug({ name: "", slug: "", class: "", description: "" });
        loadDrugs();
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      alert("Failed to create drug");
    }
  };

  const handleSaveAll = async () => {
    if (!selectedDrug) return;
    
    try {
      const res = await fetch(`${API_URL}/admin/drugs/${selectedDrug}/blocks`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ blocks })
      });
      
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      alert("Failed to save");
    }
  };

  const handleDeleteDrug = async (slug: string) => {
    if (!confirm(`Delete ${slug}?`)) return;
    
    try {
      const res = await fetch(`${API_URL}/admin/drugs/${slug}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      
      if (res.ok) {
        loadDrugs();
        if (selectedDrug === slug) setSelectedDrug(null);
      }
    } catch (err) {
      alert("Failed to delete");
    }
  };


  const handleThumbnailUpload = async (slug: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("slug", slug);

    try {
      const headers = getAuthHeaders();
      delete (headers as any)["Content-Type"]; // Let browser set multipart boundary

      const res = await fetch(`${API_URL}/admin/upload`, {
        method: "POST",
        headers,
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        const imageUrl = data.url;

        // Update drug with new image URL
        const drug = drugs.find(d => d.slug === slug);
        if (drug) {
          const updateRes = await fetch(`${API_URL}/admin/drugs/${slug}`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify({
              name: drug.name,
              class: drug.class,
              description: drug.description,
              image: imageUrl,
              tier: drug.tier
            })
          });

          if (updateRes.ok) {
            loadDrugs();
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }
        }
      } else {
        alert("Failed to upload image");
      }
    } catch (err) {
      alert("Failed to upload image");
    }
  };
  const handleToggleDrugTier = async (slug: string, currentTier: string) => {
    const newTier = currentTier === "free" ? "premium" : "free";
    const drug = drugs.find(d => d.slug === slug);
    if (!drug) return;
    
    try {
      const res = await fetch(`${API_URL}/admin/drugs/${slug}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: drug.name,
          class: drug.class,
          description: drug.description,
          image: drug.image,
          tier: newTier
        })
      });
      
      if (res.ok) {
        loadDrugs();
      }
    } catch (err) {
      alert("Failed to update tier");
    }
  };

  const handleAddUser = async () => {
    const email = prompt("Enter user email:");
    if (!email) return;
    
    const password = prompt("Enter temporary password:");
    if (!password) return;
    
    try {
      const res = await fetch(`${API_URL}/admin/users`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ email, password, tier: "free", isAdmin: false })
      });
      
      if (res.ok) {
        loadUsers();
      } else {
        alert("Failed to add user (email may exist)");
      }
    } catch (err) {
      alert("Failed to add user");
    }
  };

  const handleToggleAdmin = async (id: number, currentIsAdmin: number) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    
    try {
      const res = await fetch(`${API_URL}/admin/users/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ tier: user.tier, isAdmin: !currentIsAdmin })
      });
      
      if (res.ok) {
        loadUsers();
      }
    } catch (err) {
      alert("Failed to update user");
    }
  };

  const handleToggleUserTier = async (id: number) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    
    const newTier = user.tier === "free" ? "premium" : "free";
    
    try {
      const res = await fetch(`${API_URL}/admin/users/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ tier: newTier, isAdmin: user.is_admin })
      });
      
      if (res.ok) {
        loadUsers();
      }
    } catch (err) {
      alert("Failed to update tier");
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm("Delete this user?")) return;
    
    try {
      const res = await fetch(`${API_URL}/admin/users/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      
      if (res.ok) {
        loadUsers();
      }
    } catch (err) {
      alert("Failed to delete user");
    }
  };

  const handleAddBlock = () => {
    const newRow: ContentRow = {
      type: "content",
      title: "New Block",
      content: "",
      keyPoints: "",
      question: "",
      options: "",
      correct: "",
      explanation: "",
      rationale: "",
      image: ""
    };
    setBlocks([...blocks, newRow]);
    setPreviewIndex(blocks.length);
  };

  const handleDeleteBlock = (idx: number) => {
    const newBlocks = blocks.filter((_, i) => i !== idx);
    setBlocks(newBlocks);
    if (previewIndex >= newBlocks.length) {
      setPreviewIndex(Math.max(0, newBlocks.length - 1));
    }
  };

  const moveBlock = (idx: number, direction: "up" | "down") => {
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === blocks.length - 1) return;
    
    const newBlocks = [...blocks];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newBlocks[idx], newBlocks[swapIdx]] = [newBlocks[swapIdx], newBlocks[idx]];
    setBlocks(newBlocks);
    setPreviewIndex(swapIdx);
  };

  const updateBlock = (idx: number, field: keyof ContentRow, value: string) => {
    const newBlocks = [...blocks];
    newBlocks[idx] = { ...newBlocks[idx], [field]: value };
    setBlocks(newBlocks);
    
    // Auto-save after 2 second delay
    setAutoSaveStatus("idle");
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(async () => {
      if (!selectedDrug) return;
      setAutoSaveStatus("saving");
      try {
        const res = await fetch(`${API_URL}/admin/drugs/${selectedDrug}/blocks`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({ blocks: newBlocks })
        });
        if (res.ok) {
          setAutoSaveStatus("saved");
          setTimeout(() => setAutoSaveStatus("idle"), 2000);
        }
      } catch (err) {
        console.error("Auto-save failed", err);
        setAutoSaveStatus("idle");
      }
    }, 2000);
  };

  const convertCorrectToLetters = (correct: string, options: string): string => {
    if (!correct || !options) return "";
    const numOptions = options.split("|").length;
    return correct.split(",").map(n => {
      const num = parseInt(n.trim());
      if (isNaN(num) || num < 0 || num >= numOptions) return "";
      return String.fromCharCode(65 + num);
    }).filter(l => l).join(",");
  };

  const handleImageUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("slug", selectedDrug || "block");

    try {
      const headers = getAuthHeaders();
      delete (headers as any)["Content-Type"];

      const res = await fetch(`${API_URL}/admin/upload`, {
        method: "POST",
        headers,
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        updateBlock(idx, "image", data.url);
      } else {
        alert("Failed to upload image");
      }
    } catch (err) {
      alert("Failed to upload image");
    }
  };

  // ========== LOGIN SCREEN ==========
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-16 bg-gray-100 flex items-center justify-center">
      {/* Logo - Upper Left (3 inches = 288px) */}
      <div className="absolute top-4 left-4 z-10">
        <img 
          src="/images/Bio_Logo_white-87f86ab6b807.png" 
          alt="Bio-Sync Academy Logo" 
          className="w-[288px] h-[288px] object-contain"
        />
      </div>

        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Database className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Access</h1>
            <p className="text-gray-500 mt-2">Enter admin password</p>
          </div>
          
          <div className="space-y-4">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Enter password"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-black"
            />
            
            {loginError && (
              <p className="text-red-600 text-sm text-center">Incorrect password</p>
            )}
            
            <button
              onClick={handleLogin}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              Access Admin
            </button>
          </div>
          
          <div className="mt-6 text-center">
            <Link to="/drugs" className="text-gray-500 hover:text-gray-700 text-sm">
              Back to Site
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ========== DRUG EDITOR VIEW ==========
  if (selectedDrug) {
    const currentBlock = blocks[previewIndex];
    
    return (
      <div className="min-h-screen pt-16 bg-gray-50">
        <header className="bg-white border-b px-4 py-4">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => setSelectedDrug(null)} className="flex items-center gap-1 text-gray-500 hover:text-gray-700">
                <ArrowLeft className="w-4 h-4" />
                Back to Drugs
              </button>
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                <span className="font-bold text-lg text-black">{selectedDrug} Editor</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {saved && <span className="text-green-600 text-sm">Saved!</span>}
              <button onClick={handleLogout} className="flex items-center gap-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm">
                <X className="w-4 h-4" />
                Logout
              </button>
              <button onClick={handleSaveAll} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Save className="w-4 h-4" />
                Save All
              </button>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-6">
          <div className="bg-white rounded-lg shadow mb-4 p-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-gray-700">Blocks:</span>
              <div className="flex-1 flex gap-2 overflow-x-auto pb-2">
                {blocks.map((row, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPreviewIndex(idx)}
                    className={`flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      idx === previewIndex ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <span className="mr-2">{idx + 1}.</span>
                    <span className="truncate max-w-[100px]">{row.title}</span>
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                      row.type === "content" ? "bg-blue-200 text-blue-800" :
                      row.type === "mc" ? "bg-purple-200 text-purple-800" :
                      "bg-orange-200 text-orange-800"
                    }`}>
                      {row.type}
                    </span>
                  </button>
                ))}
              </div>
              <button onClick={handleAddBlock} className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: Preview Card (Student View) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-500">STUDENT PREVIEW</h3>
                {autoSaveStatus === "saving" && <span className="text-xs text-blue-600 animate-pulse">Auto-saving...</span>}
                {autoSaveStatus === "saved" && <span className="text-xs text-green-600">✓ Auto-saved!</span>}
              </div>
              {currentBlock ? (
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {currentBlock.type === "content" ? <Activity className="w-6 h-6 text-white" /> :
                         currentBlock.type === "mc" ? <AlertCircle className="w-6 h-6 text-white" /> :
                         <Eye className="w-6 h-6 text-white" />}
                        <h2 className="text-xl font-bold text-white">{currentBlock.title}</h2>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        currentBlock.type === "content" ? "bg-blue-500" :
                        currentBlock.type === "mc" ? "bg-purple-500" : "bg-orange-500"
                      } text-white`}>
                        {currentBlock.type === "content" ? "LEARN" : currentBlock.type === "mc" ? "MC" : "SATA"}
                      </span>
                    </div>
                  </div>

                  <div className="p-6">
                    {currentBlock.image && (
                      <img src={currentBlock.image} alt="" className="w-full h-48 object-cover rounded-lg mb-4" />
                    )}
                    
                    {currentBlock.type === "content" ? (
                      <div className="space-y-4">
                        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                          <p className="text-gray-800">{currentBlock.content || "No content"}</p>
                        </div>
                        {currentBlock.keyPoints && (
                          <div className="bg-gray-50 rounded-xl p-4">
                            <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                              <Heart className="w-4 h-4 text-red-500" />
                              Key Points
                            </h4>
                            <ul className="space-y-1">
                              {currentBlock.keyPoints.split("|").map((p, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5" />
                                  {p.trim()}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-lg text-gray-800 font-medium">{currentBlock.question || "No question"}</p>
                        <div className="space-y-2">
                          {currentBlock.options ? currentBlock.options.split("|").map((opt, i) => {
                            const correctAnswers = currentBlock.correct || "";
                            // For MC: correct is stored as letter (A, B, C, D)
                            // For SATA: correct is stored as numbers (0, 1, 2, 3)
                            let correct = false;
                            if (currentBlock.type === "mc") {
                              // MC: check if this index matches the letter (A=0, B=1, etc.)
                              const correctLetter = correctAnswers.trim();
                              correct = correctLetter === String.fromCharCode(65 + i);
                            } else {
                              // SATA: parse as numbers
                              correct = correctAnswers.split(",").map(n => parseInt(n.trim())).filter(n => !isNaN(n)).includes(i);
                            }
                            return (
                              <div key={i} className={`p-3 rounded-lg border-2 ${correct ? "border-green-500 bg-green-50" : "border-gray-200 bg-gray-50"}`}>
                                <div className="flex items-center gap-3">
                                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold ${correct ? "bg-green-500 text-white" : "bg-gray-200"}`}>
                                    {String.fromCharCode(65 + i)}
                                  </span>
                                  <span className="text-black">{opt}</span>
                                  {correct && <Check className="w-5 h-5 text-green-600 ml-auto" />}
                                </div>
                              </div>
                            );
                          }) : <p className="text-gray-400 italic">No options</p>}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-100 px-6 py-3 flex items-center justify-between">
                    <div className="flex gap-1">
                      {blocks.map((_, i) => (
                        <div key={i} className={`w-2 h-2 rounded-full ${i === previewIndex ? "bg-blue-500" : i < previewIndex ? "bg-green-500" : "bg-gray-300"}`} />
                      ))}
                    </div>
                    <span className="text-sm text-gray-500">Block {previewIndex + 1} of {blocks.length}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-500">Loading blocks...</p>
                </div>
              )}
            </div>

            {/* RIGHT: Edit Form */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-3">EDIT BLOCK</h3>
              {currentBlock ? (
                <div className="bg-white rounded-xl shadow p-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                        <select
                          value={currentBlock.type}
                          onChange={(e) => updateBlock(previewIndex, "type", e.target.value as any)}
                          className="w-full border rounded-lg px-3 py-2 text-black bg-white"
                        >
                          <option value="content">Content (Learn)</option>
                          <option value="mc">Multiple Choice</option>
                          <option value="sata">Select All That Apply</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                        <input
                          value={currentBlock.title}
                          onChange={(e) => updateBlock(previewIndex, "title", e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-black"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
                      <div className="flex gap-2">
                        <input
                          value={currentBlock.image}
                          onChange={(e) => updateBlock(previewIndex, "image", e.target.value)}
                          placeholder="/images/drug.png or data:image..."
                          className="flex-1 border rounded-lg px-3 py-2 text-black"
                        />
                        <label className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer">
                          <Upload className="w-5 h-5" />
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(previewIndex, e)} />
                        </label>
                      </div>
                    </div>

                    {currentBlock.type === "content" ? (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                          <textarea
                            value={currentBlock.content}
                            onChange={(e) => updateBlock(previewIndex, "content", e.target.value)}
                            rows={4}
                            className="w-full border rounded-lg px-3 py-2 text-black"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Key Points (pipe-separated)</label>
                          <input
                            value={currentBlock.keyPoints}
                            onChange={(e) => updateBlock(previewIndex, "keyPoints", e.target.value)}
                            placeholder="Point 1|Point 2|Point 3"
                            className="w-full border rounded-lg px-3 py-2 text-black"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                          <textarea
                            value={currentBlock.question}
                            onChange={(e) => updateBlock(previewIndex, "question", e.target.value)}
                            rows={3}
                            className="w-full border rounded-lg px-3 py-2 text-black"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Options (pipe-separated)</label>
                          <textarea
                            value={currentBlock.options || ""}
                            onChange={(e) => updateBlock(previewIndex, "options", e.target.value)}
                            placeholder="Option A|Option B|Option C|Option D"
                            rows={2}
                            className="w-full border rounded-lg px-3 py-2 text-black"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Correct Answer {currentBlock.type === "sata" && "(comma-separated letters like A,C)"}
                          </label>
                          <input
                            type="text"
                            defaultValue={currentBlock.type === "sata" ? convertCorrectToLetters(currentBlock.correct, currentBlock.options) : currentBlock.correct}
                            onBlur={(e) => {
                              const value = e.target.value.toUpperCase().replace(/[^A-D,]/g, '');
                              if (currentBlock.type === "sata") {
                                // For SATA: convert letters to numbers
                                const nums = value.split(',').map(l => l.trim().charCodeAt(0) - 65).filter(n => n >= 0 && n < 4).join(',');
                                updateBlock(previewIndex, "correct", nums);
                              } else {
                                // For MC: just store the letter
                                updateBlock(previewIndex, "correct", value);
                              }
                            }}
                            placeholder={currentBlock.type === "mc" ? "B" : "A,C"}
                            className="w-full border rounded-lg px-3 py-2 text-black"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Explanation</label>
                          <textarea
                            value={currentBlock.explanation}
                            onChange={(e) => updateBlock(previewIndex, "explanation", e.target.value)}
                            rows={2}
                            className="w-full border rounded-lg px-3 py-2 text-black"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Rationale</label>
                          <textarea
                            value={currentBlock.rationale}
                            onChange={(e) => updateBlock(previewIndex, "rationale", e.target.value)}
                            rows={2}
                            className="w-full border rounded-lg px-3 py-2 text-black"
                          />
                        </div>
                      </>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => moveBlock(previewIndex, "up")}
                          disabled={previewIndex === 0}
                          className="px-3 py-1 text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 rounded disabled:opacity-50 disabled:bg-gray-100 disabled:text-gray-500"
                        >
                          <ChevronLeft className="w-4 h-4 inline" /> Move Up
                        </button>
                        <button
                          onClick={() => moveBlock(previewIndex, "down")}
                          disabled={previewIndex === blocks.length - 1}
                          className="px-3 py-1 text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 rounded disabled:opacity-50 disabled:bg-gray-100 disabled:text-gray-500"
                        >
                          Move Down <ChevronRight className="w-4 h-4 inline" />
                        </button>
                      </div>
                      <button
                        onClick={() => handleDeleteBlock(previewIndex)}
                        className="flex items-center gap-1 px-3 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Block
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow p-6 text-center">
                  <p className="text-gray-500">Select a block or add a new one</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ========== MAIN ADMIN DASHBOARD ==========
  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <header className="bg-white border-b px-4 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/drugs" className="flex items-center gap-1 text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-4 h-4" />
              Back to Site
            </Link>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-lg text-black">Pharmacology Admin</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saved && <span className="text-green-600 text-sm">Saved!</span>}
            <button onClick={() => setView("drugs")} className={`px-4 py-2 rounded ${view === "drugs" ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:text-gray-800"}`}>Drugs</button>
                        <button onClick={() => setView("users")} className={`px-4 py-2 rounded ${view === "users" ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:text-gray-800"}`}>Users</button>
            <button onClick={() => setView("tiers")} className={`px-4 py-2 rounded ${view === "tiers" ? "bg-yellow-100 text-yellow-700" : "text-gray-600 hover:text-gray-800"}`}>Tiers</button>
            <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              <Plus className="w-4 h-4" />
              Create Drug
            </button>
            <button onClick={handleLogout} className="flex items-center gap-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm">
              <X className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {view === "drugs" ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Drug Library</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {drugs.map((drug) => (
                <div key={drug.slug} className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          {drug.image ? (
                            <img src={drug.image} alt="" className="w-10 h-10 object-contain" />
                          ) : (
                            <Heart className="w-6 h-6 text-red-500" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">{drug.name}</h3>
                          <p className="text-sm text-blue-600">{drug.class}</p>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteDrug(drug.slug)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{drug.description}</p>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs text-gray-400">{drug.block_count || 0} blocks</span>
                      <button
                        onClick={() => handleToggleDrugTier(drug.slug, drug.tier)}
                        className={`px-3 py-1 rounded text-xs font-semibold border ${
                          drug.tier === "premium" 
                            ? "bg-yellow-100 text-yellow-800 border-yellow-300" 
                            : "bg-gray-100 text-gray-800 border-gray-300"
                        }`}
                      >
                        <Star className="w-3 h-3 inline mr-1" />
                        {drug.tier === "premium" ? "PREMIUM" : "FREE"}
                      </button>
                    </div>
                    <button onClick={() => setSelectedDrug(drug.slug)} className="w-full flex items-center justify-center gap-1 text-blue-600 hover:text-blue-800 font-medium text-sm py-2 border rounded-lg hover:bg-blue-50">
                      Edit Content <ArrowRight className="w-4 h-4" />
                    </button>
                    <label className="w-full flex items-center justify-center gap-1 text-gray-600 hover:text-gray-800 font-medium text-sm py-2 border rounded-lg hover:bg-gray-50 cursor-pointer mt-2">
                      <Upload className="w-4 h-4" />
                      Upload Thumbnail
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleThumbnailUpload(drug.slug, e)}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
            {drugs.length === 0 && (
              <div className="text-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-gray-500 mx-auto mb-4" />
                <p className="text-gray-500">Loading drugs...</p>
              </div>
            )}
          </>
          ) : view === "tiers" ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Tier Management</h1>
              <div className="flex items-center gap-4 text-sm">
                <div className="bg-white px-4 py-2 rounded-lg shadow-sm">
                  <span className="text-gray-500">Free: </span>
                  <span className="font-bold text-green-600">{drugs.filter(d => d.tier === "free").length}</span>
                </div>
                <div className="bg-white px-4 py-2 rounded-lg shadow-sm">
                  <span className="text-gray-500">Premium: </span>
                  <span className="font-bold text-yellow-600">{drugs.filter(d => d.tier === "premium").length}</span>
                </div>
                <div className="bg-white px-4 py-2 rounded-lg shadow-sm">
                  <span className="text-gray-500">Total: </span>
                  <span className="font-bold text-blue-600">{drugs.length}</span>
                </div>
              </div>
            </div>
            
            {/* Tier Filter Tabs */}
            <div className="flex items-center gap-2 mb-6">
              <button 
                onClick={() => setTierFilter("all")}
                className={`px-4 py-2 rounded-lg font-medium ${tierFilter === "all" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}
              >
                All Drugs
              </button>
              <button 
                onClick={() => setTierFilter("free")}
                className={`px-4 py-2 rounded-lg font-medium ${tierFilter === "free" ? "bg-green-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}
              >
                Free Only
              </button>
              <button 
                onClick={() => setTierFilter("premium")}
                className={`px-4 py-2 rounded-lg font-medium ${tierFilter === "premium" ? "bg-yellow-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}
              >
                Premium Only
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {drugs.filter(d => tierFilter === "all" || d.tier === tierFilter).map((drug) => (
                <div key={drug.slug} className={`bg-white rounded-xl shadow-sm border-2 transition-shadow ${drug.tier === "premium" ? "border-yellow-300" : "border-gray-200"}`}>
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${drug.tier === "premium" ? "bg-yellow-100" : "bg-blue-100"}`}>
                          {drug.image ? (
                            <img src={drug.image} alt="" className="w-10 h-10 object-contain" />
                          ) : (
                            <Heart className={`w-6 h-6 ${drug.tier === "premium" ? "text-yellow-600" : "text-blue-600"}`} />
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">{drug.name}</h3>
                          <p className="text-sm text-blue-600">{drug.class}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Big Tier Toggle Button */}
                    <div className="mb-4">
                      <button
                        onClick={() => handleToggleDrugTier(drug.slug, drug.tier)}
                        className={`w-full py-3 rounded-lg font-bold text-sm border-2 transition-all ${
                          drug.tier === "premium" 
                            ? "bg-yellow-100 text-yellow-800 border-yellow-400 hover:bg-yellow-200" 
                            : "bg-green-100 text-green-800 border-green-400 hover:bg-green-200"
                        }`}
                      >
                        <Star className={`w-4 h-4 inline mr-2 ${drug.tier === "premium" ? "fill-yellow-600" : ""}`} />
                        {drug.tier === "premium" ? "PREMIUM - Click to Make FREE" : "FREE - Click to Make PREMIUM"}
                      </button>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{drug.description}</p>
                    
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
                      <span>{drug.block_count || 0} blocks</span>
                      <span className={`font-semibold ${drug.tier === "premium" ? "text-yellow-600" : "text-green-600"}`}>
                        {drug.tier.toUpperCase()}
                      </span>
                    </div>
                    
                    <button onClick={() => setSelectedDrug(drug.slug)} className="w-full flex items-center justify-center gap-1 text-blue-600 hover:text-blue-800 font-medium text-sm py-2 border rounded-lg hover:bg-blue-50">
                      Edit Content <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {drugs.filter(d => tierFilter === "all" || d.tier === tierFilter).length === 0 && (
              <div className="text-center py-16">
                <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No {tierFilter} drugs found.</p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
              <button onClick={handleAddUser} className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <Plus className="w-4 h-4" />
                Add User
              </button>
            </div>
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-black">Email</th>
                    <th className="px-4 py-3 text-left font-semibold text-black">Tier</th>
                    <th className="px-4 py-3 text-left font-semibold text-black">Admin</th>
                    <th className="px-4 py-3 text-left font-semibold text-black">Joined</th>
                    <th className="px-4 py-3 text-left font-semibold text-black">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-black">{user.email}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleUserTier(user.id)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                            user.tier === "premium" 
                              ? "bg-yellow-100 text-yellow-800 border-yellow-300" 
                              : "bg-gray-100 text-gray-800 border-gray-300"
                          }`}
                        >
                          <Star className="w-3 h-3 inline mr-1" />
                          {user.tier === "premium" ? "PREMIUM" : "FREE"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleAdmin(user.id, user.is_admin)}
                          className={`px-3 py-1 rounded text-xs font-semibold ${
                            user.is_admin ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {user.is_admin ? "ADMIN" : "USER"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{user.joined_at}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDeleteUser(user.id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && <div className="text-center py-12 text-gray-500">No users yet</div>}
            </div>
          </>
        )}
      </div>

      {/* Create Drug Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Create New Drug</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Drug Name</label>
                <input
                  value={newDrug.name}
                  onChange={(e) => setNewDrug({ ...newDrug, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                  placeholder="e.g., Metoprolol"
                  className="w-full border rounded-lg px-3 py-2 text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL Slug</label>
                <input
                  value={newDrug.slug}
                  onChange={(e) => setNewDrug({ ...newDrug, slug: e.target.value })}
                  placeholder="metoprolol"
                  className="w-full border rounded-lg px-3 py-2 text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Drug Class</label>
                <input
                  value={newDrug.class}
                  onChange={(e) => setNewDrug({ ...newDrug, class: e.target.value })}
                  placeholder="e.g., Beta Blocker"
                  className="w-full border rounded-lg px-3 py-2 text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newDrug.description}
                  onChange={(e) => setNewDrug({ ...newDrug, description: e.target.value })}
                  placeholder="Brief description..."
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-black"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowCreateModal(false)} className="flex-1 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={handleCreateDrug} className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}