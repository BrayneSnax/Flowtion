import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/Sidebar";
import Editor from "@/components/Editor";
import axios from "axios";
import { toast } from "sonner";

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
  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPages();
  }, []);

  useEffect(() => {
    if (pageId) {
      loadPage(pageId);
    } else if (pages.length > 0) {
      const firstPage = pages.find(p => !p.parent_id) || pages[0];
      navigate(`/page/${firstPage.id}`, { replace: true });
    }
  }, [pageId, pages]);

  const loadPages = async () => {
    try {
      const response = await axiosInstance.get(`${API}/pages`);
      setPages(response.data);
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
    } catch (error) {
      toast.error("Failed to load page");
    }
  };

  const createPage = async (parentId = null) => {
    try {
      const response = await axiosInstance.post(`${API}/pages`, {
        title: "Untitled",
        icon: "📄",
        parent_id: parentId
      });
      setPages([...pages, response.data]);
      navigate(`/page/${response.data.id}`);
      setSidebarOpen(false);
      toast.success("Page created");
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

  const deletePage = async (id) => {
    try {
      await axiosInstance.delete(`${API}/pages/${id}`);
      setPages(pages.filter(p => p.id !== id && p.parent_id !== id));
      
      if (currentPage?.id === id) {
        const remainingPages = pages.filter(p => p.id !== id);
        if (remainingPages.length > 0) {
          navigate(`/page/${remainingPages[0].id}`);
        } else {
          setCurrentPage(null);
        }
      }
      
      toast.success("Page deleted");
    } catch (error) {
      toast.error("Failed to delete page");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    onLogout();
    toast.success("Logged out successfully");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="animate-pulse text-xl text-slate-600">Loading workspace...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 overflow-hidden">
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-white shadow-md"
        data-testid="mobile-menu-button"
      >
        <Menu size={20} />
      </Button>

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          data-testid="sidebar-overlay"
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed lg:relative inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <Sidebar
          pages={pages}
          currentPageId={currentPage?.id}
          onPageSelect={(id) => {
            navigate(`/page/${id}`);
            setSidebarOpen(false);
          }}
          onPageCreate={createPage}
          onPageUpdate={updatePage}
          onPageDelete={deletePage}
          collapsed={false}
          onToggleCollapse={() => setSidebarOpen(false)}
          onLogout={handleLogout}
        />
      </div>
      
      {/* Main Editor Area */}
      <div className="flex-1 overflow-hidden">
        {currentPage ? (
          <Editor
            page={currentPage}
            onPageUpdate={updatePage}
            axiosInstance={axiosInstance}
          />
        ) : (
          <div className="flex items-center justify-center h-full px-4">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">📝</div>
              <h2 className="text-2xl font-semibold text-slate-700 mb-2">No pages yet</h2>
              <p className="text-slate-500 mb-6">Create your first page to get started</p>
              <button
                onClick={() => createPage()}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 font-medium"
                data-testid="create-first-page-button"
              >
                Create Page
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}