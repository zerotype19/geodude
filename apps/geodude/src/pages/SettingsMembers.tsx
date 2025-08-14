import { useState, useEffect } from "react";
import { Card } from "../components/ui/Card";
import { Users, UserPlus, Mail, Calendar, UserCheck, UserX } from "lucide-react";

interface Member {
  id: string;
  email: string;
  role: "owner" | "member";
  joined_at: string;
}

interface Invite {
  id: string;
  email: string;
  role: "owner" | "member";
  invited_at: string;
  expires_at: string;
}

export default function SettingsMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [newInvite, setNewInvite] = useState({ email: "", role: "member" as const });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMembers();
    loadInvites();
  }, []);

  const loadMembers = async () => {
    try {
      // TODO: Replace with actual API call
      const mockMembers: Member[] = [
        {
          id: "1",
          email: "user@example.com",
          role: "owner",
          joined_at: "2024-01-01T00:00:00Z"
        }
      ];
      setMembers(mockMembers);
    } catch (error) {
      console.error("Error loading members:", error);
    }
  };

  const loadInvites = async () => {
    try {
      // TODO: Replace with actual API call
      const mockInvites: Invite[] = [];
      setInvites(mockInvites);
      setLoading(false);
    } catch (error) {
      console.error("Error loading invites:", error);
      setLoading(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvite.email || !newInvite.role) return;

    try {
      // TODO: Replace with actual API call
      const response = await fetch("/onboarding/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newInvite.email,
          role: newInvite.role,
          org_id: 1 // TODO: Get from context
        })
      });

      if (response.ok) {
        setNewInvite({ email: "", role: "member" });
        loadInvites(); // Refresh invites list
      }
    } catch (error) {
      console.error("Error sending invite:", error);
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    try {
      // TODO: Implement resend invite API call
      console.log("Resending invite:", inviteId);
    } catch (error) {
      console.error("Error resending invite:", error);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      // TODO: Implement revoke invite API call
      console.log("Revoking invite:", inviteId);
      setInvites(invites.filter(invite => invite.id !== inviteId));
    } catch (error) {
      console.error("Error revoking invite:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
        <p className="text-gray-600">Manage your team members and send invitations</p>
      </div>

      {/* Current Members */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900 flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Current Members ({members.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-200">
          {members.map((member) => (
            <div key={member.id} className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <UserCheck className="h-4 w-4 text-blue-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">{member.email}</p>
                  <p className="text-sm text-gray-500 capitalize">{member.role}</p>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                Joined {new Date(member.joined_at).toLocaleDateString()}
              </div>
            </div>
          ))}
          {members.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-500">
              <Users className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p>No team members yet</p>
            </div>
          )}
        </div>
      </Card>

      {/* Send Invite */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900 flex items-center">
            <UserPlus className="h-5 w-5 mr-2" />
            Send Invitation
          </h2>
        </div>
        <form onSubmit={handleSendInvite} className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                type="email"
                id="email"
                value={newInvite.email}
                onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="colleague@company.com"
                required
              />
            </div>
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <select
                id="role"
                value={newInvite.role}
                onChange={(e) => setNewInvite({ ...newInvite, role: e.target.value as "owner" | "member" })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="member">Member</option>
                <option value="owner">Owner</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Mail className="h-4 w-4 mr-2" />
            Send Invitation
          </button>
        </form>
      </Card>

      {/* Pending Invites */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900 flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Pending Invitations ({invites.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-200">
          {invites.map((invite) => (
            <div key={invite.id} className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Mail className="h-4 w-4 text-yellow-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">{invite.email}</p>
                  <p className="text-sm text-gray-500 capitalize">{invite.role}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="text-sm text-gray-500">
                  Expires {new Date(invite.expires_at).toLocaleDateString()}
                </div>
                <button
                  onClick={() => handleResendInvite(invite.id)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Resend
                </button>
                <button
                  onClick={() => handleRevokeInvite(invite.id)}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Revoke
                </button>
              </div>
            </div>
          ))}
          {invites.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-500">
              <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p>No pending invitations</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
