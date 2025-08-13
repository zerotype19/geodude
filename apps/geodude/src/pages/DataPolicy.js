import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";
import { Shield, Database, Clock, AlertTriangle, Edit3, Save, X } from "lucide-react";
export default function DataPolicy() {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState({ events: 0, referrals: 0 });
    const [purgeModal, setPurgeModal] = useState(null);
    const [purgeResult, setPurgeResult] = useState(null);
    const [purging, setPurging] = useState(false);
    useEffect(() => {
        loadSettings();
    }, []);
    async function loadSettings() {
        try {
            setLoading(true);
            setError(null);
            // For now, we'll use a placeholder project ID
            // In a real app, this would come from the user's session
            const projectId = 1;
            const response = await fetch(`${API_BASE}/api/projects/${projectId}/settings`, FETCH_OPTS);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            setSettings(data);
            setEditForm({
                events: data.retention_days_events,
                referrals: data.retention_days_referrals
            });
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load settings");
        }
        finally {
            setLoading(false);
        }
    }
    async function handleSave() {
        if (!settings)
            return;
        try {
            const response = await fetch(`${API_BASE}/api/projects/${settings.project_id}/settings`, {
                ...FETCH_OPTS,
                method: 'PUT',
                body: JSON.stringify({
                    retention_days_events: editForm.events,
                    retention_days_referrals: editForm.referrals
                })
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            // Reload settings
            await loadSettings();
            setEditing(false);
        }
        catch (err) {
            console.error("Failed to save settings:", err);
            // Could show error toast here
        }
    }
    async function handlePurge() {
        if (!settings || !purgeModal)
            return;
        try {
            setPurging(true);
            const response = await fetch(`${API_BASE}/admin/purge`, {
                ...FETCH_OPTS,
                method: 'POST',
                body: JSON.stringify({
                    project_id: settings.project_id,
                    type: purgeModal.type,
                    confirm: "DELETE",
                    dry_run: purgeModal.dryRun
                })
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const result = await response.json();
            setPurgeResult(result);
            if (!purgeModal.dryRun) {
                // Reload settings after actual purge
                await loadSettings();
            }
        }
        catch (err) {
            console.error("Purge failed:", err);
            // Could show error toast here
        }
        finally {
            setPurging(false);
        }
    }
    function getPlanTierInfo(tier) {
        switch (tier) {
            case 'free':
                return { name: 'Free', color: 'text-gray-600', bgColor: 'bg-gray-100' };
            case 'pro':
                return { name: 'Pro', color: 'text-blue-600', bgColor: 'bg-blue-100' };
            case 'enterprise':
                return { name: 'Enterprise', color: 'text-purple-600', bgColor: 'bg-purple-100' };
            default:
                return { name: tier, color: 'text-gray-600', bgColor: 'bg-gray-100' };
        }
    }
    function getDefaultRetention(tier) {
        switch (tier) {
            case 'free':
                return { events: 180, referrals: 365 };
            case 'pro':
                return { events: 365, referrals: 730 };
            case 'enterprise':
                return { events: 730, referrals: 1460 };
            default:
                return { events: 180, referrals: 365 };
        }
    }
    function canEditRetention(tier) {
        return tier === 'enterprise';
    }
    function validateRetention(events, referrals) {
        const errors = [];
        if (events < 7 || events > 3650) {
            errors.push("Events retention must be between 7 and 3650 days");
        }
        if (referrals < 30 || referrals > 3650) {
            errors.push("Referrals retention must be between 30 and 3650 days");
        }
        return errors;
    }
    if (loading) {
        return (_jsx(Shell, { children: _jsx("div", { className: "flex items-center justify-center min-h-64", children: _jsx("div", { className: "text-lg", children: "Loading data policy..." }) }) }));
    }
    if (error) {
        return (_jsx(Shell, { children: _jsx("div", { className: "flex items-center justify-center min-h-64", children: _jsx("div", { className: "text-red-600 text-lg", children: error }) }) }));
    }
    if (!settings) {
        return (_jsx(Shell, { children: _jsx("div", { className: "flex items-center justify-center min-h-64", children: _jsx("div", { className: "text-lg", children: "No project settings found" }) }) }));
    }
    const planInfo = getPlanTierInfo(settings.plan_tier);
    const defaultRetention = getDefaultRetention(settings.plan_tier);
    const canEdit = canEditRetention(settings.plan_tier);
    const validationErrors = validateRetention(editForm.events, editForm.referrals);
    return (_jsx(Shell, { children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8", children: [_jsxs("div", { className: "mb-8", children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900", children: "Data Policy" }), _jsx("p", { className: "mt-2 text-gray-600", children: "Manage your data retention policies and storage settings" })] }), _jsx("div", { className: "mb-6", children: _jsx(Card, { title: "Current Plan", children: _jsx("div", { className: "p-6", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: `p-2 rounded-lg ${planInfo.bgColor}`, children: _jsx(Shield, { className: `h-6 w-6 ${planInfo.color}` }) }), _jsxs("div", { children: [_jsxs("h3", { className: "text-lg font-medium text-gray-900", children: [planInfo.name, " Plan"] }), _jsx("p", { className: "text-sm text-gray-500", children: canEdit ? "Customizable retention policies" : "Standard retention policies" })] })] }), canEdit && (_jsxs("button", { onClick: () => setEditing(!editing), className: "flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors", children: [editing ? _jsx(X, { size: 16 }) : _jsx(Edit3, { size: 16 }), _jsx("span", { children: editing ? "Cancel" : "Edit" })] }))] }) }) }) }), _jsx("div", { className: "mb-6", children: _jsx(Card, { title: "Data Retention Policies", children: _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center space-x-2 mb-3", children: [_jsx(Database, { className: "h-5 w-5 text-blue-600" }), _jsx("h4", { className: "text-lg font-medium text-gray-900", children: "Interaction Events" })] }), editing && canEdit ? (_jsxs("div", { children: [_jsx("input", { type: "number", min: "7", max: "3650", value: editForm.events, onChange: (e) => setEditForm(prev => ({ ...prev, events: parseInt(e.target.value) || 0 })), className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" }), _jsx("p", { className: "text-sm text-gray-500 mt-1", children: "Days to retain event data (7-3650)" })] })) : (_jsxs("div", { children: [_jsxs("div", { className: "text-2xl font-bold text-gray-900", children: [settings.retention_days_events, " days"] }), _jsx("p", { className: "text-sm text-gray-500", children: settings.retention_days_events === defaultRetention.events
                                                                ? "Default for your plan"
                                                                : "Custom setting" })] }))] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center space-x-2 mb-3", children: [_jsx(Clock, { className: "h-5 w-5 text-green-600" }), _jsx("h4", { className: "text-lg font-medium text-gray-900", children: "AI Referrals" })] }), editing && canEdit ? (_jsxs("div", { children: [_jsx("input", { type: "number", min: "30", max: "3650", value: editForm.referrals, onChange: (e) => setEditForm(prev => ({ ...prev, referrals: parseInt(e.target.value) || 0 })), className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" }), _jsx("p", { className: "text-sm text-gray-500 mt-1", children: "Days to retain referral data (30-3650)" })] })) : (_jsxs("div", { children: [_jsxs("div", { className: "text-2xl font-bold text-gray-900", children: [settings.retention_days_referrals, " days"] }), _jsx("p", { className: "text-sm text-gray-500", children: settings.retention_days_referrals === defaultRetention.referrals
                                                                ? "Default for your plan"
                                                                : "Custom setting" })] }))] })] }), editing && validationErrors.length > 0 && (_jsx("div", { className: "mt-4 p-4 bg-red-50 border border-red-200 rounded-md", children: _jsxs("div", { className: "flex items-start", children: [_jsx(AlertTriangle, { className: "text-red-600 mt-0.5 mr-2 flex-shrink-0", size: 16 }), _jsxs("div", { className: "text-sm text-red-800", children: [_jsx("p", { className: "font-medium mb-1", children: "Please fix the following errors:" }), _jsx("ul", { className: "list-disc list-inside space-y-1", children: validationErrors.map((error, index) => (_jsx("li", { children: error }, index))) })] })] }) })), editing && canEdit && (_jsx("div", { className: "mt-6 flex justify-end", children: _jsxs("button", { onClick: handleSave, disabled: validationErrors.length > 0, className: "px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors", children: [_jsx(Save, { size: 16, className: "inline mr-2" }), "Save Changes"] }) }))] }) }) }), _jsx("div", { className: "mb-6", children: _jsx(Card, { title: "Data Management", children: _jsxs("div", { className: "p-6", children: [_jsx("div", { className: "bg-blue-50 border border-blue-200 rounded-md p-4 mb-6", children: _jsxs("div", { className: "flex items-start", children: [_jsx(AlertTriangle, { className: "text-blue-600 mt-0.5 mr-2 flex-shrink-0", size: 16 }), _jsxs("div", { className: "text-sm text-blue-800", children: [_jsx("p", { className: "font-medium mb-1", children: "About Data Retention" }), _jsx("p", { children: "Retention applies to raw event rows. Aggregated metrics are recomputed on the fly and are not affected by retention policies. Data is automatically purged daily at 03:10 UTC." })] })] }) }), _jsxs("div", { className: "space-y-4", children: [_jsx("h4", { className: "text-lg font-medium text-gray-900", children: "Manual Data Purge" }), _jsx("p", { className: "text-sm text-gray-600", children: "Use these options to manually purge data or preview what would be deleted." }), _jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsx("button", { onClick: () => setPurgeModal({ isOpen: true, type: "events", dryRun: true }), className: "px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors", children: "Preview Events Purge" }), _jsx("button", { onClick: () => setPurgeModal({ isOpen: true, type: "referrals", dryRun: true }), className: "px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors", children: "Preview Referrals Purge" }), _jsx("button", { onClick: () => setPurgeModal({ isOpen: true, type: "both", dryRun: true }), className: "px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors", children: "Preview All Purge" })] })] })] }) }) }), purgeModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsx("div", { className: "bg-white rounded-lg shadow-xl max-w-md w-full mx-4", children: _jsxs("div", { className: "p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: purgeModal.dryRun ? "Preview Data Purge" : "Confirm Data Purge" }), _jsx("p", { className: "text-sm text-gray-600 mb-6", children: purgeModal.dryRun
                                        ? `This will show you how many ${purgeModal.type === "both" ? "events and referrals" : purgeModal.type} would be deleted based on your current retention policy.`
                                        : `This will permanently delete ${purgeModal.type === "both" ? "all expired events and referrals" : `expired ${purgeModal.type}`} based on your retention policy. This action cannot be undone.` }), purgeResult && (_jsxs("div", { className: "mb-6 p-4 bg-gray-50 border border-gray-200 rounded-md", children: [_jsx("h4", { className: "font-medium text-gray-900 mb-2", children: "Purge Results:" }), _jsxs("div", { className: "text-sm text-gray-600 space-y-1", children: [_jsxs("p", { children: ["Events to be deleted: ", purgeResult.deleted_events] }), _jsxs("p", { children: ["Referrals to be deleted: ", purgeResult.deleted_referrals] }), _jsx("p", { className: "font-medium", children: purgeResult.message })] })] })), _jsxs("div", { className: "flex space-x-3", children: [_jsx("button", { onClick: () => {
                                                setPurgeModal(null);
                                                setPurgeResult(null);
                                            }, className: "flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors", children: "Cancel" }), !purgeResult && (_jsx("button", { onClick: handlePurge, disabled: purging, className: "flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors", children: purging ? "Processing..." : purgeModal.dryRun ? "Preview" : "Purge Data" })), purgeResult && !purgeModal.dryRun && (_jsx("button", { onClick: () => {
                                                setPurgeModal(null);
                                                setPurgeResult(null);
                                            }, className: "flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors", children: "Done" }))] })] }) }) }))] }) }));
}
