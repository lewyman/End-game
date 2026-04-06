import { BrowserRouter, Route, Routes, Link, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import Home from "./pages/Home";
import Drugs from "./pages/Drugs";
import DrugDetail from "./pages/DrugDetail";
import Admin from "./pages/Admin";
import AdminContent from "./pages/AdminContent";
import Login from "./pages/Login";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Pricing from "./pages/Pricing";
import Downloads from "./pages/Downloads";
import Interactions from "./pages/interactions";
import MyBookmarks from "./pages/MyBookmarks";
import { Pill, Menu, X, Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";

interface User {
  email: string;
  tier: "free" | "premium";
  isAdmin?: boolean;
}

function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkUser = () => {
      const user = localStorage.getItem("pharma_current_user") || sessionStorage.getItem("pharma_current_user");
      if (user) {
        try {
          const parsed = JSON.parse(user);
          setCurrentUser(parsed);
        } catch (e) {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
    };
    checkUser();
    
    const isDark = localStorage.getItem("darkMode") === "true";
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
    }
  }, [location.pathname]);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem("darkMode", String(newMode));
    if (newMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("pharma_current_user");
    sessionStorage.removeItem("pharma_current_user");
    sessionStorage.removeItem("admin_auth");
    setCurrentUser(null);
    window.location.href = "/";
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto flex h-14 items-center px-4">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <img src="/images/bio-sync-academy-logo.png" alt="Bio-Sync Academy" className="h-10" />
        </Link>
        
        <nav className="hidden md:flex gap-6 text-sm ml-auto items-center">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">Home</Link>
          <Link to="/drugs" className="text-muted-foreground hover:text-foreground transition-colors">DrugCards</Link>
          <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
          
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={darkMode ? "Light Mode" : "Dark Mode"}
          >
            {darkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-gray-600" />}
          </button>
          
          {currentUser ? (
            <div className="flex items-center gap-3">
              {currentUser.isAdmin && (
                <Link to="/admin/content" className="px-3 py-1 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700">Admin</Link>
              )}
              <span className="text-sm text-gray-600">{currentUser.email}</span>
              <Link to="/bookmarks" className="text-blue-600 hover:text-blue-800 text-sm">My Bookmarks</Link><button onClick={handleLogout} className="text-red-600 hover:text-red-800 text-sm">Logout</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors">Log In</Link>
              <Link to="/login?signup=true" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Sign Up</Link>
            </div>
          )}
        </nav>

        <button className="md:hidden ml-auto p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t bg-muted py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-muted-foreground">2026 NursingPharmacology. Pharmacology resources for nursing students.</p>
          <nav className="flex gap-6 text-sm">
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Navigation />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/drugs" element={<Drugs />} />
          <Route path="/drugs/:slug" element={<DrugDetail />} />
          <Route path="/admin" element={<AdminContent />} />
          <Route path="/admin/content" element={<AdminContent />} />
          <Route path="/login" element={<Login />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/interactions" element={<Interactions />} />
          <Route path="/bookmarks" element={<MyBookmarks />} />
        </Routes>
        <Footer />
      </BrowserRouter>
    </ThemeProvider>
  );
}