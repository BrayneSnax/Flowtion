import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import ReactMarkdown from "react-markdown";
import { useBreathingState } from "@/hooks/useBreathingState";
import { BreathingIndicator, BreathingProgress } from "@/components/BreathingIndicator";

export default function Home() {
  // Persist project/thread in localStorage
  const [projectId, setProjectId] = useState<number | null>(() => {
    const saved = localStorage.getItem('flowtion_project_id');
    return saved ? parseInt(saved) : null;
  });
  const [threadId, setThreadId] = useState<number | null>(() => {
    const saved = localStorage.getItem('flowtion_thread_id');
    return saved ? parseInt(saved) : null;
  });
  
  // Save to localStorage when they change
  useEffect(() => {
    if (projectId) localStorage.setItem('flowtion_project_id', String(projectId));
  }, [projectId]);
  
  useEffect(() => {
    if (threadId) localStorage.setItem('flowtion_thread_id', String(threadId));
  }, [threadId]);
  const [status, setStatus] = useState<"listening" | "drafting" | "rendering" | "saved">("listening");
  const [version, setVersion] = useState<number | null>(null);
  
  // Breathing state for visual rhythm
  const breathing = useBreathingState();

  return (
    <div className="flex flex-col h-screen">
      {/* Header with status strip */}
      <header className="border-b border-neutral-200 bg-white px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-light text-neutral-600">
              Say it, and the image will learn.
            </h1>
            <ConversationSelector 
              currentProjectId={projectId} 
              currentThreadId={threadId}
              onSelect={(pid, tid) => {
                setProjectId(pid);
                setThreadId(tid);
              }}
              onNew={() => {
                setProjectId(null);
                setThreadId(null);
              }}
            />
          </div>
          <div className="flex flex-col items-end gap-1">
            <BreathingIndicator state={breathing.state} progress={breathing.progress} />
            {version !== null && (
              <span className="text-xs text-neutral-400">v{version}</span>
            )}
          </div>
        </div>
      </header>

      {/* Split-pane layout */}
      <div className="flex flex-col-reverse md:flex-row flex-1 overflow-hidden">
        {/* Thread Pane (GPT) - Left on desktop, bottom on mobile */}
        <section className="flex-1 overflow-y-auto order-2 md:order-1 flex flex-col">
          <ThreadPane
            threadId={threadId}
            onThreadCreated={(pid, tid) => {
              setProjectId(pid);
              setThreadId(tid);
            }}
            onStatusChange={setStatus}
            onBreathingStart={breathing.startBreathing}
          />
        </section>

        {/* Artifact Pane (Gemini) - Right on desktop, top on mobile */}
        <aside className="flex-1 overflow-y-auto order-1 md:order-2 border-b md:border-b-0 md:border-l border-neutral-200 bg-neutral-50">
          <ArtifactPane projectId={projectId} threadId={threadId} onVersionChange={setVersion} />
        </aside>
      </div>
    </div>
  );
}

interface ConversationSelectorProps {
  currentProjectId: number | null;
  currentThreadId: number | null;
  onSelect: (projectId: number, threadId: number) => void;
  onNew: () => void;
}

function ConversationSelector({ currentProjectId, currentThreadId, onSelect, onNew }: ConversationSelectorProps) {
  const { data: threads = [] } = trpc.flowtion.listThreads.useQuery();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded flex items-center gap-2"
      >
        <span>Space {currentThreadId || '(new)'}</span>
        <span className="text-neutral-400">▼</span>
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-neutral-200 rounded shadow-lg z-10 min-w-[300px]">
          <button
            onClick={() => {
              onNew();
              setIsOpen(false);
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 border-b border-neutral-200 font-medium text-blue-600"
          >
            + New Conversation
          </button>
          
          <div className="max-h-[300px] overflow-y-auto">
            {threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => {
                  onSelect(thread.projectId, thread.id);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-neutral-50 border-b border-neutral-100 ${
                  thread.id === currentThreadId ? 'bg-blue-50' : ''
                }`}
              >
                <div className="font-medium text-neutral-700">Space {thread.id}</div>
                <div className="text-xs text-neutral-500 truncate">{thread.preview}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ThreadPaneProps {
  threadId: number | null;
  onThreadCreated: (projectId: number, threadId: number) => void;
  onStatusChange: (status: "listening" | "drafting" | "rendering" | "saved") => void;
  onBreathingStart?: () => void;
}

function ThreadPane({ threadId, onThreadCreated, onStatusChange, onBreathingStart }: ThreadPaneProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();
  const prevMessageCountRef = useRef(0);

  const { data: messages = [], refetch } = trpc.flowtion.getMessages.useQuery(
    { threadId: threadId! },
    { enabled: !!threadId, refetchInterval: 2000 }
  );
  
  // Invalidate artifact cache when new messages arrive
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      console.log('[ThreadPane] New messages detected, invalidating artifact cache');
      utils.flowtion.getLatestArtifact.invalidate();
      prevMessageCountRef.current = messages.length;
    }
  }, [messages.length, utils]);

  const sendMutation = trpc.flowtion.send.useMutation({
    onSuccess: (data) => {
      // Only call onThreadCreated if we're creating a NEW thread
      if (!threadId) {
        onThreadCreated(data.projectId, data.threadId);
      }
      onStatusChange("drafting");
      refetch();
    },
  });

  const handleSend = () => {
    if (!input.trim()) return;
    
    // Start breathing cycle
    onBreathingStart?.();
    
    sendMutation.mutate({
      projectId: threadId ? undefined : undefined,
      threadId: threadId || undefined,
      text: input,
    });
    
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <div className="text-6xl">✨</div>
              <p className="text-neutral-400 text-sm">
                No artifact yet. First breath creates the first form.
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <div
                key={msg.id}
                className={`p-4 rounded-lg ${
                  msg.role === "user"
                    ? "bg-blue-50 ml-auto max-w-2xl"
                    : "bg-neutral-100 mr-auto max-w-2xl"
                }`}
              >
                <div className="text-sm text-neutral-700 prose prose-sm max-w-none">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-neutral-200 p-4 bg-white">
        <div className="flex items-end gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What wants to emerge?"
            className="flex-1 min-h-[60px] max-h-[200px] resize-none rounded-lg border border-neutral-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 px-4 py-3 text-sm text-neutral-700 placeholder:text-neutral-400"
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending}
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {sendMutation.isPending ? "Sending..." : "Send"}
          </button>
        </div>
        <p className="text-xs text-neutral-400 mt-2">
          ⌘/Ctrl + Enter to send
        </p>
      </div>
    </div>
  );
}

interface ArtifactPaneProps {
  projectId: number | null;
  threadId: number | null;
  onVersionChange: (version: number | null) => void;
}

function ArtifactPane({ projectId, threadId, onVersionChange }: ArtifactPaneProps) {
  const utils = trpc.useUtils();
  
  const { data: artifact, refetch } = trpc.flowtion.getLatestArtifact.useQuery(
    { projectId: projectId!, threadId: threadId ?? undefined },
    { 
      enabled: !!projectId, 
      // Disable all caching and force fresh data
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    }
  );
  
  // Log whenever artifact changes
  useEffect(() => {
    console.log('[ArtifactPane] Artifact changed:', {
      hasArtifact: !!artifact,
      version: artifact?.v,
      id: artifact?.id
    });
  }, [artifact]);
  
  // Aggressively refetch every 2 seconds
  useEffect(() => {
    if (!projectId) return;
    
    const interval = setInterval(() => {
      refetch();
    }, 2000);
    
    return () => clearInterval(interval);
  }, [projectId, refetch]);

  useEffect(() => {
    if (artifact) {
      console.log('[ArtifactPane] Artifact data:', { v: artifact.v, id: artifact.id, kind: artifact.kind });
      onVersionChange(artifact.v);
    }
  }, [artifact, onVersionChange]);

  return (
    <div className="h-full p-6">
      {!artifact ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-2">
            <div className="text-6xl">🎨</div>
            <p className="text-neutral-400 text-sm">
              Waiting for first artifact...
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-neutral-700">Artifact</h2>
            <div className="flex gap-2">
              <span className="text-xs px-2 py-1 bg-neutral-200 rounded text-neutral-600">
                v{artifact.v}
              </span>
              <span className="text-xs px-2 py-1 bg-red-100 rounded text-red-600">
                DEBUG: id={artifact.id} v={artifact.v} p={projectId} t={threadId}
              </span>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            {artifact.kind === "svg" && (
              <div dangerouslySetInnerHTML={{ __html: artifact.uri }} />
            )}
            {artifact.kind === "html" && (
              <div dangerouslySetInnerHTML={{ __html: artifact.uri }} />
            )}
            {artifact.kind === "image" && (
              <img src={artifact.uri} alt="Artifact" className="w-full" />
            )}
            {artifact.kind === "pdf" && (
              <iframe src={artifact.uri} className="w-full h-96" />
            )}
          </div>
          <p className="text-xs text-neutral-500">{artifact.summary}</p>
        </div>
      )}
    </div>
  );
}
