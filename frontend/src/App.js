import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Auth from "@/components/Auth";
import Workspace from "@/components/Workspace";
import { Toaster } from "@/components/ui/sonner";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="animate-pulse text-xl text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route 
            path="/auth" 
            element={
              isAuthenticated ? 
              <Navigate to="/" replace /> : 
              <Auth onAuth={() => setIsAuthenticated(true)} />
            } 
          />
          <Route 
            path="/" 
            element={
              isAuthenticated ? 
              <Workspace onLogout={() => setIsAuthenticated(false)} /> : 
              <Navigate to="/auth" replace />
            } 
          />
          <Route 
            path="/page/:pageId" 
            element={
              isAuthenticated ? 
              <Workspace onLogout={() => setIsAuthenticated(false)} /> : 
              <Navigate to="/auth" replace />
            } 
          />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;