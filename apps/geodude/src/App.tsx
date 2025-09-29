import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Events from "./pages/Events";
import Login from "./pages/Login";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import AdminHealth from "./pages/AdminHealth";

// Simple page components
function InstallPage() {
  return (
    <div className="min-h-screen bg-blue-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-blue-800">INSTALL PAGE</h1>
        <p className="text-xl text-blue-600 mt-4">Install functionality goes here</p>
      </div>
    </div>
  );
}

function ApiKeysPage() {
  return (
    <div className="min-h-screen bg-green-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-green-800">API KEYS PAGE</h1>
        <p className="text-xl text-green-600 mt-4">API Keys functionality goes here</p>
      </div>
    </div>
  );
}

function ContentPage() {
  return (
    <div className="min-h-screen bg-purple-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-purple-800">CONTENT PAGE</h1>
        <p className="text-xl text-purple-600 mt-4">Content functionality goes here</p>
      </div>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800">SETTINGS PAGE</h1>
        <p className="text-xl text-gray-600 mt-4">Settings functionality goes here</p>
      </div>
    </div>
  );
}

// Simple navigation component
function Navigation() {
  const { user } = useAuth();
  
  if (!user) return null;
  
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex space-x-8 py-4">
          <a href="/events" className="text-gray-700 hover:text-blue-600">Events</a>
          <a href="/content" className="text-gray-700 hover:text-blue-600">Content</a>
          <a href="/install" className="text-gray-700 hover:text-blue-600">Install</a>
          <a href="/api-keys" className="text-gray-700 hover:text-blue-600">API Keys</a>
          <a href="/settings" className="text-gray-700 hover:text-blue-600">Settings</a>
        </div>
      </div>
    </nav>
  );
}

// Main app component - NO REACT ROUTER
function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('events');
  
  // Handle URL changes
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/events') setCurrentPage('events');
      else if (path === '/content') setCurrentPage('content');
      else if (path === '/install') setCurrentPage('install');
      else if (path === '/api-keys') setCurrentPage('api-keys');
      else if (path === '/settings') setCurrentPage('settings');
      else setCurrentPage('events');
    };
    
    // Set initial page from URL
    handlePopState();
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  
  // Handle navigation
  const navigate = (page: string) => {
    setCurrentPage(page);
    window.history.pushState({}, '', `/${page}`);
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Login />;
  }
  
  return (
    <div>
      <Navigation />
      {currentPage === 'events' && <Events />}
      {currentPage === 'content' && <ContentPage />}
      {currentPage === 'install' && <InstallPage />}
      {currentPage === 'api-keys' && <ApiKeysPage />}
      {currentPage === 'settings' && <SettingsPage />}
    </div>
  );
}

function App() {
  console.log("🚀 GEODUDE APP STARTING - NO REACT ROUTER");
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;