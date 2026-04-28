import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, getCurrentUser } from "../lib/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    async function handleCallback() {
      try {
        // Get the current session after OAuth redirect
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Auth callback error:", error);
          navigate("/login?error=auth_failed");
          return;
        }

        if (session?.user) {
          // Fetch user with tier from our backend
          const user = await getCurrentUser();

          if (user) {
            localStorage.setItem("pharma_current_user", JSON.stringify({
              email: user.email,
              tier: user.tier,
              isAdmin: user.isAdmin,
              subscription_tier: user.subscription_tier,
            }));
            navigate("/drugs");
          } else {
            navigate("/login?error=user_not_found");
          }
        } else {
          navigate("/login?error=no_session");
        }
      } catch (e) {
        console.error("Callback processing error:", e);
        navigate("/login?error=callback_error");
      }
    }

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}