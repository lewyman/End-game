import { BrowserRouter, Route, Routes, Link, useLocation, useNavigate } from "react-router-dom";
import { ThemeProvider } from "./components/theme-provider";
import { AuthProvider, useZoAuth } from "./lib/auth";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import AdminContent from "./pages/AdminContent";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Pricing from "./pages/Pricing";
import AuthCallback from "./pages/AuthCallback";
import DrugCards from "./pages/DrugCards";
import ClinicalTools from "./pages/ClinicalTools";
import Account from "./pages/Account";
import AdminDashboard from "./pages/AdminDashboard";
import AdminReview from "./pages/AdminReview";
import Terms from "./pages/Terms";
import RefundPolicy from "./pages/RefundPolicy";
import BillingSuccess from "./pages/BillingSuccess";
import FilesPage from "./pages/Files";
import PathwaysPage from "./pages/Pathways";
import PathwayPlayerPage from "./pages/PathwayPlayer";
import KnowledgeWebPage from "./pages/KnowledgeWeb";
import { ProceduresListPage, ProcedureDetailRoute } from "./pages/Procedures";
import BlogList from "./pages/BlogList";
import BlogPost from "./pages/BlogPost";
import Community from "./pages/Community";
import NclexPage from "./pages/NclexPage";
import { GraduationCap, Menu, X, LogOut, User } from "lucide-react";
import { useState } from "react";

function NavBar() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, signOut } = useZoAuth();
  const adminEmails = new Set(["crusius00@gmail.com", "christian.c.lewis@endgameenhancements.com", "chad.l.lewis@endgameenhancements.com"]);
  const isAdminUser = user?.email ? adminEmails.has(user.email) : false;
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
    navigate("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/images/logo.jpg" className="h-8 w-auto rounded-lg" alt="Bio-Sync Academy" />
            <span className="text-base font-bold text-foreground tracking-tight hidden sm:inline">Bio-Sync</span>
          </Link>

          <div className="hidden lg:flex items-center gap-1.5">
            <Link
              to="/nclex"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isActive("/nclex") ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              NCLEX Practice
            </Link>
            <Link
              to="/drug-cards"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isActive("/drug-cards") ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              Drug Cards
            </Link>
            <Link
              to="/clinical-tools"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isActive("/clinical-tools") ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              Clinical Tools
            </Link>
            <Link
              to="/procedures"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isActive("/procedures") ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              Procedures
            </Link>
            <Link
              to="/blog"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isActive("/blog") ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              Blog
            </Link>
            <Link
              to="/community"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isActive("/community") ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              Community
            </Link>
            {user && <>
              <Link
                to="/files"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isActive("/files") ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
              >
                My Files
              </Link>
              <Link
                to="/knowledge-web"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isActive("/knowledge-web") ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
              >
                Knowledge Web
              </Link>
              <Link
                to="/pathways"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isActive("/pathways") ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
              >
                Pathways
              </Link>
            </>}
            <Link
              to="/pricing"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isActive("/pricing") ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              Pricing
            </Link>
            {user ? (
              <div className="flex items-center gap-2 ml-2">
                <Link
                  to="/account"
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isActive("/account") ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                >
                  Account
                </Link>
                {isAdminUser && (
                  <Link
                    to="/admin/dashboard"
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isActive("/admin/dashboard") ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                  >
                    Admin
                  </Link>
                )}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary border border-border">
                  {user.picture ? <img src={user.picture} alt="" className="w-5 h-5 rounded-full" /> : <User className="w-4 h-4 text-primary" />}
                  <span className="text-sm text-muted-foreground max-w-[160px] truncate">{user.name || user.email}</span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="ml-2 px-4 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-md shadow-primary/20"
              >
                Login
              </Link>
            )}
          </div>

          <button onClick={() => setIsOpen(!isOpen)} className="lg:hidden p-2 text-muted-foreground hover:text-foreground">
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="lg:hidden bg-card border-t border-border">
          <div className="px-4 py-3 space-y-1">
            <Link to="/nclex" onClick={() => setIsOpen(false)} className="block px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg">NCLEX Practice</Link>
            <Link to="/drug-cards" onClick={() => setIsOpen(false)} className="block px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg">Drug Cards</Link>
            <Link to="/clinical-tools" onClick={() => setIsOpen(false)} className="block px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg">Clinical Tools</Link>
            <Link to="/procedures" onClick={() => setIsOpen(false)} className="block px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg">Procedures</Link>
            <Link to="/blog" onClick={() => setIsOpen(false)} className="block px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg">Blog</Link>
            <Link to="/community" onClick={() => setIsOpen(false)} className="block px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg">Community</Link>
            {user && <>
              <Link to="/files" onClick={() => setIsOpen(false)} className="block px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg">My Files</Link>
              <Link to="/knowledge-web" onClick={() => setIsOpen(false)} className="block px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg">Knowledge Web</Link>
              <Link to="/pathways" onClick={() => setIsOpen(false)} className="block px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg">Pathways</Link>
            </>}
            <Link to="/pricing" onClick={() => setIsOpen(false)} className="block px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg">Pricing</Link>
            {user ? (
              <>
                <div className="px-4 py-2 text-sm text-muted-foreground">{user.email}</div>
                <Link to="/account" onClick={() => setIsOpen(false)} className="block px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg">Account</Link>
                <button onClick={handleSignOut} className="flex items-center gap-2 w-full text-left px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg">
                  <LogOut className="w-4 h-4" />Sign Out
                </button>
              </>
            ) : (
              <Link to="/login" onClick={() => setIsOpen(false)} className="block px-4 py-3 text-sm text-primary hover:opacity-80">Login with Google</Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

function AppRoutes() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main className="pt-16">
        <Routes>
          <Route path="/nclex" element={<NclexPage />} />
          <Route path="/" element={<Home />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/billing/success" element={<BillingSuccess />} />
          <Route path="/files" element={<FilesPage />} />
          <Route path="/pathways" element={<PathwaysPage />} />
          <Route path="/pathways/:id" element={<PathwayPlayerPage />} />
          <Route path="/knowledge-web" element={<KnowledgeWebPage />} />
          <Route path="/procedures" element={<ProceduresListPage />} />
          <Route path="/procedures/:id" element={<ProcedureDetailRoute />} />
          <Route path="/login" element={<AuthCallback />} />
          <Route path="/sign-in/*" element={<AuthCallback />} />
          <Route path="/sign-up/*" element={<AuthCallback />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/content" element={<AdminContent />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/drug-cards" element={<DrugCards />} />
          <Route path="/clinical-tools" element={<ClinicalTools />} />
          <Route path="/blog" element={<BlogList />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/community" element={<Community />} />
          <Route path="/account" element={<Account />} />
          <Route path="/admin/review" element={<AdminReview />} />
          <Route path="/nclex" element={<NclexPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="maia-ui-theme">
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
