import { useState, useEffect } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";
import { useAuth } from "../contexts/AuthContext";

interface InteractionEvent {
  id: number;
  event_type: string;
  metadata: string;
  occurred_at: string;
  content_url: string;
  ai_source_name: string;
}

interface EventsSummary {
  total: number;
  breakdown: Array<{ traffic_class: string; count: number }>;
  top_sources: Array<{ name: string; count: number }>;
  timeseries: Array<{ day: number; count: number; traffic_class: string }>;
}

export default function Events() {
  const { project } = useAuth();
  const [events, setEvents] = useState<InteractionEvent[]>([]);
  const [summary, setSummary] = useState<EventsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [newEvent, setNewEvent] = useState({ 
    project_id: project?.id || "", 
    content_url: "", 
    ai_source_name: "", 
    event_type: "view", 
    metadata: "" 
  });

  useEffect(() => {
    if (project?.id) {
      setNewEvent(prev => ({ ...prev, project_id: project.id }));
      loadEvents();
      loadSummary();
    }
  }, [project]);

  async function loadEvents() {
    if (!project?.id) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/events?project_id=${project.id}`, FETCH_OPTS);
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      } else {
        console.error("Failed to load events:", response.status);
      }
    } catch (error) {
      console.error("Error loading events:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadSummary() {
    if (!project?.id) return;

    try {
      const response = await fetch(`${API_BASE}/api/events/summary?project_id=${project.id}`, FETCH_OPTS);
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      } else {
        console.error("Failed to load summary:", response.status);
      }
    } catch (error) {
      console.error("Error loading summary:", error);
    }
  }

  async function addEvent() {
    if (!project?.id || !newEvent.event_type) return;
    
    try {
      const eventData = { ...newEvent, project_id: project.id };
      const response = await fetch(`${API_BASE}/api/events`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventData)
      });
      
      if (response.ok) {
        setNewEvent({ project_id: project.id, content_url: "", ai_source_name: "", event_type: "view", metadata: "" });
        await loadEvents();
        await loadSummary();
      } else {
        console.error("Failed to add event");
      }
    } catch (error) {
      console.error("Error adding event:", error);
    }
  }

  function getTrafficClassColor(trafficClass: string): string {
    switch (trafficClass) {
      case "ai_agent_crawl": return "bg-purple-100 text-purple-800";
      case "human_via_ai": return "bg-blue-100 text-blue-800";
      case "direct_human": return "bg-green-100 text-green-800";
      case "unknown_ai_like": return "bg-orange-100 text-orange-800";
      default: return "bg-gray-100 text-gray-800";
    }
  }

  function getEventTypeColor(eventType: string): string {
    switch (eventType) {
      case "view": return "bg-blue-100 text-blue-800";
      case "click": return "bg-green-100 text-green-800";
      case "purchase": return "bg-purple-100 text-purple-800";
      case "signup": return "bg-orange-100 text-orange-800";
      case "download": return "bg-indigo-100 text-indigo-800";
      default: return "bg-gray-100 text-gray-800";
    }
  }

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-gray-600">Monitor AI traffic and user interactions</p>
        </div>

        {/* Get Started Banner - Show when no events */}
        {!loading && events.length === 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-blue-800">Get started with Optiview</h3>
                <p className="text-blue-700 mt-1">
                  Set up your first project and start tracking AI traffic to see insights here.
                </p>
              </div>
              <div className="ml-auto">
                <a
                  href="/onboarding"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Start onboarding
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Events Content */}
        {events.length > 0 && (
          <>
            {/* Summary Cards */}
            {summary && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <div className="px-4 py-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">Total Events</p>
                        <p className="text-2xl font-semibold text-gray-900">{summary.total}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Add New Event */}
            <Card title="Track Event">
              <form onSubmit={(e) => { e.preventDefault(); addEvent(); }} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Project ID
                    </label>
                    <input
                      type="text"
                      value={newEvent.project_id}
                      onChange={(e) => setNewEvent({ ...newEvent, project_id: e.target.value })}
                      placeholder="1"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Event Type
                    </label>
                    <select
                      value={newEvent.event_type}
                      onChange={(e) => setNewEvent({ ...newEvent, event_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="view">View</option>
                      <option value="click">Click</option>
                      <option value="purchase">Purchase</option>
                      <option value="signup">Sign Up</option>
                      <option value="download">Download</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Content URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={newEvent.content_url}
                      onChange={(e) => setNewEvent({ ...newEvent, content_url: e.target.value })}
                      placeholder="https://example.com/page"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      AI Source (Optional)
                    </label>
                    <input
                      type="text"
                      value={newEvent.ai_source_name}
                      onChange={(e) => setNewEvent({ ...newEvent, ai_source_name: e.target.value })}
                      placeholder="ChatGPT, Claude, Gemini..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Metadata (Optional)
                  </label>
                  <textarea
                    value={newEvent.metadata}
                    onChange={(e) => setNewEvent({ ...newEvent, metadata: e.target.value })}
                    placeholder="JSON metadata or additional context"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newEvent.project_id || !newEvent.event_type}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Track Event
                </button>
              </form>
            </Card>

            {/* Events List */}
            <Card title="Recent Events">
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading events...</div>
              ) : events.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No events found. Track your first event above.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b">
                        <th className="py-3 pr-4">Event</th>
                        <th className="py-3 pr-4">Traffic Class</th>
                        <th className="py-3 pr-4">Content</th>
                        <th className="py-3 pr-4">AI Source</th>
                        <th className="py-3 pr-4">Metadata</th>
                        <th className="py-3 pr-4">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((event) => (
                        <tr key={event.id} className="border-b">
                          <td className="py-3 pr-4">
                            <span className={`px-2 py-1 text-xs rounded-full ${getEventTypeColor(event.event_type)}`}>
                              {event.event_type}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            {event.metadata && typeof event.metadata === "string" ? (
                              (() => {
                                try {
                                  const meta = JSON.parse(event.metadata);
                                  return (
                                    <span className={`px-2 py-1 text-xs rounded-full ${getTrafficClassColor(meta.class || "unknown")}`}>
                                      {meta.class || "unknown"}
                                    </span>
                                  );
                                } catch {
                                  return <span className="text-gray-400">—</span>;
                                }
                              })()
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-3 pr-4">
                            {event.content_url ? (
                              <a
                                href={event.content_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline truncate block max-w-xs"
                              >
                                {event.content_url}
                              </a>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-3 pr-4">
                            {event.ai_source_name || <span className="text-gray-400">—</span>}
                          </td>
                          <td className="py-3 pr-4 text-xs text-gray-600 font-mono max-w-xs truncate">
                            {event.metadata || "—"}
                          </td>
                          <td className="py-3 pr-4 text-gray-600">
                            {new Date(event.occurred_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </Shell>
  );
}
