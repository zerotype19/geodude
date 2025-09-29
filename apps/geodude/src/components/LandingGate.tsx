import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function LandingGate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, project, loading } = useAuth();

  // Add cache-busting timestamp to prevent 308 redirect caching
  const timestamp = Date.now();
  console.log(`🎯 LandingGate: Component mounted - SIMPLIFIED ROUTING [${timestamp}]`);

  useEffect(() => {
    let cancelled = false;

    async function handleRouting() {
      // Only handle routing if we're actually on the root path
      if (location.pathname !== '/') {
        console.log(`🎯 LandingGate: Not on root path (${location.pathname}), skipping redirect logic`);
        return;
      }

      // Wait for auth to load
      if (loading) {
        console.log(`🎯 LandingGate: Still loading auth...`);
        return;
      }

      // If not authenticated, go to login
      if (!user) {
        if (!cancelled) {
          console.log(`🔐 LandingGate: Redirecting to /login [${timestamp}]`);
          navigate("/login", { replace: true });
        }
        return;
      }

      // If no project yet, go to events (safer fallback)
      if (!project?.id) {
        if (!cancelled) {
          console.log(`📁 LandingGate: No project, redirecting to /events [${timestamp}]`);
          navigate("/events", { replace: true });
        }
        return;
      }

      // Always go to events page - no more auto-redirects to /install
      if (!cancelled) {
        console.log(`✅ LandingGate: Redirecting to /events (no auto-install redirects) [${timestamp}]`);
        // Use replace: true to prevent back button issues and clear any cached redirects
        navigate("/events", { replace: true });
      }
    }

    handleRouting();

    return () => {
      cancelled = true;
    };
  }, [user, project?.id, loading, navigate, timestamp, location.pathname]);

  // Show loading spinner while determining redirect
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading...</p>
        {/* Add cache-busting info */}
        <p className="mt-1 text-xs text-gray-400">Cache: {timestamp}</p>
      </div>
    </div>
  );
}
