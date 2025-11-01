import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import FrequencySelector from "@/components/FrequencySelector";
import UnifiedSurface from "@/components/UnifiedSurface";
import ConstellationView from "@/components/ConstellationView";
import { Toaster } from "@/components/ui/sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const axiosInstance = axios.create();
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default function Workspace({ onLogout }) {
  const { pageId } = useParams();
  const navigate = useNavigate();
  const [frequency, setFrequency] = useState(null);
  const [viewMode, setViewMode] = useState('surface'); // surface or constellation
  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(null);
  const [recentPages, setRecentPages] = useState([]);
  const [callingPages, setCallingPages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedFrequency = sessionStorage.getItem('frequency');
    if (storedFrequency) {
      setFrequency(storedFrequency);
    }
    loadPages();
  }, []);

  useEffect(() => {
    if (frequency) {
      sessionStorage.setItem('frequency', frequency);
    }
  }, [frequency]);

  useEffect(() => {
    if (pageId) {
      loadPage(pageId);
    } else if (pages.length > 0 && frequency) {
      // Auto-select based on frequency
      suggestPage();
    }
  }, [pageId, pages, frequency]);

  const loadPages = async () => {
    try {
      const response = await axiosInstance.get(`${API}/pages`);
      const activePages = response.data.filter(p => !p.dissolved_at);
      setPages(activePages);
      
      // Sort by recency for recent pages
      const sorted = [...activePages].sort((a, b) => 
        new Date(b.last_viewed_at || b.updated_at) - new Date(a.last_viewed_at || a.updated_at)
      );
      setRecentPages(sorted.slice(0, 5));
      
    } catch (error) {
      toast.error("Failed to load pages");
    } finally {
      setLoading(false);
    }
  };

  const loadPage = async (id) => {
    try {
      const response = await axiosInstance.get(`${API}/pages/${id}`);
      setCurrentPage(response.data);
      
      // Load related pages (what's calling you)
      loadRelatedPages(id);
    } catch (error) {
      toast.error("Failed to load page");
    }
  };

  const loadRelatedPages = async (id) => {
    try {
      const response = await axiosInstance.get(`${API}/pages/${id}/related`);
      // Parse AI response to extract page suggestions
      setCallingPages([]);
    } catch (error) {
      console.error("Could not load related pages", error);
    }
  };

  const suggestPage = () => {
    // Suggest page based on frequency
    const frequencyStateMap = {
      focus: ['active', 'germinating'],
      dream: ['germinating', 'turbulent'],
      reflect: ['cooling', 'crystallized'],
      synthesize: ['turbulent', 'active']
    };
    
    const targetStates = frequencyStateMap[frequency] || ['active'];
    const matchingPages = pages.filter(p => targetStates.includes(p.state));
    
    if (matchingPages.length > 0) {
      const suggested = matchingPages[0];
      navigate(`/page/${suggested.id}`, { replace: true });
    } else if (pages.length > 0) {
      navigate(`/page/${pages[0].id}`, { replace: true });
    }
  };

  const createPage = async (state = 'germinating') => {
    try {
      const response = await axiosInstance.post(`${API}/pages`, {
        title: "Untitled",
        icon: "🌱",
        state
      });
      setPages([...pages, response.data]);
      navigate(`/page/${response.data.id}`);
    } catch (error) {
      toast.error("Failed to create page");
    }
  };

  const updatePage = async (id, updates) => {
    try {
      const response = await axiosInstance.patch(`${API}/pages/${id}`, updates);
      setPages(pages.map(p => p.id === id ? response.data : p));
      if (currentPage?.id === id) {
        setCurrentPage(response.data);
      }
    } catch (error) {
      toast.error("Failed to update page");
    }
  };

  const dissolvePage = async (id) => {
    try {
      await axiosInstance.delete(`${API}/pages/${id}`);
      setPages(pages.filter(p => p.id !== id));
      
      if (currentPage?.id === id) {
        const remainingPages = pages.filter(p => p.id !== id);
        if (remainingPages.length > 0) {
          navigate(`/page/${remainingPages[0].id}`);
        } else {
          setCurrentPage(null);
        }
      }
      
      toast.success("Page dissolved");
    } catch (error) {
      toast.error("Failed to dissolve page");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('frequency');
    onLogout();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="animate-pulse text-xl text-slate-600">Loading workspace...</div>
      </div>
    );
  }

  // Show frequency selector if not set
  if (!frequency) {
    return (
      <div className="h-screen">
        <FrequencySelector onSelect={setFrequency} />
        <Toaster />
      </div>
    );
  }

  // Show appropriate view
  return (
    <div className="h-screen overflow-hidden">
      {viewMode === 'constellation' ? (
        <ConstellationView
          pages={pages}
          currentPageId={currentPage?.id}
          onPageSelect={(id) => {
            setViewMode('surface');
            navigate(`/page/${id}`);
          }}
          onClose={() => setViewMode('surface')}
          frequency={frequency}
        />
      ) : (
        <UnifiedSurface
          page={currentPage}
          pages={pages}
          recentPages={recentPages}
          callingPages={callingPages}
          frequency={frequency}
          onPageCreate={createPage}
          onPageUpdate={updatePage}
          onPageDissolve={dissolvePage}
          onPageSelect={(id) => navigate(`/page/${id}`)}
          onViewConstellation={() => setViewMode('constellation')}
          onChangeFrequency={() => setFrequency(null)}
          onLogout={handleLogout}
          axiosInstance={axiosInstance}
        />
      )}
      <Toaster />
    </div>
  );
}