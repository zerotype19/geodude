import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function LandingGate() {
  const navigate = useNavigate();
  const { user, project, loading } = useAuth();

  console.log("🎯 LandingGate: Component mounted - SIMPLIFIED ROUTING");

  useEffect(() => {
    let cancelled = false;

    async function handleRouting() {
      // Wait for auth to load
      if (loading) return;

      // If not authenticated, go to login
      if (!user) {
        if (!cancelled) navigate("/login", { replace: true });
        return;
      }

      // If no project yet, go to events (safer fallback)
      if (!project?.id) {
        if (!cancelled) navigate("/events", { replace: true });
        return;
      }

      // Always go to events page - no more auto-redirects to /install
      if (!cancelled) {
        console.log("✅ LandingGate: Redirecting to /events (no auto-install redirects)");
        navigate("/events", { replace: true });
      }
    }

    handleRouting();

    return () => {
      cancelled = true;
    };
  }, [user, project?.id, loading, navigate]);

  // Show loading spinner while determining redirect
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
