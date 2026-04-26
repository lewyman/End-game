import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function OAuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.hash.slice(1));
    const accessToken = params.get("access_token");
    const errorParam = params.get("error");

    if (errorParam) {
      setError(errorParam);
      setTimeout(() => navigate("/login"), 3000);
      return;
    }

    if (accessToken) {
      // Decode JWT to get email
      try {
        const payload = JSON.parse(atob(accessToken.split(".")[1]));
        const email = payload.email;

        // Store in localStorage
        localStorage.setItem("pharma_current_user", JSON.stringify({
          email: email,
          tier: "free",
          isAdmin: false,
          subscription_tier: "free"
        }));

        navigate("/");
      } catch (e) {
        setError("Failed to parse token");
        setTimeout(() => navigate("/login"), 3000);
      }
    } else {
      setError("No access token received");
      setTimeout(() => navigate("/login"), 3000);
    }
  }, [location, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-red-600 mb-4">OAuth Error: {error}</p>
            <p className="text-gray-500">Redirecting to login...</p>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Completing Google login...</p>
          </>
        )}
      </div>
    </div>
  );
}