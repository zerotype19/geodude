import { useState } from "react";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";
import { useAuth } from "../contexts/AuthContext";

export default function Settings() {
  const { user, organization, project } = useAuth();
  const [activeTab, setActiveTab] = useState("general");
  const [traceHeaderEnabled, setTraceHeaderEnabled] = useState(false);

  const tabs = [
    { id: "general", label: "General" },
    { id: "notifications", label: "Notifications" },
    { id: "integrations", label: "Integrations" },
    { id: "billing", label: "Billing" },
    { id: "debug", label: "Debug & Support" }
  ];

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-600 mt-2">
            Configure your {organization?.name || 'Optiview'} account and preferences
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === "general" && (
          <div className="space-y-6">
            <Card title="Account Information">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    defaultValue={organization?.name || 'Loading...'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled
                  />
                  <p className="text-xs text-gray-500 mt-1">Organization name cannot be changed here</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Project Name
                  </label>
                  <input
                    type="text"
                    defaultValue={project?.name || 'Loading...'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled
                  />
                  <p className="text-xs text-gray-500 mt-1">Project name cannot be changed here</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    User Email
                  </label>
                  <input
                    type="email"
                    defaultValue={user?.email || 'Loading...'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled
                  />
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed here</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Time Zone
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    <option>UTC</option>
                    <option>America/New_York</option>
                    <option>America/Los_Angeles</option>
                    <option>Europe/London</option>
                    <option>Asia/Tokyo</option>
                  </select>
                </div>
              </div>
            </Card>

            <Card title="Data Retention">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Event Data Retention
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    <option>90 days</option>
                    <option>180 days</option>
                    <option>1 year</option>
                    <option>Indefinite</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    AI Source Data Retention
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    <option>1 year</option>
                    <option>2 years</option>
                    <option>Indefinite</option>
                  </select>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === "notifications" && (
          <div className="space-y-6">
            <Card title="Email Notifications">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-700">Weekly AI Traffic Report</div>
                    <div className="text-sm text-slate-500">Get a summary of AI-driven traffic to your properties</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-700">AI Source Alerts</div>
                    <div className="text-sm text-slate-500">Get notified when new AI sources are detected</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-700">Traffic Anomaly Alerts</div>
                    <div className="text-sm text-slate-500">Get notified of unusual traffic patterns</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === "integrations" && (
          <div className="space-y-6">
            <Card title="Webhook Integrations">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Webhook URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://your-app.com/webhook"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-700">Send AI Traffic Events</div>
                    <div className="text-sm text-slate-500">Forward AI traffic events to your webhook</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </Card>

            <Card title="API Access">
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <div className="text-sm text-blue-800">
                    <strong>API Base URL:</strong> https://app.optiview.io/api
                  </div>
                  <div className="text-xs text-blue-700 mt-2">
                    Use your API keys to send events and retrieve data programmatically.
                  </div>
                </div>
                <div>
                  <a
                    href="/install"
                    className="text-blue-600 hover:text-blue-800 underline text-sm"
                  >
                    Manage API Keys →
                  </a>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === "billing" && (
          <div className="space-y-6">
            <Card title="Current Plan">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-md">
                  <div>
                    <div className="font-medium text-green-800">Starter Plan</div>
                    <div className="text-sm text-green-700">$29/month</div>
                  </div>
                  <span className="px-3 py-1 text-xs bg-green-100 text-green-800 rounded-full">Active</span>
                </div>
                <div className="text-sm text-slate-600">
                  <strong>Features:</strong> Up to 100K events/month, 5 properties, basic AI classification
                </div>
              </div>
            </Card>

            <Card title="Usage">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Events this month</span>
                  <span className="text-sm font-medium">23,456 / 100,000</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '23%' }}></div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Properties</span>
                  <span className="text-sm font-medium">3 / 5</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === "debug" && (
          <div className="space-y-6">
            <Card title="Debug & Support">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-700">Trace Headers</div>
                    <div className="text-sm text-slate-500">Add x-optiview-trace header to responses for debugging</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={traceHeaderEnabled}
                      onChange={(e) => setTraceHeaderEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-700">Verbose Logging</div>
                    <div className="text-sm text-slate-500">Enable detailed logging for troubleshooting</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </Card>

            <Card title="System Health">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
                  <span className="text-sm font-medium text-green-800">Database</span>
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Connected</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
                  <span className="text-sm font-medium text-green-800">KV Storage</span>
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Connected</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
                  <span className="text-sm font-medium text-green-800">AI Classification</span>
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Active</span>
                </div>
              </div>
              <div className="mt-4">
                <a
                  href="/admin/health"
                  target="_blank"
                  className="text-blue-600 hover:text-blue-800 underline text-sm"
                >
                  View Detailed Health Check →
                </a>
              </div>
            </Card>

            <Card title="Support">
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <div className="text-sm text-yellow-800">
                    <strong>Need help?</strong> Contact our support team or check our documentation.
                  </div>
                </div>
                <div className="flex gap-4">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                    Contact Support
                  </button>
                  <button className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2">
                    View Docs
                  </button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </Shell>
  );
}
