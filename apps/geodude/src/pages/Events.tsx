import { useState, useEffect } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";

interface InteractionEvent {
  id: number;
  event_type: string;
  metadata: string;
  occurred_at: string;
  content_url: string;
  ai_source_name: string;
}

export default function Events() {
  const [events, setEvents] = useState<InteractionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEvent, setNewEvent] = useState({ 
    project_id: "", 
    content_url: "", 
    ai_source_name: "", 
    event_type: "view", 
    metadata: "" 
  });

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    setLoading(true);
    try {
      // For now, using a placeholder project_id - in real app this would come from context
      const response = await fetch(`${API_BASE}/api/events?project_id=1`, FETCH_OPTS);
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

  async function addEvent() {
    if (!newEvent.project_id || !newEvent.event_type) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/events`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEvent)
      });
      
      if (response.ok) {
        setNewEvent({ project_id: "", content_url: "", ai_source_name: "", event_type: "view", metadata: "" });
        await loadEvents();
      } else {
        console.error("Failed to add event");
      }
    } catch (error) {
      console.error("Error adding event:", error);
    }
  }

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Interaction Events</h1>
          <p className="text-slate-600 mt-2">Track user interactions and AI-driven engagement with your content</p>
        </div>

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
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          event.event_type === 'view' ? 'bg-blue-100 text-blue-800' :
                          event.event_type === 'click' ? 'bg-green-100 text-green-800' :
                          event.event_type === 'purchase' ? 'bg-purple-100 text-purple-800' :
                          event.event_type === 'signup' ? 'bg-orange-100 text-orange-800' :
                          event.event_type === 'download' ? 'bg-indigo-100 text-indigo-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {event.event_type}
                        </span>
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
      </div>
    </Shell>
  );
}
