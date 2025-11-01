import { useState } from "react";
import { ChevronRight, ChevronDown, Plus, MoreHorizontal, Trash2, Menu, X, LogOut, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Sidebar({ 
  pages, 
  currentPageId, 
  onPageSelect, 
  onPageCreate, 
  onPageUpdate,
  onPageDelete,
  collapsed,
  onToggleCollapse,
  onLogout
}) {
  const [expandedPages, setExpandedPages] = useState({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pageToDelete, setPageToDelete] = useState(null);

  const toggleExpand = (pageId) => {
    setExpandedPages(prev => ({ ...prev, [pageId]: !prev[pageId] }));
  };

  const handleDeleteClick = (page) => {
    setPageToDelete(page);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (pageToDelete) {
      onPageDelete(pageToDelete.id);
    }
    setDeleteDialogOpen(false);
    setPageToDelete(null);
  };

  const renderPageTree = (parentId = null, level = 0) => {
    const filteredPages = pages.filter(p => p.parent_id === parentId);
    
    return filteredPages.map(page => {
      const hasChildren = pages.some(p => p.parent_id === page.id);
      const isExpanded = expandedPages[page.id];
      const isActive = page.id === currentPageId;

      return (
        <div key={page.id} className="page-tree-item" style={{ paddingLeft: `${level * 12}px` }}>
          <div
            className={`flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer group hover:bg-slate-100/80 transition-colors ${
              isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
            }`}
            data-testid={`page-item-${page.id}`}
          >
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(page.id);
                }}
                className="p-0.5 hover:bg-slate-200 rounded"
                data-testid={`expand-page-${page.id}`}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
            {!hasChildren && <div className="w-5" />}
            
            <div
              className="flex items-center gap-2 flex-1 min-w-0"
              onClick={() => onPageSelect(page.id)}
            >
              <span className="text-base flex-shrink-0">{page.icon}</span>
              <span className="text-sm truncate flex-1">{page.title}</span>
            </div>

            <div className="page-actions flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPageCreate(page.id);
                }}
                className="p-1 hover:bg-slate-200 rounded"
                title="Add subpage"
                data-testid={`add-subpage-${page.id}`}
              >
                <Plus size={14} />
              </button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-1 hover:bg-slate-200 rounded"
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`page-menu-${page.id}`}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(page);
                    }}
                    className="text-red-600"
                    data-testid={`delete-page-${page.id}`}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {hasChildren && isExpanded && (
            <div className="mt-1">
              {renderPageTree(page.id, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  if (collapsed) {
    return (
      <div className="w-16 bg-white border-r border-slate-200 flex flex-col items-center py-4 shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          data-testid="toggle-sidebar-button"
        >
          <Menu size={20} />
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-sm">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              {user.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900 truncate">{user.name}</div>
              <div className="text-xs text-slate-500 truncate">{user.email}</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="flex-shrink-0"
            data-testid="sidebar-collapse-button"
          >
            <X size={18} />
          </Button>
        </div>

        <div className="p-3 border-b border-slate-200">
          <Button
            onClick={() => onPageCreate()}
            className="w-full justify-start gap-2 h-9 bg-slate-100 hover:bg-slate-200 text-slate-700"
            data-testid="create-page-button"
          >
            <Plus size={16} />
            New Page
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto sidebar-scrollbar p-3">
          <div className="space-y-1">
            {renderPageTree()}
          </div>
          
          {pages.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No pages yet
            </div>
          )}
        </div>

        <div className="p-3 border-t border-slate-200">
          <Button
            onClick={onLogout}
            variant="ghost"
            className="w-full justify-start gap-2 text-slate-600 hover:text-red-600 hover:bg-red-50"
            data-testid="logout-button"
          >
            <LogOut size={16} />
            Logout
          </Button>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete page?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{pageToDelete?.title}" and all its subpages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-delete-button"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}