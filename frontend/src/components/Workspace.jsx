import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import FrequencySelector from '@/components/FrequencySelector';
import DynamicCanvas from '@/components/DynamicCanvas';
import ConversationalInput from '@/components/ConversationalInput';
import PatternInsights from '@/components/PatternInsights';
import ConversationPanel from '@/components/ConversationPanel';
import { Toaster } from '@/components/ui/sonner';
import { Home, Lightbulb, LogOut, MessageCircle } from 'lucide-react';

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
  const navigate = useNavigate();
  const [view, setView] = useState('canvas'); // canvas or frequency
  const [frequency, setFrequency] = useState('reflect');
  const [nodes, setNodes] = useState([]);
  const [insights, setInsights] = useState([]);
  const [showInsights, setShowInsights] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modelPreference, setModelPreference] = useState('hermes'); // hermes or openai
  const [conversationMessages, setConversationMessages] = useState([]);
  const [showConversation, setShowConversation] = useState(true);

  useEffect(() => {
    loadNodes();
    loadInsights();
  }, [frequency]);

  const loadNodes = async () => {
    try {
      const response = await axiosInstance.get(`${API}/nodes/${frequency}`);
      setNodes(response.data);
    } catch (error) {
      console.error('Failed to load nodes', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInsights = async () => {
    try {
      const response = await axiosInstance.get(`${API}/patterns/insights?model=${modelPreference}`);
      setInsights(response.data.insights || []);
    } catch (error) {
      console.error('Failed to load insights', error);
    }
  };

  const handleStructureCreated = (data) => {
    // Add new nodes to canvas
    if (data.nodes && data.nodes.length > 0) {
      setNodes([...nodes, ...data.nodes]);
    }
    
    // Add AI response to conversation
    if (data.message) {
      setConversationMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        nodes: data.nodes || [],
        timestamp: new Date().toISOString()
      }]);
    }
  };

  const handleUserInput = (userText) => {
    // Add user message to conversation
    setConversationMessages(prev => [...prev, {
      role: 'user',
      content: userText,
      timestamp: new Date().toISOString()
    }]);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    onLogout();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="animate-pulse text-xl text-slate-600">Loading field...</div>
      </div>
    );
  }

  if (view === 'frequency') {
    return (
      <div className="h-screen">
        <FrequencySelector
          onSelect={(freq) => {
            setFrequency(freq);
            setView('canvas');
          }}
        />
        <Toaster />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Minimal top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white/80 backdrop-blur-sm border-b border-slate-200 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setView('frequency')}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors"
            title="Change frequency"
            data-testid="home-button"
          >
            <Home size={20} className="text-slate-600" />
          </button>
          <div className="text-sm font-medium text-slate-600 capitalize">
            {frequency} field
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConversation(!showConversation)}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors relative"
            title="Toggle conversation"
            data-testid="conversation-button"
          >
            <MessageCircle size={20} className="text-slate-600" />
            {conversationMessages.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full" />
            )}
          </button>
          {insights.length > 0 && (
            <button
              onClick={() => setShowInsights(!showInsights)}
              className="p-2 rounded-full hover:bg-slate-100 transition-colors relative"
              title="Pattern insights"
              data-testid="insights-button"
            >
              <Lightbulb size={20} className="text-amber-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full" />
            </button>
          )}
          <button
            onClick={handleLogout}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors"
            title="Logout"
            data-testid="logout-button"
          >
            <LogOut size={20} className="text-slate-600" />
          </button>
        </div>
      </div>

      {/* Dynamic Canvas */}
      <div className="flex-1 relative">
        <DynamicCanvas
          frequency={frequency}
          nodes={nodes}
          onNodeClick={(node) => console.log('Node clicked:', node)}
        />
      </div>

      {/* Conversational Input */}
      <ConversationalInput
        frequency={frequency}
        onStructureCreated={handleStructureCreated}
        onUserInput={handleUserInput}
        axiosInstance={axiosInstance}
      />

      {/* Conversation Panel */}
      <ConversationPanel
        messages={conversationMessages}
        onClose={() => setShowConversation(false)}
        isVisible={showConversation}
      />

      {/* Pattern Insights Panel */}
      {showInsights && (
        <PatternInsights
          insights={insights}
          onClose={() => setShowInsights(false)}
        />
      )}

      <Toaster />
    </div>
  );
}