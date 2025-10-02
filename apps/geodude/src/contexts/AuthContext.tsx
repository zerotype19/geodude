import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { API_BASE } from '../config';

interface User {
  id: string;
  email: string;
  is_admin: number;
  created_ts: number;
  last_login_ts?: number;
}

interface Organization {
  id: string;
  name: string;
  created_ts: number;
}

interface Property {
  id: number;
  project_id: string;
  domain: string;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  slug: string;
  org_id: string;
  created_at: string;
  primary_property?: Property | null;
}

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  project: Project | null;
  selectedProperty: Property | null;
  loading: boolean;
  error: string | null;
  login: (userData: User, orgData: Organization, projectData: Project) => void;
  logout: () => void;
  refreshUserData: () => Promise<void>;
  listOrganizations: () => Promise<Organization[]>;
  listProjects: () => Promise<Project[]>;
  switchContext: (organizationId: string, projectId: string) => Promise<void>;
  setSelectedProperty: (property: Property | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(false); // Start as false to prevent blocking
  const [error, setError] = useState<string | null>(null);

  const login = (userData: User, orgData: Organization, projectData: Project) => {
    setUser(userData);
    setOrganization(orgData);
    setProject(projectData);
    setError(null);
  };

  const logout = async () => {
    try {
      // Call the API to properly invalidate the session
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Failed to logout on server:', err);
      // Continue with client-side logout even if server call fails
    }
    
    // Clear local state
    setUser(null);
    setOrganization(null);
    setProject(null);
    
    // Clear the session cookie
    document.cookie = 'optiview_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + window.location.hostname;
    
    // Use window.location.href for a full page reload to clear any cached state
    window.location.href = '/login';
  };

  const listOrganizations = async (): Promise<Organization[]> => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/organizations`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch organizations');
      const data = await response.json();
      return data.organizations || [];
    } catch (err) {
      console.error('Failed to list organizations:', err);
      return [];
    }
  };

  const listProjects = async (): Promise<Project[]> => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/projects`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch projects');
      const data = await response.json();
      return data.projects || [];
    } catch (err) {
      console.error('Failed to list projects:', err);
      return [];
    }
  };

  const switchContext = async (organizationId: string, projectId: string): Promise<void> => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/switch-context`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: organizationId, project_id: projectId })
      });

      if (!response.ok) throw new Error('Failed to switch context');

      // Refresh user data to get the new context
      await refreshUserData();
    } catch (err) {
      console.error('Failed to switch context:', err);
      throw err;
    }
  };

  const refreshUserData = async () => {
    console.log('🔍 AuthContext: Attempting to fetch user data...');

    try {
      const userResponse = await fetch(`${API_BASE}/api/auth/me`, {
        credentials: 'include',
      });

      if (!userResponse.ok) {
        console.log('❌ AuthContext: User not authenticated');
        setUser(null);
        setOrganization(null);
        setProject(null);
        setLoading(false);
        return;
      }

      const userData = await userResponse.json();
      console.log('✅ AuthContext: User data received:', userData);
      setUser(userData);
      setLoading(false); // Set loading to false immediately after getting user

      // Try to get organization and project data in background - don't block
      Promise.all([
        fetch(`${API_BASE}/api/auth/organization`, { credentials: 'include' })
          .then(res => {
            console.log('🔍 AuthContext: Organization response status:', res.status);
            return res.ok ? res.json() : null;
          })
          .then(data => {
            console.log('🔍 AuthContext: Organization data:', data);
            if (data) {
              setOrganization(data);
              console.log('✅ AuthContext: Organization set:', data);
            } else {
              console.log('⚠️ AuthContext: No organization data received');
            }
          })
          .catch(err => console.error('❌ AuthContext: Organization fetch failed:', err)),

        fetch(`${API_BASE}/api/auth/project`, { credentials: 'include' })
          .then(res => {
            console.log('🔍 AuthContext: Project response status:', res.status);
            return res.ok ? res.json() : null;
          })
          .then(data => {
            console.log('🔍 AuthContext: Project data:', data);
            if (data) {
              setProject(data);
              console.log('✅ AuthContext: Project set:', data);
            } else {
              console.log('⚠️ AuthContext: No project data received');
            }
          })
          .catch(err => console.error('❌ AuthContext: Project fetch failed:', err))
      ]).catch(err => console.error('❌ AuthContext: Background fetch failed:', err));

      console.log('✅ AuthContext: User state updated successfully');
    } catch (err) {
      console.error('❌ AuthContext: Failed to refresh user data:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh user data');
      setUser(null);
      setOrganization(null);
      setProject(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUserData();
  }, []);

  const value: AuthContextType = {
    user,
    organization,
    project,
    selectedProperty,
    loading,
    error,
    login,
    logout,
    refreshUserData,
    listOrganizations,
    listProjects,
    switchContext,
    setSelectedProperty,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
