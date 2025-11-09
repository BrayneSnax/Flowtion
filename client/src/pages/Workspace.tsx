import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useBreathingState } from "@/hooks/useBreathingState";
import { BreathingIndicator } from "@/components/BreathingIndicator";
import { supabase, type ArtifactVersion } from "@/lib/supabase";

export default function Workspace() {
  // Persist project/thread in localStorage
  const [projectId, setProjectId] = useState<number | null>(() => {
    const saved = localStorage.getItem('flowtion_project_id');
    return saved ? parseInt(saved) : null;
  });
  const [threadId, setThreadId] = useState<number | null>(() => {
    const saved = localStorage.getItem('flowtion_thread_id');
    return saved ? parseInt(saved) : null;
  });
  
  const [userInput, setUserInput] = useState("");
  const breathing = useBreathingState();
  const [artifacts, setArtifacts] = useState<ArtifactVersion[]>([]);
  
  // Save to localStorage when they change
  useEffect(() => {
    if (projectId) localStorage.setItem('flowtion_project_id', String(projectId));
  }, [projectId]);
  
  useEffect(() => {
    if (threadId) localStorage.setItem('flowtion_thread_id', String(threadId));
  }, [threadId]);
  
  const { data: messages = [] } = trpc.flowtion.getMessages.useQuery(
    { threadId: threadId! },
    { enabled: !!threadId, refetchInterval: 2000 }
  );
  
  // Subscribe to real-time artifact updates
  useEffect(() => {
    if (!threadId) return;

    console.log('[Realtime] Subscribing to artifacts for thread', threadId);

    // Fetch existing artifacts
    supabase
      .from('artifact_versions')
      .select('*')
      .eq('thread_id', threadId)
      .order('v', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('[Realtime] Error fetching artifacts:', error);
        } else {
          console.log('[Realtime] Loaded', data?.length || 0, 'existing artifacts');
          setArtifacts(data || []);
        }
      });

    // Subscribe to new artifacts
    const channel = supabase
      .channel(`artifacts-${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'artifact_versions',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          console.log('[Realtime] New artifact received:', payload.new);
          setArtifacts((prev) => [...prev, payload.new as ArtifactVersion]);
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
      });

    return () => {
      console.log('[Realtime] Unsubscribing from thread', threadId);
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  const latestArtifact = artifacts.length > 0 ? artifacts[artifacts.length - 1] : null;

  const sendMutation = trpc.flowtion.send.useMutation({
    onSuccess: (data) => {
      // Update project/thread IDs if this was the first message
      if (!threadId && data.projectId && data.threadId) {
        setProjectId(data.projectId);
        setThreadId(data.threadId);
      }
      setUserInput("");
    }
  });

  const handleSend = () => {
    if (!userInput.trim()) return;
    
    breathing.startBreathing();
    sendMutation.mutate({
      projectId: projectId || undefined,
      threadId: threadId || undefined,
      text: userInput,
    });
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Flowtion</h1>
            <p className="text-sm text-muted-foreground">
              The machine remembers to breathe
            </p>
          </div>
          <BreathingIndicator state={breathing.state} progress={breathing.progress} />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Conversation Panel */}
        <div className="flex-1 flex flex-col border-r border-border">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center space-y-2">
                  <div className="text-6xl">✨</div>
                  <p>No artifact yet. First breath creates the first form.</p>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <Card key={msg.id} className={`p-4 ${msg.role === 'user' ? 'bg-primary/5' : 'bg-muted/50'}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground mb-1">
                        {msg.role === 'user' ? 'You' : 'Steward'}
                      </div>
                      <div className="text-sm whitespace-pre-wrap">{msg.text}</div>
                      {msg.status && msg.status !== 'done' && (
                        <div className="text-xs text-muted-foreground mt-2">
                          {msg.status}...
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-border p-4">
            <div className="flex gap-2">
              <Input
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="What wants to emerge?"
                disabled={sendMutation.isPending}
                className="flex-1"
              />
              <Button
                onClick={handleSend}
                disabled={!userInput.trim() || sendMutation.isPending}
              >
                Send
              </Button>
            </div>
          </div>
        </div>

        {/* Artifact Panel */}
        <div className="flex-1 flex flex-col bg-muted/30">
          <div className="flex-1 overflow-y-auto p-6">
            {!latestArtifact ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Artifacts will appear here...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <div>Version {latestArtifact.v}</div>
                  <div className="mt-1">{latestArtifact.summary}</div>
                  {latestArtifact.delta && (
                    <div className="mt-1 text-xs italic">{latestArtifact.delta}</div>
                  )}
                </div>
                
                <Card className="p-4 bg-background">
                  {latestArtifact.kind === 'svg' ? (
                    <div dangerouslySetInnerHTML={{ __html: latestArtifact.uri }} />
                  ) : latestArtifact.kind === 'html' ? (
                    <div dangerouslySetInnerHTML={{ __html: latestArtifact.uri }} />
                  ) : (
                    <div className="text-center text-muted-foreground">
                      Artifact type: {latestArtifact.kind}
                    </div>
                  )}
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
