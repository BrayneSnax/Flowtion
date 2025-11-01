import { useState, useEffect, useRef } from "react";
import { Sparkles, Plus, Trash2, GripVertical, Menu as MenuIcon, Clock, ChevronRight } from "lucide-react";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const BLOCK_TYPES = [
  { value: 'paragraph', label: 'Text', icon: '¶', cmd: 'text' },
  { value: 'heading1', label: 'Heading 1', icon: 'H1', cmd: 'h1' },
  { value: 'heading2', label: 'Heading 2', icon: 'H2', cmd: 'h2' },
  { value: 'heading3', label: 'Heading 3', icon: 'H3', cmd: 'h3' },
  { value: 'bulletList', label: 'Bullet List', icon: '•', cmd: 'bullet' },
  { value: 'numberedList', label: 'Numbered List', icon: '1.', cmd: 'number' },
  { value: 'todo', label: 'To-do', icon: '☐', cmd: 'todo' },
  { value: 'code', label: 'Code', icon: '</>', cmd: 'code' },
  { value: 'quote', label: 'Quote', icon: '"', cmd: 'quote' },
  { value: 'divider', label: 'Divider', icon: '—', cmd: 'divider' },
  { value: 'toggle', label: 'Toggle', icon: '▸', cmd: 'toggle' },
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
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandBlockId, setCommandBlockId] = useState(null);
  const [draggedBlock, setDraggedBlock] = useState(null);
  const [collapsedToggles, setCollapsedToggles] = useState({});
  const titleInputRef = useRef(null);
  const blockRefs = useRef({});

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

  const addBlock = async (type = 'paragraph', afterBlockId = null) => {
    try {
      const afterBlock = afterBlockId ? blocks.find(b => b.id === afterBlockId) : null;
      const order = afterBlock ? afterBlock.order + 1 : blocks.length;
      
      if (afterBlock) {
        const blocksToUpdate = blocks.filter(b => b.order >= order);
        for (const block of blocksToUpdate) {
          await axiosInstance.patch(`${API}/blocks/${block.id}`, { order: block.order + 1 });
        }
      }
      
      const newBlock = {
        page_id: page.id,
        type,
        content: type === 'divider' ? null : (type === 'todo' ? { text: '', checked: false } : (type === 'toggle' ? { title: '', content: '', collapsed: true } : '')),
        order
      };
      
      const response = await axiosInstance.post(`${API}/blocks`, newBlock);
      await loadBlocks();
      
      setTimeout(() => {
        if (blockRefs.current[response.data.id]) {
          blockRefs.current[response.data.id].focus();
        }
      }, 100);
    } catch (error) {
      toast.error("Failed to add block");
    }
  };

  const updateBlock = async (blockId, updates) => {
    try {
      const response = await axiosInstance.patch(`${API}/blocks/${blockId}`, updates);
      setBlocks(blocks.map(b => b.id === blockId ? response.data : b));
    } catch (error) {
      console.error("Failed to update block", error);
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

  const handleKeyDown = (e, blockId, blockType) => {
    if (e.key === 'Enter' && !e.shiftKey && blockType !== 'code') {
      e.preventDefault();
      addBlock('paragraph', blockId);
    } else if (e.key === 'Backspace') {
      const block = blocks.find(b => b.id === blockId);
      const isEmpty = !block.content || (typeof block.content === 'object' && !block.content.text && !block.content.title);
      if (block && isEmpty) {
        e.preventDefault();
        deleteBlock(blockId);
      }
    }
  };

  const handleInputChange = (blockId, value) => {
    if (value.startsWith('/')) {
      setCommandOpen(true);
      setCommandBlockId(blockId);
    } else {
      updateBlock(blockId, { content: value });
    }
  };

  const handleCommandSelect = async (type) => {
    if (commandBlockId) {
      await updateBlock(commandBlockId, { 
        type, 
        content: type === 'divider' ? null : (type === 'todo' ? { text: '', checked: false } : (type === 'toggle' ? { title: '', content: '', collapsed: true } : '')) 
      });
      setCommandOpen(false);
      setCommandBlockId(null);
    }
  };

  const handleDragStart = (e, blockId) => {
    setDraggedBlock(blockId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetBlockId) => {
    e.preventDefault();
    if (!draggedBlock || draggedBlock === targetBlockId) return;

    const draggedBlockObj = blocks.find(b => b.id === draggedBlock);
    const targetBlockObj = blocks.find(b => b.id === targetBlockId);

    if (!draggedBlockObj || !targetBlockObj) return;

    try {
      await axiosInstance.patch(`${API}/blocks/${draggedBlock}`, { order: targetBlockObj.order });
      await axiosInstance.patch(`${API}/blocks/${targetBlockId}`, { order: draggedBlockObj.order });
      
      await loadBlocks();
      setDraggedBlock(null);
    } catch (error) {
      toast.error("Failed to reorder blocks");
    }
  };

  const toggleCollapse = (blockId) => {
    setCollapsedToggles(prev => ({ ...prev, [blockId]: !prev[blockId] }));
  };

  const handleAIAssist = async () => {
    if (!aiPrompt.trim()) return;
    
    setAiLoading(true);
    try {
      const response = await axiosInstance.post(`${API}/ai/assist`, {
        prompt: aiPrompt,
        action: aiAction
      });
      
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
          <input
            ref={(el) => (blockRefs.current[block.id] = el)}
            value={block.content || ''}
            onChange={(e) => handleInputChange(block.id, e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, block.id, 'heading1')}
            placeholder="Heading 1"
            className="w-full text-3xl sm:text-4xl font-bold border-none outline-none bg-transparent"
            data-testid={`block-input-${block.id}`}
          />
        );
      case 'heading2':
        return (
          <input
            ref={(el) => (blockRefs.current[block.id] = el)}
            value={block.content || ''}
            onChange={(e) => handleInputChange(block.id, e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, block.id, 'heading2')}
            placeholder="Heading 2"
            className="w-full text-2xl sm:text-3xl font-semibold border-none outline-none bg-transparent"
            data-testid={`block-input-${block.id}`}
          />
        );
      case 'heading3':
        return (
          <input
            ref={(el) => (blockRefs.current[block.id] = el)}
            value={block.content || ''}
            onChange={(e) => handleInputChange(block.id, e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, block.id, 'heading3')}
            placeholder="Heading 3"
            className="w-full text-xl sm:text-2xl font-semibold border-none outline-none bg-transparent"
            data-testid={`block-input-${block.id}`}
          />
        );
      case 'code':
        return (
          <textarea
            ref={(el) => (blockRefs.current[block.id] = el)}
            value={block.content || ''}
            onChange={(e) => handleInputChange(block.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !block.content) {
                e.preventDefault();
                deleteBlock(block.id);
              }
            }}
            placeholder="// Code here"
            className="w-full font-mono text-sm bg-slate-100 rounded p-3 min-h-[100px] border-none outline-none resize-y"
            data-testid={`block-input-${block.id}`}
          />
        );
      case 'quote':
        return (
          <div className="border-l-4 border-blue-500 pl-4 italic">
            <input
              ref={(el) => (blockRefs.current[block.id] = el)}
              value={block.content || ''}
              onChange={(e) => handleInputChange(block.id, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, block.id, 'quote')}
              placeholder="Quote"
              className="w-full border-none outline-none bg-transparent"
              data-testid={`block-input-${block.id}`}
            />
          </div>
        );
      case 'toggle':
        const isCollapsed = collapsedToggles[block.id] !== false;
        return (
          <div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleCollapse(block.id)}
                className="text-slate-500 hover:text-slate-700 transition-transform flex-shrink-0"
                style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}
              >
                <ChevronRight size={16} />
              </button>
              <input
                ref={(el) => (blockRefs.current[block.id] = el)}
                value={block.content?.title || ''}
                onChange={(e) => handleContentChange({ ...block.content, title: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, block.id, 'toggle')}
                placeholder="Toggle"
                className="flex-1 border-none outline-none bg-transparent font-medium"
                data-testid={`block-input-${block.id}`}
              />
            </div>
            {!isCollapsed && (
              <div className="ml-6 mt-2">
                <textarea
                  value={block.content?.content || ''}
                  onChange={(e) => handleContentChange({ ...block.content, content: e.target.value })}
                  placeholder="Hidden content..."
                  className="w-full border-none outline-none bg-transparent resize-none min-h-[60px]"
                />
              </div>
            )}
          </div>
        );
      case 'todo':
        return (
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={block.content?.checked || false}
              onChange={(e) => handleContentChange({ ...block.content, checked: e.target.checked })}
              className="mt-1 w-4 h-4 rounded border-slate-300 flex-shrink-0"
              data-testid={`todo-checkbox-${block.id}`}
            />
            <input
              ref={(el) => (blockRefs.current[block.id] = el)}
              value={block.content?.text || ''}
              onChange={(e) => handleContentChange({ ...block.content, text: e.target.value })}
              onKeyDown={(e) => handleKeyDown(e, block.id, 'todo')}
              placeholder="To-do"
              className="flex-1 border-none outline-none bg-transparent"
              data-testid={`block-input-${block.id}`}
            />
          </div>
        );
      case 'divider':
        return <hr className="border-slate-300 my-4" />;
      case 'bulletList':
        return (
          <div className="flex items-start gap-3">
            <span className="text-xl mt-0.5 flex-shrink-0">•</span>
            <input
              ref={(el) => (blockRefs.current[block.id] = el)}
              value={block.content || ''}
              onChange={(e) => handleInputChange(block.id, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, block.id, 'bulletList')}
              placeholder="List item"
              className="flex-1 border-none outline-none bg-transparent"
              data-testid={`block-input-${block.id}`}
            />
          </div>
        );
      case 'numberedList':
        const index = blocks.filter(b => b.type === 'numberedList' && b.order <= block.order).length;
        return (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 font-medium flex-shrink-0">{index}.</span>
            <input
              ref={(el) => (blockRefs.current[block.id] = el)}
              value={block.content || ''}
              onChange={(e) => handleInputChange(block.id, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, block.id, 'numberedList')}
              placeholder="List item"
              className="flex-1 border-none outline-none bg-transparent"
              data-testid={`block-input-${block.id}`}
            />
          </div>
        );
      default:
        return (
          <textarea
            ref={(el) => (blockRefs.current[block.id] = el)}
            value={block.content || ''}
            onChange={(e) => handleInputChange(block.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                addBlock('paragraph', block.id);
              } else if (e.key === 'Backspace' && !block.content) {
                e.preventDefault();
                deleteBlock(block.id);
              }
            }}
            placeholder="Type '/' for commands or just start writing..."
            className="w-full border-none outline-none bg-transparent resize-none min-h-[40px]"
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
      {/* Header */}
      <div className="border-b border-slate-200 px-4 sm:px-8 py-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <span className="text-3xl sm:text-4xl flex-shrink-0">{page.icon}</span>
          {editingTitle ? (
            <input
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
              className="text-2xl sm:text-3xl font-bold border-none outline-none bg-transparent flex-1 min-w-0"
              data-testid="page-title-input"
            />
          ) : (
            <h1
              onClick={() => setEditingTitle(true)}
              className="text-2xl sm:text-3xl font-bold cursor-pointer hover:bg-slate-50 px-2 py-1 rounded flex-1 min-w-0 truncate"
              data-testid="page-title"
            >
              {page.title}
            </h1>
          )}
        </div>
        
        <Button
          onClick={() => setAiDialogOpen(true)}
          size="sm"
          className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 flex-shrink-0"
          data-testid="ai-assist-button"
        >
          <Sparkles size={16} />
          <span className="hidden sm:inline">AI</span>
        </Button>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-3xl mx-auto space-y-2">
          {blocks.map((block) => (
            <div
              key={block.id}
              className="block-container group relative py-1"
              draggable={block.type !== 'divider'}
              onDragStart={(e) => handleDragStart(e, block.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, block.id)}
            >
              <div className="block-actions flex gap-1 z-10">
                <button
                  className="p-1 hover:bg-slate-200 rounded cursor-grab active:cursor-grabbing"
                  data-testid={`block-grip-${block.id}`}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <GripVertical size={14} className="text-slate-400" />
                </button>
                <Select
                  value={block.type}
                  onValueChange={(type) => updateBlock(block.id, { 
                    type, 
                    content: type === 'divider' ? null : (type === 'todo' ? { text: '', checked: false } : (type === 'toggle' ? { title: '', content: '', collapsed: true } : '')) 
                  })}
                >
                  <SelectTrigger className="w-[32px] h-[26px] p-0 border-none shadow-none hover:bg-slate-200 z-10">
                    <div className="text-xs px-1 pointer-events-none" data-testid={`block-type-trigger-${block.id}`}>
                      <MenuIcon size={14} />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="z-50">
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
            <span className="text-sm">Add a block or press Enter</span>
          </Button>
        </div>
      </div>

      {/* Command Palette */}
      <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
        <DialogContent className="p-0 max-w-md" data-testid="command-palette">
          <Command className="rounded-lg border-none">
            <CommandInput placeholder="Type a command or search..." />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup heading="Blocks">
                {BLOCK_TYPES.map((type) => (
                  <CommandItem
                    key={type.value}
                    onSelect={() => handleCommandSelect(type.value)}
                    data-testid={`command-${type.cmd}`}
                  >
                    <span className="mr-2">{type.icon}</span>
                    <span>{type.label}</span>
                    <span className="ml-auto text-xs text-slate-400">/{type.cmd}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      {/* AI Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-md" data-testid="ai-dialog">
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