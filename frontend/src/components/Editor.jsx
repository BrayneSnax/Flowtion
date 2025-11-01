import { useState, useEffect, useRef } from "react";
import { Sparkles, Plus, Trash2, GripVertical, Menu as MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const BLOCK_TYPES = [
  { value: 'paragraph', label: 'Paragraph', icon: '¶' },
  { value: 'heading1', label: 'Heading 1', icon: 'H1' },
  { value: 'heading2', label: 'Heading 2', icon: 'H2' },
  { value: 'heading3', label: 'Heading 3', icon: 'H3' },
  { value: 'bulletList', label: 'Bullet List', icon: '•' },
  { value: 'numberedList', label: 'Numbered List', icon: '1.' },
  { value: 'todo', label: 'To-do', icon: '☐' },
  { value: 'code', label: 'Code', icon: '</>' },
  { value: 'divider', label: 'Divider', icon: '—' },
];

export default function Editor({ page, onPageUpdate, axiosInstance }) {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(page.title);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiAction, setAiAction] = useState("complete");
  const [aiLoading, setAiLoading] = useState(false);
  const titleInputRef = useRef(null);

  useEffect(() => {
    setTitle(page.title);
    loadBlocks();
  }, [page.id]);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  const loadBlocks = async () => {
    try {
      const response = await axiosInstance.get(`${API}/blocks/${page.id}`);
      setBlocks(response.data);
    } catch (error) {
      toast.error("Failed to load content");
    } finally {
      setLoading(false);
    }
  };

  const handleTitleSave = async () => {
    if (title.trim() !== page.title) {
      await onPageUpdate(page.id, { title: title.trim() || "Untitled" });
    }
    setEditingTitle(false);
  };

  const addBlock = async (type = 'paragraph') => {
    try {
      const newBlock = {
        page_id: page.id,
        type,
        content: type === 'divider' ? null : (type === 'todo' ? { text: '', checked: false } : ''),
        order: blocks.length
      };
      
      const response = await axiosInstance.post(`${API}/blocks`, newBlock);
      setBlocks([...blocks, response.data]);
    } catch (error) {
      toast.error("Failed to add block");
    }
  };

  const updateBlock = async (blockId, updates) => {
    try {
      const response = await axiosInstance.patch(`${API}/blocks/${blockId}`, updates);
      setBlocks(blocks.map(b => b.id === blockId ? response.data : b));
    } catch (error) {
      toast.error("Failed to update block");
    }
  };

  const deleteBlock = async (blockId) => {
    try {
      await axiosInstance.delete(`${API}/blocks/${blockId}`);
      setBlocks(blocks.filter(b => b.id !== blockId));
    } catch (error) {
      toast.error("Failed to delete block");
    }
  };

  const handleAIAssist = async () => {
    if (!aiPrompt.trim()) return;
    
    setAiLoading(true);
    try {
      const response = await axiosInstance.post(`${API}/ai/assist`, {
        prompt: aiPrompt,
        action: aiAction
      });
      
      // Add AI result as a new block
      const newBlock = {
        page_id: page.id,
        type: 'paragraph',
        content: response.data.result,
        order: blocks.length
      };
      
      const blockResponse = await axiosInstance.post(`${API}/blocks`, newBlock);
      setBlocks([...blocks, blockResponse.data]);
      
      setAiDialogOpen(false);
      setAiPrompt("");
      toast.success("AI content added");
    } catch (error) {
      toast.error("AI assist failed");
    } finally {
      setAiLoading(false);
    }
  };

  const renderBlockContent = (block) => {
    const handleContentChange = (newContent) => {
      updateBlock(block.id, { content: newContent });
    };

    switch (block.type) {
      case 'heading1':
        return (
          <Input
            value={block.content || ''}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Heading 1"
            className="text-4xl font-bold border-none shadow-none focus-visible:ring-0 px-0 h-auto"
            data-testid={`block-input-${block.id}`}
          />
        );
      case 'heading2':
        return (
          <Input
            value={block.content || ''}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Heading 2"
            className="text-3xl font-semibold border-none shadow-none focus-visible:ring-0 px-0 h-auto"
            data-testid={`block-input-${block.id}`}
          />
        );
      case 'heading3':
        return (
          <Input
            value={block.content || ''}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Heading 3"
            className="text-2xl font-semibold border-none shadow-none focus-visible:ring-0 px-0 h-auto"
            data-testid={`block-input-${block.id}`}
          />
        );
      case 'code':
        return (
          <Textarea
            value={block.content || ''}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="// Code here"
            className="font-mono text-sm bg-slate-100 min-h-[100px]"
            data-testid={`block-input-${block.id}`}
          />
        );
      case 'todo':
        return (
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={block.content?.checked || false}
              onChange={(e) => handleContentChange({ ...block.content, checked: e.target.checked })}
              className="mt-1 w-4 h-4 rounded border-slate-300"
              data-testid={`todo-checkbox-${block.id}`}
            />
            <Input
              value={block.content?.text || ''}
              onChange={(e) => handleContentChange({ ...block.content, text: e.target.value })}
              placeholder="To-do"
              className="border-none shadow-none focus-visible:ring-0 px-0"
              data-testid={`block-input-${block.id}`}
            />
          </div>
        );
      case 'divider':
        return <hr className="border-slate-200 my-4" />;
      case 'bulletList':
        return (
          <div className="flex items-start gap-3">
            <span className="text-xl mt-0.5">•</span>
            <Input
              value={block.content || ''}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="List item"
              className="border-none shadow-none focus-visible:ring-0 px-0"
              data-testid={`block-input-${block.id}`}
            />
          </div>
        );
      case 'numberedList':
        const index = blocks.filter(b => b.type === 'numberedList' && b.order <= block.order).length;
        return (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 font-medium">{index}.</span>
            <Input
              value={block.content || ''}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="List item"
              className="border-none shadow-none focus-visible:ring-0 px-0"
              data-testid={`block-input-${block.id}`}
            />
          </div>
        );
      default:
        return (
          <Textarea
            value={block.content || ''}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Type something..."
            className="border-none shadow-none focus-visible:ring-0 px-0 resize-none min-h-[40px]"
            rows={1}
            data-testid={`block-input-${block.id}`}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-lg text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-4xl">{page.icon}</span>
          {editingTitle ? (
            <Input
              ref={titleInputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSave();
                if (e.key === 'Escape') {
                  setTitle(page.title);
                  setEditingTitle(false);
                }
              }}
              className="text-3xl font-bold border-none shadow-none focus-visible:ring-0 px-0"
              data-testid="page-title-input"
            />
          ) : (
            <h1
              onClick={() => setEditingTitle(true)}
              className="text-3xl font-bold cursor-pointer hover:bg-slate-50 px-2 py-1 rounded"
              data-testid="page-title"
            >
              {page.title}
            </h1>
          )}
        </div>
        
        <Button
          onClick={() => setAiDialogOpen(true)}
          className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          data-testid="ai-assist-button"
        >
          <Sparkles size={16} />
          AI Assist
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-3xl mx-auto space-y-2">
          {blocks.map((block) => (
            <div key={block.id} className="block-container group">
              <div className="block-actions flex gap-1">
                <button
                  className="p-1 hover:bg-slate-200 rounded cursor-grab"
                  data-testid={`block-grip-${block.id}`}
                >
                  <GripVertical size={14} className="text-slate-400" />
                </button>
                <Select
                  value={block.type}
                  onValueChange={(type) => updateBlock(block.id, { type })}
                >
                  <SelectTrigger className="w-[32px] h-[26px] p-0 border-none shadow-none hover:bg-slate-200">
                    <div className="text-xs px-1" data-testid={`block-type-trigger-${block.id}`}>
                      <MenuIcon size={14} />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {BLOCK_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value} data-testid={`block-type-${type.value}`}>
                        <span className="flex items-center gap-2">
                          <span className="text-xs">{type.icon}</span>
                          {type.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="pl-2">
                {renderBlockContent(block)}
              </div>

              <button
                onClick={() => deleteBlock(block.id)}
                className="absolute right-0 top-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded text-red-600 transition-opacity"
                data-testid={`delete-block-${block.id}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          <Button
            onClick={() => addBlock()}
            variant="ghost"
            className="w-full justify-start gap-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 mt-4"
            data-testid="add-block-button"
          >
            <Plus size={16} />
            Add a block
          </Button>
        </div>
      </div>

      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent data-testid="ai-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="text-purple-600" />
              AI Writing Assistant
            </DialogTitle>
            <DialogDescription>
              Let AI help you write, improve, or summarize your content.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Action</label>
              <Select value={aiAction} onValueChange={setAiAction}>
                <SelectTrigger data-testid="ai-action-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="complete">Complete text</SelectItem>
                  <SelectItem value="improve">Improve writing</SelectItem>
                  <SelectItem value="summarize">Summarize</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Your text</label>
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Enter your text here..."
                className="min-h-[120px]"
                data-testid="ai-prompt-input"
              />
            </div>

            <Button
              onClick={handleAIAssist}
              disabled={!aiPrompt.trim() || aiLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              data-testid="ai-submit-button"
            >
              {aiLoading ? "Processing..." : "Generate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}