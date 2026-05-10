import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Pill, Check, Loader2, GraduationCap, Crown } from "lucide-react";

const API_URL = "/api";

interface PricingTier {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  priceId: string;
  popular?: boolean;
}

const pricingTiers: PricingTier[] = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Basic access for nursing students",
    features: [
      "Access to free drug cards",
      "Basic quizzes",
      "Community support"
    ],
    priceId: "free"
  },
  {
    name: "Pro Monthly",
    price: "$4.99",
    period: "/month",
    description: "Full access for serious nursing students",
    features: [
      "All 500+ drug cards",
      "Interactive quizzes & SATA",
      "Printable study guides",
      "Progress tracking",
      "Cancel anytime"
    ],
    priceId: "price_monthly",
    popular: true
  },
  {
    name: "Pro Yearly",
    price: "$29.99",
    period: "/year",
    description: "Best value - Save 50%",
    features: [
      "All 500+ drug cards",
      "Interactive quizzes & SATA",
      "Printable study guides",
      "Progress tracking",
      "Priority support",
      "New drugs added monthly"
    ],
    priceId: "price_yearly"
  }
];

export default function Pricing() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubscribe = async (priceId: string) => {
    if (priceId === "free") {
      navigate("/drugs");
      return;
    }

    const currentUser = localStorage.getItem("pharma_current_user");
    if (!currentUser) {
      navigate("/login");
      return;
    }

    const user = JSON.parse(currentUser);
    setLoading(priceId);
    setError("");

    try {
      const res = await fetch(`${API_URL}/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, priceId })
      });

      const data = await res.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        setError(data.error);
      }
    } catch (e) {
      setError("Failed to start checkout. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen pt-24 bg-white">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Pill className="w-10 h-10 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Nursing Pharmacology</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Master pharmacology with interactive drug cards, NCLEX-style quizzes, and comprehensive study guides
          </p>
        </div>

        {error && (
          <div className="max-w-md mx-auto mb-8 p-4 bg-white border border-red-200 rounded-lg text-red-700 text-sm text-center">
            {error}
          </div>
        )}

        {/* Pricing Cards */}
        <div className="flex flex-wrap justify-center gap-6">
          {pricingTiers.map((tier) => (
            <div
              key={tier.name}
              className={`bg-white rounded-2xl shadow-lg p-6 w-64 relative flex flex-col ${
                tier.popular ? "ring-2 ring-blue-500 shadow-xl" : ""
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-white text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  {tier.name === "Free" ? (
                    <GraduationCap className="w-6 h-6 text-gray-600" />
                  ) : (
                    <Crown className="w-6 h-6 text-yellow-500" />
                  )}
                  <h3 className="text-xl font-bold text-gray-900">{tier.name}</h3>
                </div>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-gray-900">{tier.price}</span>
                  <span className="text-gray-500">{tier.period}</span>
                </div>
                <p className="text-gray-600 text-sm mt-2">{tier.description}</p>
              </div>

              <ul className="space-y-3 mb-8">
                {tier.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <Check className={`w-5 h-5 flex-shrink-0 ${tier.name === "Free" ? "text-gray-400" : "text-green-500"}`} />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(tier.priceId)}
                disabled={loading === tier.priceId}
                className={`w-full py-3 rounded-xl font-semibold transition-colors ${
                  tier.popular
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : tier.name === "Free"
                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                } ${loading === tier.priceId ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {loading === tier.priceId ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading...
                  </span>
                ) : tier.name === "Free" ? (
                  "Get Started Free"
                ) : (
                  "Subscribe Now"
                )}
              </button>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2">Can I cancel anytime?</h3>
              <p className="text-gray-600">Yes! You can cancel your subscription at any time from your account settings. You'll keep access until the end of your billing period.</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2">What's included in the free tier?</h3>
              <p className="text-gray-600">Free users get access to a selection of essential drug cards with basic quizzes. It's perfect for trying out the platform before upgrading.</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2">How often are new drugs added?</h3>
              <p className="text-gray-600">We add new drug cards weekly based on nursing curriculum and user requests. Premium subscribers get immediate access to all new content.</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2">Is this suitable for NCLEX prep?</h3>
              <p className="text-gray-600">Absolutely! Our quizzes include NCLEX-style questions, SATA (select all that apply), and detailed rationales - exactly what you need for exam success.</p>
            </div>
          </div>
        </div>

        {/* Back to Home */}
        <div className="mt-12 text-center">
          <Link to="/" className="text-blue-600 hover:text-blue-800 font-medium">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
