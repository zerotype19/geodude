import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { Card } from "../components/ui/Card";
import { Users, UserPlus, Mail, Calendar, UserCheck } from "lucide-react";
export default function SettingsMembers() {
    const [members, setMembers] = useState([]);
    const [invites, setInvites] = useState([]);
    const [newInvite, setNewInvite] = useState({ email: "", role: "member" });
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        loadMembers();
        loadInvites();
    }, []);
    const loadMembers = async () => {
        try {
            // TODO: Replace with actual API call
            const mockMembers = [
                {
                    id: "1",
                    email: "user@example.com",
                    role: "owner",
                    joined_at: "2024-01-01T00:00:00Z"
                }
            ];
            setMembers(mockMembers);
        }
        catch (error) {
            console.error("Error loading members:", error);
        }
    };
    const loadInvites = async () => {
        try {
            // TODO: Replace with actual API call
            const mockInvites = [];
            setInvites(mockInvites);
            setLoading(false);
        }
        catch (error) {
            console.error("Error loading invites:", error);
            setLoading(false);
        }
    };
    const handleSendInvite = async (e) => {
        e.preventDefault();
        if (!newInvite.email || !newInvite.role)
            return;
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
        }
        catch (error) {
            console.error("Error sending invite:", error);
        }
    };
    const handleResendInvite = async (inviteId) => {
        try {
            // TODO: Implement resend invite API call
            console.log("Resending invite:", inviteId);
        }
        catch (error) {
            console.error("Error resending invite:", error);
        }
    };
    const handleRevokeInvite = async (inviteId) => {
        try {
            // TODO: Implement revoke invite API call
            console.log("Revoking invite:", inviteId);
            setInvites(invites.filter(invite => invite.id !== inviteId));
        }
        catch (error) {
            console.error("Error revoking invite:", error);
        }
    };
    if (loading) {
        return (_jsx("div", { className: "flex justify-center items-center py-12", children: _jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" }) }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Team Members" }), _jsx("p", { className: "text-gray-600", children: "Manage your team members and send invitations" })] }), _jsxs(Card, { children: [_jsx("div", { className: "px-6 py-4 border-b border-gray-200", children: _jsxs("h2", { className: "text-lg font-medium text-gray-900 flex items-center", children: [_jsx(Users, { className: "h-5 w-5 mr-2" }), "Current Members (", members.length, ")"] }) }), _jsxs("div", { className: "divide-y divide-gray-200", children: [members.map((member) => (_jsxs("div", { className: "px-6 py-4 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center", children: _jsx(UserCheck, { className: "h-4 w-4 text-blue-600" }) }), _jsxs("div", { className: "ml-3", children: [_jsx("p", { className: "text-sm font-medium text-gray-900", children: member.email }), _jsx("p", { className: "text-sm text-gray-500 capitalize", children: member.role })] })] }), _jsxs("div", { className: "text-sm text-gray-500", children: ["Joined ", new Date(member.joined_at).toLocaleDateString()] })] }, member.id))), members.length === 0 && (_jsxs("div", { className: "px-6 py-8 text-center text-gray-500", children: [_jsx(Users, { className: "h-12 w-12 mx-auto text-gray-300 mb-3" }), _jsx("p", { children: "No team members yet" })] }))] })] }), _jsxs(Card, { children: [_jsx("div", { className: "px-6 py-4 border-b border-gray-200", children: _jsxs("h2", { className: "text-lg font-medium text-gray-900 flex items-center", children: [_jsx(UserPlus, { className: "h-5 w-5 mr-2" }), "Send Invitation"] }) }), _jsxs("form", { onSubmit: handleSendInvite, className: "px-6 py-4 space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "email", className: "block text-sm font-medium text-gray-700", children: "Email address" }), _jsx("input", { type: "email", id: "email", value: newInvite.email, onChange: (e) => setNewInvite({ ...newInvite, email: e.target.value }), className: "mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500", placeholder: "colleague@company.com", required: true })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "role", className: "block text-sm font-medium text-gray-700", children: "Role" }), _jsxs("select", { id: "role", value: newInvite.role, onChange: (e) => setNewInvite({ ...newInvite, role: e.target.value }), className: "mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500", children: [_jsx("option", { value: "member", children: "Member" }), _jsx("option", { value: "owner", children: "Owner" })] })] })] }), _jsxs("button", { type: "submit", className: "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500", children: [_jsx(Mail, { className: "h-4 w-4 mr-2" }), "Send Invitation"] })] })] }), _jsxs(Card, { children: [_jsx("div", { className: "px-6 py-4 border-b border-gray-200", children: _jsxs("h2", { className: "text-lg font-medium text-gray-900 flex items-center", children: [_jsx(Calendar, { className: "h-5 w-5 mr-2" }), "Pending Invitations (", invites.length, ")"] }) }), _jsxs("div", { className: "divide-y divide-gray-200", children: [invites.map((invite) => (_jsxs("div", { className: "px-6 py-4 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center", children: _jsx(Mail, { className: "h-4 w-4 text-yellow-600" }) }), _jsxs("div", { className: "ml-3", children: [_jsx("p", { className: "text-sm font-medium text-gray-900", children: invite.email }), _jsx("p", { className: "text-sm text-gray-500 capitalize", children: invite.role })] })] }), _jsxs("div", { className: "flex items-center space-x-3", children: [_jsxs("div", { className: "text-sm text-gray-500", children: ["Expires ", new Date(invite.expires_at).toLocaleDateString()] }), _jsx("button", { onClick: () => handleResendInvite(invite.id), className: "text-sm text-blue-600 hover:text-blue-800", children: "Resend" }), _jsx("button", { onClick: () => handleRevokeInvite(invite.id), className: "text-sm text-red-600 hover:text-red-800", children: "Revoke" })] })] }, invite.id))), invites.length === 0 && (_jsxs("div", { className: "px-6 py-8 text-center text-gray-500", children: [_jsx(Calendar, { className: "h-12 w-12 mx-auto text-gray-300 mb-3" }), _jsx("p", { children: "No pending invitations" })] }))] })] })] }));
}
