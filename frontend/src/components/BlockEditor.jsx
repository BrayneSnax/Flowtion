import { useState, useEffect, useRef } from "react";
import { Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function BlockEditor({ page, onPageUpdate, axiosInstance, frequency }) {
  const [blocks, setBlocks] = useState([]);
  const [focusedBlockId, setFocusedBlockId] = useState(null);
  const [showAI, setShowAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiAction, setAiAction] = useState("complete");
  const [aiLoading, setAiLoading] = useState(false);
  const blockRefs = useRef({});

  useEffect(() => {
    loadBlocks();
  }, [page.id]);

  const loadBlocks = async () => {
    try {
      const response = await axiosInstance.get(`${API}/blocks/${page.id}`);
      setBlocks(response.data);
      
      // If no blocks, create first one
      if (response.data.length === 0) {
        await addBlock();
      }
    } catch (error) {
      console.error("Failed to load blocks", error);
    }
  };

  const addBlock = async (afterBlockId = null) => {
    try {
      const afterBlock = afterBlockId ? blocks.find(b => b.id === afterBlockId) : null;
      const order = afterBlock ? afterBlock.order + 1 : blocks.length;
      
      if (afterBlock) {
        const blocksToUpdate = blocks.filter(b => b.order >= order);
        for (const block of blocksToUpdate) {
          await axiosInstance.patch(`${API}/blocks/${block.id}`, { order: block.order + 1 });
        }
      }
      
      const response = await axiosInstance.post(`${API}/blocks`, {
        page_id: page.id,
        type: 'paragraph',
        content: '',
        order
      });
      
      await loadBlocks();
      
      setTimeout(() => {
        if (blockRefs.current[response.data.id]) {
          blockRefs.current[response.data.id].focus();
        }
      }, 100);
    } catch (error) {
      console.error("Failed to add block", error);
    }
  };

  const updateBlock = async (blockId, updates) => {
    try {
      await axiosInstance.patch(`${API}/blocks/${blockId}`, updates);
      setBlocks(blocks.map(b => b.id === blockId ? { ...b, ...updates } : b));
    } catch (error) {
      console.error("Failed to update block", error);
    }
  };

  const deleteBlock = async (blockId) => {
    if (blocks.length === 1) return; // Keep at least one block
    
    try {
      await axiosInstance.delete(`${API}/blocks/${blockId}`);
      setBlocks(blocks.filter(b => b.id !== blockId));
    } catch (error) {
      console.error("Failed to delete block", error);
    }
  };

  const handleKeyDown = (e, blockId) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addBlock(blockId);
    } else if (e.key === 'Backspace') {
      const block = blocks.find(b => b.id === blockId);
      if (block && !block.content && blocks.length > 1) {
        e.preventDefault();
        deleteBlock(blockId);
      }
    }
  };

  const handleAI = async () => {
    if (!aiPrompt.trim()) return;
    
    setAiLoading(true);
    try {
      const response = await axiosInstance.post(`${API}/ai/assist`, {
        prompt: aiPrompt,
        action: aiAction
      });
      
      await axiosInstance.post(`${API}/blocks`, {
        page_id: page.id,
        type: 'paragraph',
        content: response.data.result,
        order: blocks.length
      });
      
      await loadBlocks();
      setShowAI(false);
      setAiPrompt("");
      toast.success("AI content added");
    } catch (error) {
      toast.error("AI assist failed");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-1">
      {blocks.map((block, index) => (
        <div
          key={block.id}
          className="group relative"
          onFocus={() => setFocusedBlockId(block.id)}
          onBlur={() => setFocusedBlockId(null)}
        >
          <textarea
            ref={(el) => (blockRefs.current[block.id] = el)}
            value={block.content || ''}
            onChange={(e) => updateBlock(block.id, { content: e.target.value })}
            onKeyDown={(e) => handleKeyDown(e, block.id)}
            placeholder={index === 0 ? "Start writing... or type / for commands" : "Continue..."}
            className="w-full bg-transparent border-none outline-none resize-none text-slate-800 placeholder-slate-400 leading-relaxed py-2"
            style={{ minHeight: '2.5rem' }}
            rows={1}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
          />

          {/* Subtle prompt on pause */}
          {focusedBlockId === block.id && block.content && block.content.length > 20 && (
            <div className="absolute right-0 top-2 flex items-center gap-2 text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => {
                  setAiPrompt(block.content);
                  setShowAI(true);
                }}
                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/50"
              >
                <Sparkles size={12} />
                enhance
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Add block button */}
      <button
        onClick={() => addBlock()}
        className="w-full py-4 text-slate-400 hover:text-slate-600 transition-colors text-sm flex items-center gap-2 justify-center group"
      >
        <Plus size={16} className="group-hover:scale-110 transition-transform" />
        <span className="opacity-0 group-hover:opacity-100 transition-opacity">New block</span>
      </button>

      {/* AI Dialog */}
      <Dialog open={showAI} onOpenChange={setShowAI}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="text-purple-600" />
              AI Assistant
            </DialogTitle>
            <DialogDescription>
              Let AI help you refine your thought
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <Select value={aiAction} onValueChange={setAiAction}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="complete">Complete</SelectItem>
                <SelectItem value="improve">Improve</SelectItem>
                <SelectItem value="summarize">Summarize</SelectItem>
              </SelectContent>
            </Select>

            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Your text..."
              className="min-h-[120px]"
            />

            <Button
              onClick={handleAI}
              disabled={!aiPrompt.trim() || aiLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {aiLoading ? "Processing..." : "Generate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}