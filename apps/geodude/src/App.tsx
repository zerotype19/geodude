import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Events from "./pages/Events";
import Login from "./pages/Login";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import AdminHealth from "./pages/AdminHealth";

// Simple test pages
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

// Ultra-simple routing - no complex logic
function AppRoutes() {
  const { user } = useAuth();
  
  console.log('🔍 AppRoutes: user =', user ? 'authenticated' : 'not authenticated');
  console.log('🔍 AppRoutes: current path =', window.location.pathname);

  // If no user, show login
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/admin/health" element={<AdminHealth />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // If user exists, show all pages
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/events" replace />} />
      <Route path="/login" element={<Navigate to="/events" replace />} />
      <Route path="/events" element={<Events />} />
      <Route path="/content" element={<ContentPage />} />
      <Route path="/install" element={<InstallPage />} />
      <Route path="/api-keys" element={<ApiKeysPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/admin/health" element={<AdminHealth />} />
      <Route path="*" element={<Navigate to="/events" replace />} />
    </Routes>
  );
}

function App() {
  console.log("🚀 GEODUDE APP STARTING - ULTRA SIMPLE ROUTING");
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;