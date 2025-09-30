import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Events from "./pages/Events";
import Content from "./pages/Content";
import Install from "./pages/Install";
import ApiKeys from "./pages/ApiKeys";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import AdminHealth from "./pages/AdminHealth";

// Navigation is handled by SimpleTopNav in each page's Shell component

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
      {currentPage === 'events' && <Events />}
      {currentPage === 'content' && <Content />}
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