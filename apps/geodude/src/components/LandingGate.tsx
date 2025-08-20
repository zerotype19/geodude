import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { API_BASE, FETCH_OPTS } from "../config";

export default function LandingGate() {
  const navigate = useNavigate();
  const { user, project, loading } = useAuth();

  console.log("🎯 LandingGate: Component mounted - NEW ROUTING ACTIVE");

  useEffect(() => {
    let cancelled = false;

    async function checkActivityAndRedirect() {
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

      try {
        console.log("🔍 LandingGate: Checking for activity data...");

        // Check for any activity: events, referrals, or conversions
        const [eventsResponse, referralsResponse, conversionsResponse] = await Promise.allSettled([
          fetch(`${API_BASE}/api/events?project_id=${project.id}&page=1&pageSize=1`, FETCH_OPTS),
          fetch(`${API_BASE}/api/referrals?project_id=${project.id}&page=1&pageSize=1`, FETCH_OPTS),
          fetch(`${API_BASE}/api/conversions?project_id=${project.id}&page=1&pageSize=1`, FETCH_OPTS)
        ]);

        let hasAnyActivity = false;
        let apiCheckSuccessful = false;

        // Check if any endpoint returned data
        for (const response of [eventsResponse, referralsResponse, conversionsResponse]) {
          if (response.status === 'fulfilled' && response.value.ok) {
            apiCheckSuccessful = true;
            const data = await response.value.json();
            if (data.total > 0 || (data.items && data.items.length > 0)) {
              hasAnyActivity = true;
              break;
            }
          }
        }

        if (!cancelled) {
          if (hasAnyActivity) {
            console.log("✅ LandingGate: Found activity data - redirecting to /events");
            navigate("/events", { replace: true });
          } else if (apiCheckSuccessful && !hasAnyActivity) {
            // Only redirect to install if we're absolutely certain there's no data
            console.log("📋 LandingGate: Confirmed no activity data - redirecting to /install");
            navigate(`/install?project_id=${project.id}`, { replace: true });
          } else {
            // If API check failed or was inconclusive, default to events page (more user-friendly)
            console.log("🔄 LandingGate: API check inconclusive - defaulting to /events");
            navigate("/events", { replace: true });
          }
        }
      } catch (error) {
        console.error("❌ LandingGate: Failed to check activity:", error);
        // On error, NEVER force install. Fall back to /events (safer for users with data)
        if (!cancelled) {
          console.log("🔄 LandingGate: Error occurred - falling back to /events");
          navigate("/events", { replace: true });
        }
      }
    }

    checkActivityAndRedirect();

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
