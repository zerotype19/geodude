import { useAuth } from "../useAuth";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";

export default function Settings() {
  const { me } = useAuth();

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-600 mt-2">Manage your account and preferences</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card title="Account Information">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={me?.user?.email || ""}
                  readOnly
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-600"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  User ID
                </label>
                <input
                  type="text"
                  value={me?.user?.id || ""}
                  readOnly
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-600 font-mono text-sm"
                />
              </div>
            </div>
          </Card>

          <Card title="Current Organization">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={me?.current?.org_name || ""}
                  readOnly
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-600"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Organization ID
                </label>
                <input
                  type="text"
                  value={me?.current?.org_id || ""}
                  readOnly
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-600 font-mono text-sm"
                />
              </div>
            </div>
          </Card>

          <Card title="Current Project">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  value={me?.current?.project_name || ""}
                  readOnly
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-600"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Project ID
                </label>
                <input
                  type="text"
                  value={me?.current?.project_id || ""}
                  readOnly
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-600 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Project Domain
                </label>
                <input
                  type="text"
                  value={me?.current?.project_domain || ""}
                  readOnly
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-600"
                />
              </div>
            </div>
          </Card>

          <Card title="API Configuration">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  API Base URL
                </label>
                <input
                  type="text"
                  value={import.meta.env.VITE_API_BASE || "https://api.optiview.ai"}
                  readOnly
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-600 font-mono text-sm"
                />
              </div>
              
              <div className="text-sm text-slate-600">
                <p>Your API endpoints are scoped to your current organization and project.</p>
                <p className="mt-2">Use the navigation bar above to switch between different organizations and projects.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
