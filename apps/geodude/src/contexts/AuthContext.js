import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE } from '../config';
const AuthContext = createContext(undefined);
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [organization, setOrganization] = useState(null);
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const login = (userData, orgData, projectData) => {
        setUser(userData);
        setOrganization(orgData);
        setProject(projectData);
        setError(null);
    };
    const logout = () => {
        setUser(null);
        setOrganization(null);
        setProject(null);
        document.cookie = 'optiview_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    };
    const listOrganizations = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/auth/organizations`, { credentials: 'include' });
            if (!response.ok)
                throw new Error('Failed to fetch organizations');
            const data = await response.json();
            return data.organizations || [];
        }
        catch (err) {
            console.error('Failed to list organizations:', err);
            return [];
        }
    };
    const listProjects = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/auth/projects`, { credentials: 'include' });
            if (!response.ok)
                throw new Error('Failed to fetch projects');
            const data = await response.json();
            return data.projects || [];
        }
        catch (err) {
            console.error('Failed to list projects:', err);
            return [];
        }
    };
    const switchContext = async (organizationId, projectId) => {
        try {
            const response = await fetch(`${API_BASE}/api/auth/switch-context`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ organization_id: organizationId, project_id: projectId })
            });
            if (!response.ok)
                throw new Error('Failed to switch context');
            // Refresh user data to get the new context
            await refreshUserData();
        }
        catch (err) {
            console.error('Failed to switch context:', err);
            throw err;
        }
    };
    const refreshUserData = async () => {
        try {
            setLoading(true);
            setError(null);
            // Always attempt to get user data - the HttpOnly cookie will be sent automatically
            console.log('🔍 AuthContext: Attempting to fetch user data...');
            // Get current user data
            console.log('🔍 AuthContext: Calling /api/auth/me...');
            const userResponse = await fetch(`${API_BASE}/api/auth/me`, {
                credentials: 'include',
            });
            console.log('🔍 AuthContext: /api/auth/me response status:', userResponse.status);
            if (!userResponse.ok) {
                console.log('❌ AuthContext: /api/auth/me failed:', userResponse.status, userResponse.statusText);
                // User is not authenticated
                setUser(null);
                setOrganization(null);
                setProject(null);
                setLoading(false);
                return;
            }
            const userData = await userResponse.json();
            console.log('✅ AuthContext: User data received:', userData);
            // Get user's organization and project
            console.log('🔍 AuthContext: Calling /api/auth/organization...');
            const orgResponse = await fetch(`${API_BASE}/api/auth/organization`, {
                credentials: 'include',
            });
            console.log('🔍 AuthContext: /api/auth/organization response status:', orgResponse.status);
            if (orgResponse.ok) {
                const orgData = await orgResponse.json();
                console.log('✅ AuthContext: Organization data received:', orgData);
                setOrganization(orgData);
                // Get project data
                console.log('🔍 AuthContext: Calling /api/auth/project...');
                const projectResponse = await fetch(`${API_BASE}/api/auth/project`, {
                    credentials: 'include',
                });
                console.log('🔍 AuthContext: /api/auth/project response status:', projectResponse.status);
                if (projectResponse.ok) {
                    const projectData = await projectResponse.json();
                    console.log('✅ AuthContext: Project data received:', projectData);
                    setProject(projectData);
                }
            }
            setUser(userData);
            console.log('✅ AuthContext: User state updated successfully');
        }
        catch (err) {
            console.error('❌ AuthContext: Failed to refresh user data:', err);
            setError(err instanceof Error ? err.message : 'Failed to refresh user data');
            // If we can't get user data, they might be logged out
            setUser(null);
            setOrganization(null);
            setProject(null);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        refreshUserData();
    }, []);
    const value = {
        user,
        organization,
        project,
        loading,
        error,
        login,
        logout,
        refreshUserData,
        listOrganizations,
        listProjects,
        switchContext,
    };
    return (_jsx(AuthContext.Provider, { value: value, children: children }));
};
