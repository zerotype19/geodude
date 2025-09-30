import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Events from "./pages/Events";
import Install from "./pages/Install";
import ApiKeys from "./pages/ApiKeys";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import AdminHealth from "./pages/AdminHealth";

// Simple navigation component
function Navigation({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { user } = useAuth();
  
  if (!user) return null;
  
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex space-x-8 py-4">
          <button onClick={() => onNavigate('events')} className="text-gray-700 hover:text-blue-600">Events</button>
          <button onClick={() => onNavigate('content')} className="text-gray-700 hover:text-blue-600">Content</button>
          <button onClick={() => onNavigate('install')} className="text-gray-700 hover:text-blue-600">Install</button>
          <button onClick={() => onNavigate('api-keys')} className="text-gray-700 hover:text-blue-600">API Keys</button>
          <button onClick={() => onNavigate('settings')} className="text-gray-700 hover:text-blue-600">Settings</button>
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
      console.log('🔍 URL changed to:', path);
      if (path === '/events' || path === '/') setCurrentPage('events');
      else if (path === '/content') setCurrentPage('content');
      else if (path === '/install') setCurrentPage('install');
      else if (path === '/api-keys') setCurrentPage('api-keys');
      else if (path === '/settings') setCurrentPage('settings');
      else {
        console.log('🔍 Unknown path, defaulting to events:', path);
        setCurrentPage('events');
      }
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
      <Navigation onNavigate={navigate} />
      {currentPage === 'events' && <Events />}
      {currentPage === 'content' && <div className="min-h-screen bg-purple-100 flex items-center justify-center"><div className="text-center"><h1 className="text-4xl font-bold text-purple-800">CONTENT PAGE</h1><p className="text-xl text-purple-600 mt-4">Content functionality goes here</p></div></div>}
      {currentPage === 'install' && <Install />}
      {currentPage === 'api-keys' && <ApiKeys />}
      {currentPage === 'settings' && <Settings />}
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