import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Loader2, Crown, Zap, Sparkles, Rocket } from "lucide-react";
import { useZoAuth } from "../lib/auth";
import type { PlanTier } from "../lib/auth";

const API_URL = "/api";

interface TierConfig {
  key: PlanTier;
  name: string;
  icon: React.ReactNode;
  monthly: { price: string; priceId: string; amount: number };
  yearly: { price: string; priceId: string; amount: number; savings: string };
  description: string;
  color: string;
  ring: string;
  badge?: string;
  features: string[];
}

const tiers: TierConfig[] = [
  {
    key: "free",
    name: "Free",
    icon: <Zap className="w-5 h-5" />,
    monthly: { price: "$0", priceId: "free", amount: 0 },
    yearly: { price: "$0", priceId: "free", amount: 0, savings: "" },
    description: "Try MAIA risk-free",
    color: "text-foreground/80",
    ring: "ring-slate-700",
    features: [
      "2 MAIA AI calls per day",
      "1 study pathway",
      "1 clinical tool generated",
      "5 files stored",
      "Pharmacology & pathophysiology Q&A",
      "NCLEX quiz mode",
      "Basic drug class explanations",
      "Community support",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    icon: <Crown className="w-5 h-5" />,
    monthly: { price: "$19.99", priceId: "price_1TalCCHue6jkR6Odd4bu7GOa", amount: 1999 },
    yearly: { price: "$214.99", priceId: "price_1TalCIHue6jkR6OddID87NkU", amount: 21499, savings: "Save $25/yr" },
    description: "Serious daily study",
    color: "text-primary/80",
    ring: "ring-violet-700",
    features: [
      "20 MAIA AI calls per day",
      "20 study pathways",
      "5 clinical tools generated",
      "Pathway Builder + SM-2 spaced repetition",
      "Pathway branching & multi-file",
      "Add content to existing pathways",
      "Pathway search & filter",
      "Generated study tools",
      "Priority email support",
    ],
  },
  {
    key: "pro_plus",
    name: "Pro Plus",
    icon: <Sparkles className="w-5 h-5" />,
    monthly: { price: "$59.99", priceId: "price_1Tb3poHue6jkR6OdO2PYcgyy", amount: 5999 },
    yearly: { price: "$599.99", priceId: "price_1Tb3poHue6jkR6OdJbYi75zl", amount: 59999, savings: "Save $120/yr" },
    description: "Power student mode",
    color: "text-fuchsia-300",
    ring: "ring-fuchsia-500",
    badge: "Most Popular",
    features: [
      "50 MAIA AI calls per day",
      "50 study pathways",
      "20 clinical tools generated",
      "1GB file library",
      "NCLEX Tutor Mode (full explanations)",
      "NCLEX Timed Mode",
      "Manual pathway creation",
      "Pathway duplicate & fork",
      "Pathway sharing",
      "Study reminder notifications",
      "Early access to new features",
      "Everything in Pro",
    ],
  },
  {
    key: "max",
    name: "Max",
    icon: <Rocket className="w-5 h-5" />,
    monthly: { price: "$99.99", priceId: "price_1Tb3poHue6jkR6OdOzSi5Czi", amount: 9999 },
    yearly: { price: "$999.99", priceId: "price_1Tb3poHue6jkR6Od53q1YJ8l", amount: 99999, savings: "Save $200/yr" },
    description: "Tutor-level power",
    color: "text-amber-300",
    ring: "ring-amber-500",
    features: [
      "150 MAIA AI calls per day",
      "150 study pathways",
      "100 clinical tools generated",
      "5GB file library",
      "NCLEX Custom Focus (body system, category, type)",
      "Clinical Decision Tools",
      "Everything in Pro Plus",
    ],
  },
];

const comparisonRows: { label: string; free: string; pro: string; pro_plus: string; max: string }[] = [
  { label: "MAIA calls/day", free: "2", pro: "20", pro_plus: "50", max: "150" },
  { label: "Pathways generated", free: "1", pro: "20", pro_plus: "50", max: "150" },
  { label: "Clinical tools", free: "1", pro: "5", pro_plus: "20", max: "100" },
  { label: "File library", free: "5 files", pro: "—", pro_plus: "1 GB", max: "5 GB" },
  { label: "NCLEX quiz mode", free: "✅", pro: "✅", pro_plus: "✅", max: "✅" },
  { label: "NCLEX Tutor Mode", free: "—", pro: "—", pro_plus: "✅", max: "✅" },
  { label: "NCLEX Timed Mode", free: "—", pro: "—", pro_plus: "✅", max: "✅" },
  { label: "NCLEX Custom Focus", free: "—", pro: "—", pro_plus: "—", max: "✅" },
  { label: "Pathway Builder (AI)", free: "✅", pro: "✅", pro_plus: "✅", max: "✅" },
  { label: "Pathway Player + SM-2", free: "—", pro: "✅", pro_plus: "✅", max: "✅" },
  { label: "Pathway branching", free: "—", pro: "✅", pro_plus: "✅", max: "✅" },
  { label: "Add content to pathway", free: "—", pro: "✅", pro_plus: "✅", max: "✅" },
  { label: "Manual pathway creation", free: "—", pro: "—", pro_plus: "✅", max: "✅" },
  { label: "Pathway fork / duplicate", free: "—", pro: "—", pro_plus: "✅", max: "✅" },
  { label: "Pathway sharing", free: "—", pro: "—", pro_plus: "✅", max: "✅" },
  { label: "SM-2 scheduling engine", free: "—", pro: "✅", pro_plus: "✅", max: "✅" },
  { label: "Clinical Decision Tools", free: "—", pro: "—", pro_plus: "—", max: "✅" },
  { label: "Early access", free: "—", pro: "—", pro_plus: "✅", max: "✅" },
  { label: "Priority support", free: "—", pro: "✅", pro_plus: "✅", max: "✅" },
];

function PricingContent() {
  const { account, isSignedIn } = useZoAuth();
  const navigate = useNavigate();
  const [yearly, setYearly] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const currentPlan = account?.plan || "free";

  async function handleSelect(tier: TierConfig) {
    if (tier.key === "free") return;
    if (!isSignedIn) { navigate("/login?returnTo=/pricing"); return; }
    if (tier.key === currentPlan) return;
    const priceId = yearly ? tier.yearly.priceId : tier.monthly.priceId;
    setLoading(tier.key);
    setError("");
    try {
      const res = await fetch(`${API_URL}/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json() as any;
      if (!res.ok) { setError(data.error || "Checkout failed."); return; }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-background text-white pb-20">
      <div className="max-w-6xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-3">Choose your plan</h1>
          <p className="text-muted-foreground text-lg">Every plan backed by MAIA — your personal nursing AI</p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <span className={`text-sm font-medium ${!yearly ? "text-white" : "text-muted-foreground/80"}`}>Monthly</span>
          <button
            onClick={() => setYearly(!yearly)}
            className={`relative w-12 h-6 rounded-full transition-colors overflow-hidden ${yearly ? "bg-primary" : "bg-muted"}`}
          >
            <span className={`absolute top-1 left-0 w-4 h-4 rounded-full bg-white transition-transform ${yearly ? "translate-x-7" : "translate-x-1"}`} />
          </button>
          <span className={`text-sm font-medium ${yearly ? "text-white" : "text-muted-foreground/80"}`}>
            Yearly <span className="text-emerald-400 text-xs ml-1">Save up to $200</span>
          </span>
        </div>

        {error && <div className="text-red-300 text-sm text-center mb-6">{error}</div>}

        {/* Tier cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
          {tiers.map((tier) => {
            const price = yearly ? tier.yearly : tier.monthly;
            const isCurrent = tier.key === currentPlan;
            const isPopular = !!tier.badge;
            return (
              <div
                key={tier.key}
                className={`relative rounded-2xl p-6 flex flex-col border ${
                  isPopular
                    ? "bg-fuchsia-950/40 border-[#0d7a47]/50 shadow-lg shadow-fuchsia-900/20"
                    : "bg-card border-border"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0d7a47]/80 text-white text-xs font-bold px-3 py-1 rounded-full">
                    {tier.badge}
                  </div>
                )}
                <div className={`flex items-center gap-2 mb-2 ${tier.color}`}>
                  {tier.icon}
                  <span className="text-sm font-semibold uppercase tracking-wide">{tier.name}</span>
                </div>
                <div className="mb-1">
                  <span className="text-3xl font-bold text-white">{price.price}</span>
                  {tier.key !== "free" && (
                    <span className="text-muted-foreground text-sm ml-1">/{yearly ? "year" : "mo"}</span>
                  )}
                </div>
                {yearly && tier.yearly.savings && (
                  <span className="text-emerald-400 text-xs mb-2">{tier.yearly.savings}</span>
                )}
                <p className="text-muted-foreground text-xs mb-5">{tier.description}</p>
                <ul className="space-y-2 flex-1 mb-6">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-foreground/80">
                      <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSelect(tier)}
                  disabled={!!loading || isCurrent || tier.key === "free"}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isCurrent
                      ? "bg-muted text-muted-foreground cursor-default"
                      : tier.key === "free"
                      ? "bg-card/60 text-muted-foreground/80 cursor-default"
                      : isPopular
                      ? "bg-[#0d7a47] hover:bg-[#0d7a47]/80 text-white"
                      : "bg-primary hover:bg-primary/80 text-white"
                  }`}
                >
                  {loading === tier.key ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : isCurrent ? "Current plan" : tier.key === "free" ? "Free forever" : `Get ${tier.name}`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Testimonials */}
        <div className="mb-16">
          <h2 className="text-xl font-bold text-white text-center mb-6">What nursing students are saying</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { quote: "MAIA explains pharmacology better than my textbook. The NCLEX questions are spot on — I passed my cardio exam because of this.", name: "Sarah M.", detail: "BSN Student, Arizona" },
              { quote: "I was failing pharm until I found Bio-Sync. The drug cards + MAIA combo is unbeatable. Worth every penny.", name: "James R.", detail: "Accelerated BSN, Texas" },
              { quote: "The clinical tools saved me during clinicals. Drug interactions at my fingertips. My instructor was impressed.", name: "Maria G.", detail: "RN-to-BSN, California" },
            ].map(({ quote, name, detail }) => (
              <div key={name} className="rounded-2xl border border-border bg-card/60 p-5">
                <p className="text-foreground/80 text-sm leading-relaxed mb-4 italic">"{quote}"</p>
                <div>
                  <p className="text-white font-semibold text-sm">{name}</p>
                  <p className="text-muted-foreground text-xs">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Comparison table */}
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-4 text-muted-foreground font-medium">Feature</th>
                {tiers.map(t => (
                  <th key={t.key} className={`px-4 py-4 text-center font-semibold ${t.color}`}>{t.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, i) => (
                <tr key={row.label} className={`border-b border-border/50 ${i % 2 === 0 ? "bg-card/30" : ""}`}>
                  <td className="px-5 py-3 text-foreground/80">{row.label}</td>
                  {(["free", "pro", "pro_plus", "max"] as const).map(k => (
                    <td key={k} className="px-4 py-3 text-center text-foreground/80">{row[k]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FAQ */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">Frequently asked questions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {[
              { q: "What counts as an AI call?", a: "Every MAIA chat message, NCLEX question generated, clinical tool creation, pathway generation, and pathway AI review counts as one call toward your daily limit." },
              { q: "Can I upgrade or downgrade at any time?", a: "Yes. Upgrades take effect immediately. Downgrades apply at your next billing cycle." },
              { q: "What happens if I hit my daily limit?", a: "MAIA pauses until midnight (Mountain Time). Free users can upgrade instantly to continue the same session." },
              { q: "Does MAIA remember my conversations?", a: "Yes — MAIA maintains full context throughout each session for real back-and-forth study without repeating yourself." },
              { q: "What is SM-2 spaced repetition?", a: "SM-2 schedules when you revisit lessons based on how well you answered. Get a question right and the interval grows; get it wrong and it resets — so you focus on what you actually need to review." },
              { q: "Can I cancel anytime?", a: "Yes. Cancel from your account page at any time. You keep access until the end of your billing period." },
            ].map(({ q, a }) => (
              <div key={q} className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold text-white text-sm mb-2">{q}</h3>
                <p className="text-muted-foreground text-sm">{a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link to="/" className="text-primary hover:text-primary/80 text-sm font-medium">← Back to MAIA</Link>
        </div>
      </div>
    </div>
  );
}

export default function PricingPage() {
  return <PricingContent />;
}
