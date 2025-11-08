import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useBreathingState } from "@/hooks/useBreathingState";
import { BreathingIndicator } from "@/components/BreathingIndicator";
import { Loader2 } from "lucide-react";

export default function Workspace() {
  const [projectId, setProjectId] = useState<number | null>(null);
  const [threadId, setThreadId] = useState<number | null>(null);
  const [userInput, setUserInput] = useState("");
  
  const breathing = useBreathingState();
  
  // Initialize project and thread
  const createProject = trpc.flowtion.createProject.useMutation();
  const createThread = trpc.flowtion.createThread.useMutation();
  const sendMessage = trpc.flowtion.sendMessage.useMutation();
  
  const { data: messages = [] } = trpc.flowtion.listMessages.useQuery(
    { threadId: threadId! },
    { enabled: !!threadId, refetchInterval: 2000 }
  );
  
  const { data: latestArtifact } = trpc.flowtion.getLatestArtifact.useQuery(
    { threadId: threadId! },
    { enabled: !!threadId, refetchInterval: 2000 }
  );

  useEffect(() => {
    // Auto-create project and thread on mount
    if (!projectId) {
      createProject.mutate({ name: "Flowtion Workspace" }, {
        onSuccess: (data) => {
          setProjectId(data.id);
          createThread.mutate({ projectId: data.id, title: "Main Space" }, {
            onSuccess: (threadData) => {
              setThreadId(threadData.id);
            }
          });
        }
      });
    }
  }, []);

  const handleSend = () => {
    if (!userInput.trim() || !projectId || !threadId) return;
    
    breathing.startBreathing();
    sendMessage.mutate({
      projectId,
      threadId,
      text: userInput,
    }, {
      onSuccess: () => {
        setUserInput("");
      }
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
            {!threadId ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Begin by speaking your intention...</p>
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
                      {msg.status !== 'done' && (
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
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Speak your intention..."
                disabled={!threadId || sendMessage.isPending}
                className="flex-1"
              />
              <Button
                onClick={handleSend}
                disabled={!threadId || !userInput.trim() || sendMessage.isPending}
              >
                {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
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
