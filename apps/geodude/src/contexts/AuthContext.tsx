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

interface Project {
  id: string;
  name: string;
  slug: string;
  org_id: string;
  created_ts: number;
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

  const logout = () => {
    setUser(null);
    setOrganization(null);
    setProject(null);
    // Clear session cookie by setting it to expire
    document.cookie = 'optiview_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  };

  const refreshUserData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if user is authenticated by looking for session cookie
      const sessionCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('optiview_session='));
      
      console.log('🔍 AuthContext: Session cookie found:', !!sessionCookie);
      console.log('🔍 AuthContext: Full cookies:', document.cookie);
      
      if (!sessionCookie) {
        console.log('❌ AuthContext: No session cookie found');
        setLoading(false);
        return;
      }

      // Get current user data
      console.log('🔍 AuthContext: Calling /api/auth/me...');
      const userResponse = await fetch(`${API_BASE}/api/auth/me`, {
        credentials: 'include',
      });

      console.log('🔍 AuthContext: /api/auth/me response status:', userResponse.status);

      if (!userResponse.ok) {
        console.log('❌ AuthContext: /api/auth/me failed:', userResponse.status, userResponse.statusText);
        throw new Error('Failed to fetch user data');
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
      logout();
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
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
