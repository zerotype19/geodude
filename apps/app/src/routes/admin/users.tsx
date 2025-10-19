import { useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  created_at: string;
  last_login_at?: string;
  audit_count: number;
  active_sessions: number;
}

interface AuthStats {
  today: Record<string, number>;
  last7Days: Record<string, number>;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<AuthStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [usersRes, statsRes] = await Promise.all([
        fetch('https://api.optiview.ai/v1/auth/users', { credentials: 'include' }),
        fetch('https://api.optiview.ai/v1/auth/stats', { credentials: 'include' }),
      ]);

      if (!usersRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const usersData = await usersRes.json();
      const statsData = await statsRes.json();

      setUsers(usersData.users || []);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <a href="/admin" className="text-blue-600 hover:underline">← Admin</a>
            <h1 className="text-3xl font-bold text-gray-900">Users & Auth Stats</h1>
          </div>
          <p className="text-gray-600">User management and authentication telemetry</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 text-red-800 rounded-lg">
            {error}
          </div>
        )}

        {/* Auth Stats */}
        {stats && (
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Today's Activity</h2>
              <div className="space-y-2">
                <StatRow label="Magic Links Sent" value={stats.today.magic_request_sent || 0} />
                <StatRow label="Successful Verifications" value={stats.today.magic_verify_success || 0} />
                <StatRow label="Failed Verifications" value={stats.today.magic_verify_fail || 0} />
                <StatRow label="Session Refreshes" value={stats.today.session_refresh || 0} />
                <StatRow label="Logouts" value={stats.today.session_deleted || 0} />
                <StatRow label="Rate Limits Hit" value={stats.today.rate_limit_hit || 0} color="text-red-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Last 7 Days</h2>
              <div className="space-y-2">
                <StatRow label="Magic Links Sent" value={stats.last7Days.magic_request_sent || 0} />
                <StatRow label="Successful Verifications" value={stats.last7Days.magic_verify_success || 0} />
                <StatRow label="Failed Verifications" value={stats.last7Days.magic_verify_fail || 0} />
                <StatRow label="Session Refreshes" value={stats.last7Days.session_refresh || 0} />
                <StatRow label="Logouts" value={stats.last7Days.session_deleted || 0} />
                <StatRow label="Rate Limits Hit" value={stats.last7Days.rate_limit_hit || 0} color="text-red-600" />
              </div>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Registered Users ({users.length})</h2>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
            >
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Audits
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Active Sessions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{user.email}</div>
                      <div className="text-xs text-gray-500">{user.id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatTimeAgo(user.created_at)}</div>
                      <div className="text-xs text-gray-500">{formatDate(user.created_at)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatTimeAgo(user.last_login_at)}</div>
                      {user.last_login_at && (
                        <div className="text-xs text-gray-500">{formatDate(user.last_login_at)}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {user.audit_count}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.active_sessions > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.active_sessions}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length === 0 && (
            <div className="px-6 py-12 text-center text-gray-500">
              No users registered yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, color = 'text-gray-900' }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-semibold ${color}`}>{value.toLocaleString()}</span>
    </div>
  );
}

