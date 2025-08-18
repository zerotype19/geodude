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
  created_ts: number;
  primary_property?: Property | null;
}

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  project: Project | null;
  loading: boolean;
  error: string | null;
  login: (userData: User, orgData: Organization, projectData: Project) => void;
  logout: () => void;
  refreshUserData: () => Promise<void>;
  listOrganizations: () => Promise<Organization[]>;
  listProjects: () => Promise<Project[]>;
  switchContext: (organizationId: string, projectId: string) => Promise<void>;
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
  const [loading, setLoading] = useState(true);
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
    
    // Redirect to login page
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
    } catch (err) {
      console.error('❌ AuthContext: Failed to refresh user data:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh user data');
      // If we can't get user data, they might be logged out
      setUser(null);
      setOrganization(null);
      setProject(null);
    } finally {
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
    loading,
    error,
    login,
    logout,
    refreshUserData,
    listOrganizations,
    listProjects,
    switchContext,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
