import { BrowserRouter, Route, Routes, Link, useLocation } from "react-router-dom";
import { ThemeProvider } from "./components/theme-provider";
import Home from "./pages/Home";
import Nursing from "./pages/Nursing";
import Drugs from "./pages/Drugs";
import DrugDetail from "./pages/DrugDetail";
import Interactions from "./pages/interactions";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import AdminContent from "./pages/AdminContent";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Pricing from "./pages/Pricing";
import Downloads from "./pages/Downloads";
import MyBookmarks from "./pages/MyBookmarks";
import Songs from "./pages/Songs";
import Tier0 from "./pages/Tier0";
import AdminLogin from "./pages/AdminLogin";
import { Pill, Menu, X, Moon, Sun, GraduationCap } from "lucide-react";
import { useState, useEffect } from "react";

function NavBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const [hasValidTier, setHasValidTier] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    const user = localStorage.getItem("pharma_current_user");
    if (user) {
      try {
        const parsed = JSON.parse(user);
        const tier = parsed.subscription_tier || parsed.tier;
        // Valid tiers: tier1_monthly, tier1_yearly, tier2_monthly, tier2_yearly, tier3_monthly, tier3_yearly
        const validTiers = ["tier1_monthly", "tier1_yearly", "tier2_monthly", "tier2_yearly", "tier3_monthly", "tier3_yearly"];
        setHasValidTier(validTiers.includes(tier));
      } catch {
        setHasValidTier(false);
      }
    } else {
      setHasValidTier(false);
    }
  }, [location]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950 shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Link to="/">
              <img 
                src="/images/Bio_Logo_white-87f86ab6b807.png" 
                alt="Bio-Sync Academy Logo" 
                className="w-10 h-10 object-contain"
              />
            </Link>
            <Link to="/" className="text-lg font-bold text-white tracking-tight">Bio-Sync Academy</Link>
          </div>

          <div className="hidden md:flex items-center gap-1">
            <Link to="/" className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive("/") ? "text-white bg-white/10" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>Home</Link>
            {hasValidTier && (
              <>
                <Link to="/nursing" className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive("/nursing") ? "text-white bg-white/10" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>Nursing</Link>
                <Link to="/pricing" className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive("/pricing") ? "text-white bg-white/10" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>Pricing</Link>
              </>
            )}
            <Link to="/tier0" className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive("/tier0") ? "text-white bg-white/10" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>Tier 0</Link>
            <Link to="/login" className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive("/login") ? "text-white bg-white/10" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>Login</Link>
            <Link to="/admin-login" className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive("/admin-login") ? "text-white bg-white/10" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>Admin Logon</Link>
          </div>

          <button onClick={() => setIsOpen(!isOpen)} className="md:hidden p-2 text-slate-400 hover:text-white">
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden bg-slate-900 border-t border-slate-800">
          <div className="px-4 py-3 space-y-1">
            <Link to="/" className="block px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg">Home</Link>
            {hasValidTier && (
              <>
                <Link to="/nursing" className="block px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg">Nursing</Link>
                <Link to="/pricing" className="block px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg">Pricing</Link>
              </>
            )}
            <Link to="/tier0" className="block px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg">Tier 0</Link>
            <Link to="/login" className="block px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg">Login</Link>
          </div>
        </div>
      )}
    </nav>
  );
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="maia-ui-theme">
      <BrowserRouter>
        <div className="min-h-screen bg-white text-gray-900">
          <NavBar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/nursing" element={<Nursing />} />
            <Route path="/nursing/pharmacology" element={<Drugs />} />
            <Route path="/drugs" element={<Drugs />} />
            <Route path="/drugs/:slug" element={<DrugDetail />} />
            <Route path="/interactions" element={<Interactions />} />
            <Route path="/songs" element={<Songs />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/content" element={<AdminContent />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/downloads" element={<Downloads />} />
            <Route path="/bookmarks" element={<MyBookmarks />} />
            <Route path="/tier0" element={<Tier0 />} />
          </Routes>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}
