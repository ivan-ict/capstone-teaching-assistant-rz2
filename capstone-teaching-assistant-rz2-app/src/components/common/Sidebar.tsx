import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Building2, 
  Search, 
  Plus, 
  Layers, 
  Folder, 
  FolderPlus, 
  ChevronRight, 
  ChevronDown, 
  MessageSquare, 
  MoreHorizontal, 
  Settings, 
  Trash2, 
  FolderInput, 
  FolderMinus, 
  Edit3,
  PanelLeftClose,
  PanelLeft,
  ArrowLeft,
  X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Conversation, Project } from '../../types';

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen, onCloseMobile }) => {
  const { 
    currentUser,
    activeAdminView,
    setActiveAdminView,
    activeSupervisorView,
    setActiveSupervisorView,
    projects,
    conversations,
    activeConversationId,
    setActiveConversationId,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    expandedProjectIds,
    toggleProjectExpanded,
    createConversation,
    renameConversation,
    deleteConversation,
    moveConversationToProject,
    setIsSearchModalOpen,
    setIsCreateProjectModalOpen,
    setPendingMoveConversationId,
    setProjectToEdit,
    deleteProject
  } = useApp();

  const isAdmin = currentUser?.role === 'admin';

  // State for popover action menus
  const [activeMenuProjId, setActiveMenuProjId] = useState<string | null>(null);
  const [activeMenuConvId, setActiveMenuConvId] = useState<string | null>(null);

  // Collapsed Sidebar popovers state
  const [isCollapsedRecentOpen, setIsCollapsedRecentOpen] = useState(false);
  const [isCollapsedProjectsOpen, setIsCollapsedProjectsOpen] = useState(false);
  const [collapsedSearchQuery, setCollapsedSearchQuery] = useState('');
  const [collapsedExpandedProjIds, setCollapsedExpandedProjIds] = useState<string[]>([]);
  const collapsedRecentRef = useRef<HTMLDivElement>(null);
  const collapsedProjectsRef = useRef<HTMLDivElement>(null);

  // Rename conversation state
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation modals
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown-container]')) {
        setActiveMenuProjId(null);
        setActiveMenuConvId(null);
      }
      if (collapsedRecentRef.current && !collapsedRecentRef.current.contains(e.target as Node)) {
        setIsCollapsedRecentOpen(false);
      }
      if (collapsedProjectsRef.current && !collapsedProjectsRef.current.contains(e.target as Node)) {
        setIsCollapsedProjectsOpen(false);
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  // Focus rename input on start
  useEffect(() => {
    if (editingConvId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingConvId]);

  // Group conversations by project and standalone recent
  const projectConversationsMap: Record<string, Conversation[]> = {};
  projects.forEach(p => {
    projectConversationsMap[p.id] = [];
  });

  const recentConversations: Conversation[] = [];
  conversations.forEach(conv => {
    if (conv.projectId && projectConversationsMap[conv.projectId]) {
      projectConversationsMap[conv.projectId].push(conv);
    } else {
      recentConversations.push(conv);
    }
  });

  // Filtered conversations for collapsed recent popover
  const filteredCollapsedConversations = conversations.filter(c => {
    if (!collapsedSearchQuery.trim()) return true;
    return c.title.toLowerCase().includes(collapsedSearchQuery.toLowerCase());
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const handleStartRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConvId(conv.id);
    setEditingTitle(conv.title);
    setActiveMenuConvId(null);
  };

  const handleSaveRename = (convId: string) => {
    if (editingTitle.trim()) {
      renameConversation(convId, editingTitle.trim());
    }
    setEditingConvId(null);
  };

  const handleCreateNewChat = async (projectId: string | null = null, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newConv = await createConversation(projectId);
    if (!newConv) return;
    setActiveConversationId(newConv.id);
    setActiveSupervisorView('chat');
    setIsCollapsedRecentOpen(false);
    if (onCloseMobile) onCloseMobile();
  };

  // Reusable Nav Tooltip for collapsed mode
  const NavTooltip = ({ text, shortcut }: { text: string; shortcut?: string }) => {
    if (!isSidebarCollapsed) return null;
    return (
      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:visible invisible transition-all duration-150 border border-slate-700/60 flex items-center gap-1.5 shadow-slate-950/40 select-none">
        <span>{text}</span>
        {shortcut && (
          <kbd className="text-[10px] bg-slate-800 dark:bg-slate-700 text-slate-300 px-1 py-0.5 rounded font-mono border border-slate-700">
            {shortcut}
          </kbd>
        )}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900 dark:border-r-slate-800" />
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          id="sidebar-mobile-backdrop"
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        id="app-sidebar"
        className={`
          fixed md:static inset-y-0 left-0 z-40
          flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800 select-none
          transition-all duration-300 ease-in-out
          ${isSidebarCollapsed ? 'md:w-16 w-64' : 'w-64'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Top bar: Consistent Header & Hide / Expand Toggle */}
        <div className="h-14 px-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shrink-0">
          {!isSidebarCollapsed ? (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200 tracking-wider uppercase">
                {isAdmin ? 'Admin Workspace' : 'Supervisor Workspace'}
              </span>
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            </div>
          )}

          {/* Toggle expand/collapse button */}
          <button
            id="sidebar-collapse-toggle-btn"
            onClick={() => setIsSidebarCollapsed((prev: boolean) => !prev)}
            className="hidden md:flex p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition cursor-pointer relative group"
            aria-label="Toggle sidebar collapse"
          >
            {isSidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            <NavTooltip text={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} />
          </button>
        </div>

        {/* ADMIN SIDEBAR CONTENT */}
        {isAdmin ? (
          <div className={`flex-1 p-2 space-y-1.5 ${isSidebarCollapsed ? 'overflow-visible' : 'overflow-y-auto custom-scrollbar'}`}>
            <button
              id="admin-nav-supervisors"
              onClick={() => {
                setActiveAdminView('supervisors');
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'} rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer relative group ${
                activeAdminView === 'supervisors'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              {!isSidebarCollapsed && <span>Supervisors</span>}
              <NavTooltip text="Supervisors Management" />
            </button>

            <button
              id="admin-nav-faculties"
              onClick={() => {
                setActiveAdminView('faculties');
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'} rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer relative group ${
                activeAdminView === 'faculties'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              {!isSidebarCollapsed && <span>Faculties</span>}
              <NavTooltip text="Faculties Management" />
            </button>
          </div>
        ) : (
          /* SUPERVISOR SIDEBAR CONTENT */
          <div className={`flex-1 flex flex-col min-h-0 px-2 py-3 space-y-4 ${isSidebarCollapsed ? 'overflow-visible' : 'overflow-y-auto custom-scrollbar'}`}>
            {/* Top Action Items */}
            <div className="space-y-1.5 shrink-0">
              {/* Search Conversation */}
              <button
                id="supervisor-search-conversation-btn"
                onClick={() => setIsSearchModalOpen(true)}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'} rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition group relative cursor-pointer`}
              >
                <Search className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition shrink-0" />
                {!isSidebarCollapsed && (
                  <div className="flex-1 flex items-center justify-between">
                    <span>Search Conversations</span>
                    <kbd className="text-[10px] bg-slate-200/80 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-300/80 dark:border-slate-700 font-mono">
                      ⌘K
                    </kbd>
                  </div>
                )}
                <NavTooltip text="Search Conversations" shortcut="⌘K" />
              </button>

              {/* New Conversation Button */}
              <button
                id="supervisor-new-conversation-btn"
                onClick={(e) => handleCreateNewChat(null, e)}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'} rounded-xl text-xs font-medium bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700/80 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 transition group relative cursor-pointer`}
              >
                <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:rotate-90 transition-transform shrink-0" />
                {!isSidebarCollapsed && <span>New conversation</span>}
                <NavTooltip text="New conversation" />
              </button>

              {/* Library Button */}
              <button
                id="supervisor-library-btn"
                onClick={() => {
                  setActiveSupervisorView('library');
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'} rounded-xl text-xs font-medium transition group relative cursor-pointer ${
                  activeSupervisorView === 'library'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-4 h-4 shrink-0" />
                {!isSidebarCollapsed && <span>Library</span>}
                <NavTooltip text="Library" />
              </button>

              {/* Collapsed Mode: Recent Conversations Trigger & Flyout Popover */}
              {isSidebarCollapsed && (
                <div className="relative" ref={collapsedRecentRef}>
                  <button
                    id="supervisor-recent-conversations-collapsed-btn"
                    onClick={() => {
                      setIsCollapsedRecentOpen(prev => !prev);
                      setIsCollapsedProjectsOpen(false);
                    }}
                    className={`w-full flex items-center justify-center p-2.5 rounded-xl text-xs font-medium transition group relative cursor-pointer ${
                      isCollapsedRecentOpen || (activeSupervisorView === 'chat' && activeConversationId)
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    {conversations.length > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white dark:ring-slate-900" />
                    )}
                    <NavTooltip text="Recent Conversations" />
                  </button>

                  {/* Clean, Simple Recent Conversations Popover */}
                  {isCollapsedRecentOpen && (
                    <div 
                      id="collapsed-recent-conversations-popover"
                      className="absolute left-full top-0 ml-3 w-72 max-h-[80vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3 z-50 flex flex-col animate-in fade-in zoom-in-95 duration-150"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                            Recent Conversations
                          </span>
                          <span className="text-[11px] text-slate-400">({conversations.length})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            id="collapsed-popover-new-chat-btn"
                            onClick={(e) => {
                              setIsCollapsedRecentOpen(false);
                              handleCreateNewChat(null, e);
                            }}
                            className="p-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/60 text-blue-600 dark:text-blue-400 transition cursor-pointer"
                            title="New Conversation"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id="close-collapsed-recent-popover-btn"
                            onClick={() => setIsCollapsedRecentOpen(false)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Filter if more than 3 conversations */}
                      {conversations.length > 3 && (
                        <div className="relative mb-2">
                          <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                          <input
                            id="collapsed-popover-search-input"
                            type="text"
                            placeholder="Filter chats..."
                            value={collapsedSearchQuery}
                            onChange={(e) => setCollapsedSearchQuery(e.target.value)}
                            className="w-full pl-7 pr-6 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          {collapsedSearchQuery && (
                            <button
                              onClick={() => setCollapsedSearchQuery('')}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Streamlined Conversation list */}
                      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-0.5 max-h-64 pr-0.5">
                        {filteredCollapsedConversations.length === 0 ? (
                          <div className="py-6 text-center text-xs text-slate-400 italic">
                            {collapsedSearchQuery ? 'No chats found' : 'No chats yet'}
                          </div>
                        ) : (
                          filteredCollapsedConversations.map(conv => {
                            const isSelected = activeConversationId === conv.id && activeSupervisorView === 'chat';
                            return (
                              <button
                                key={conv.id}
                                id={`collapsed-popover-conv-${conv.id}`}
                                onClick={() => {
                                  setActiveConversationId(conv.id);
                                  setActiveSupervisorView('chat');
                                  setIsCollapsedRecentOpen(false);
                                  if (onCloseMobile) onCloseMobile();
                                }}
                                className={`w-full text-left px-2.5 py-2 rounded-xl text-xs transition flex items-center gap-2 cursor-pointer ${
                                  isSelected
                                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                              >
                                <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                                <span className="truncate flex-1">{conv.title}</span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Collapsed Mode: Projects Trigger & Popover */}
              {isSidebarCollapsed && (
                <div className="relative" ref={collapsedProjectsRef}>
                  <button
                    id="supervisor-projects-collapsed-btn"
                    onClick={() => {
                      setIsCollapsedProjectsOpen(prev => !prev);
                      setIsCollapsedRecentOpen(false);
                    }}
                    className={`w-full flex items-center justify-center p-2.5 rounded-xl text-xs font-medium transition group relative cursor-pointer ${
                      isCollapsedProjectsOpen
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Folder className="w-4 h-4 shrink-0" />
                    {projects.length > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
                    )}
                    <NavTooltip text="Projects" />
                  </button>

                  {/* Projects Popover */}
                  {isCollapsedProjectsOpen && (
                    <div 
                      id="collapsed-projects-popover"
                      className="absolute left-full top-0 ml-3 w-80 max-h-[82vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3 z-50 flex flex-col animate-in fade-in zoom-in-95 duration-150"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-1.5">
                          <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                            Projects
                          </span>
                          <span className="text-[11px] text-slate-400">({projects.length})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            id="collapsed-popover-new-proj-btn"
                            onClick={() => {
                              setIsCollapsedProjectsOpen(false);
                              setIsCreateProjectModalOpen(true);
                            }}
                            className="p-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/60 text-blue-600 dark:text-blue-400 transition cursor-pointer"
                            title="New Project"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id="close-collapsed-projects-popover-btn"
                            onClick={() => setIsCollapsedProjectsOpen(false)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Project List */}
                      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 max-h-72 pr-0.5">
                        {projects.length === 0 ? (
                          <div className="py-6 text-center space-y-2">
                            <p className="text-xs text-slate-400 italic">No projects created yet</p>
                            <button
                              id="create-first-project-collapsed-btn"
                              onClick={() => {
                                setIsCollapsedProjectsOpen(false);
                                setIsCreateProjectModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-xs font-semibold hover:bg-blue-100 transition cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Create First Project</span>
                            </button>
                          </div>
                        ) : (
                          projects.map(proj => {
                            const projConvs = projectConversationsMap[proj.id] || [];
                            const isExpanded = collapsedExpandedProjIds.includes(proj.id);
                            return (
                              <div key={proj.id} className="rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 overflow-hidden">
                                <div className="flex items-center justify-between p-2 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition">
                                  <button
                                    onClick={() => {
                                      setCollapsedExpandedProjIds(prev => 
                                        prev.includes(proj.id) ? prev.filter(id => id !== proj.id) : [...prev, proj.id]
                                      );
                                    }}
                                    className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                                  >
                                    <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                    <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                    <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">
                                      {proj.name}
                                    </span>
                                    <span className="text-[10px] text-slate-400">({projConvs.length})</span>
                                  </button>

                                  <div className="flex items-center gap-0.5 shrink-0">
                                    <button
                                      id={`collapsed-proj-new-chat-${proj.id}`}
                                      onClick={(e) => {
                                        setIsCollapsedProjectsOpen(false);
                                        handleCreateNewChat(proj.id, e);
                                      }}
                                      className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition cursor-pointer"
                                      title="New chat in this project"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                    <button
                                      id={`collapsed-proj-settings-${proj.id}`}
                                      onClick={() => {
                                        setIsCollapsedProjectsOpen(false);
                                        setProjectToEdit(proj);
                                      }}
                                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                                      title="Project settings"
                                    >
                                      <Settings className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>

                                {/* Expanded conversations within project */}
                                {isExpanded && (
                                  <div className="px-2 pb-2 pt-1 border-t border-slate-200/50 dark:border-slate-800/50 space-y-0.5 bg-white/70 dark:bg-slate-900/50">
                                    {projConvs.length === 0 ? (
                                      <div className="py-1 text-center text-[11px] text-slate-400 italic">
                                        No chats in this project
                                      </div>
                                    ) : (
                                      projConvs.map(c => {
                                        const isChatActive = activeConversationId === c.id && activeSupervisorView === 'chat';
                                        return (
                                          <button
                                            key={c.id}
                                            onClick={() => {
                                              setActiveConversationId(c.id);
                                              setActiveSupervisorView('chat');
                                              setIsCollapsedProjectsOpen(false);
                                              if (onCloseMobile) onCloseMobile();
                                            }}
                                            className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer ${
                                              isChatActive
                                                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                            }`}
                                          >
                                            <MessageSquare className={`w-3 h-3 shrink-0 ${isChatActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                                            <span className="truncate flex-1 text-[11px]">{c.title}</span>
                                          </button>
                                        );
                                      })
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* PROJECTS SECTION */}
            {!isSidebarCollapsed ? (
              <div className="space-y-1 shrink-0">
                {/* Header label with create project icon */}
                <div className="px-3 py-1 flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    Projects
                  </span>
                  <button
                    id="create-project-icon-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingMoveConversationId(null);
                      setIsCreateProjectModalOpen(true);
                    }}
                    className="p-1 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition cursor-pointer"
                    title="Create Project"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  </button>
                </div>

                {/* Projects list */}
                <div className="space-y-1">
                  {projects.length === 0 ? (
                    <div className="px-3 py-2 text-[11px] text-slate-400 dark:text-slate-500 italic">
                      No projects created yet
                    </div>
                  ) : (
                    projects.map((proj) => {
                      const isExpanded = expandedProjectIds.includes(proj.id);
                      const projConvs = projectConversationsMap[proj.id] || [];
                      const isMenuOpen = activeMenuProjId === proj.id;

                      return (
                        <div 
                          key={proj.id} 
                          className={`rounded-xl group/proj ${isMenuOpen ? 'relative z-30' : 'relative'}`}
                          data-dropdown-container
                        >
                          {/* Project row */}
                          <div 
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800/80 cursor-pointer text-xs font-medium text-slate-800 dark:text-slate-200 transition"
                            onClick={() => toggleProjectExpanded(proj.id)}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              )}
                              <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span className="truncate">{proj.name}</span>
                            </div>

                            {/* Project quick actions: + new chat, ... more */}
                            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover/proj:opacity-100 transition" onClick={e => e.stopPropagation()}>
                              <button
                                id={`project-new-chat-${proj.id}`}
                                onClick={(e) => handleCreateNewChat(proj.id, e)}
                                className="p-1 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-300/60 dark:hover:bg-slate-700 transition cursor-pointer"
                                title="New chat in project"
                              >
                                <Plus className="w-3 h-3" />
                              </button>

                              <div className="relative">
                                <button
                                  id={`project-more-options-${proj.id}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuProjId(isMenuOpen ? null : proj.id);
                                    setActiveMenuConvId(null);
                                  }}
                                  className={`p-1 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-300/60 dark:hover:bg-slate-700 transition cursor-pointer ${isMenuOpen ? 'bg-slate-300/60 dark:bg-slate-700 text-slate-900 dark:text-white opacity-100' : ''}`}
                                  title="Project options"
                                >
                                  <MoreHorizontal className="w-3 h-3" />
                                </button>

                                {/* Project menu popup */}
                                {isMenuOpen && (
                                  <div 
                                    className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-100 dark:divide-slate-700"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="py-0.5">
                                      <button
                                        id={`project-settings-${proj.id}`}
                                        onClick={() => {
                                          setProjectToEdit(proj);
                                          setActiveMenuProjId(null);
                                        }}
                                        className="w-full px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 cursor-pointer"
                                      >
                                        <Settings className="w-3.5 h-3.5 text-slate-400" />
                                        <span>Project Settings</span>
                                      </button>
                                    </div>
                                    <div className="py-0.5">
                                      <button
                                        id={`project-delete-${proj.id}`}
                                        onClick={() => {
                                          setProjectToDelete(proj);
                                          setActiveMenuProjId(null);
                                        }}
                                        className="w-full px-3 py-1.5 text-left text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Delete Project</span>
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Expanded project conversations */}
                          {isExpanded && (
                            <div className="pl-5 pr-1 py-0.5 space-y-0.5 border-l border-slate-200 dark:border-slate-800 ml-3.5 my-0.5">
                              {projConvs.length === 0 ? (
                                <div className="py-1 text-[11px] text-slate-400 dark:text-slate-500 italic">
                                  No conversations yet
                                </div>
                              ) : (
                                projConvs.map(conv => (
                                  <ConversationItem
                                    key={conv.id}
                                    conv={conv}
                                    isActive={activeConversationId === conv.id && activeSupervisorView === 'chat'}
                                    isInProject={true}
                                    currentProjectId={proj.id}
                                    projects={projects}
                                    activeMenuConvId={activeMenuConvId}
                                    setActiveMenuConvId={setActiveMenuConvId}
                                    editingConvId={editingConvId}
                                    editingTitle={editingTitle}
                                    setEditingTitle={setEditingTitle}
                                    renameInputRef={renameInputRef}
                                    onSaveRename={handleSaveRename}
                                    onStartRename={handleStartRename}
                                    onSelect={() => {
                                      setActiveConversationId(conv.id);
                                      setActiveSupervisorView('chat');
                                      if (onCloseMobile) onCloseMobile();
                                    }}
                                    onDelete={() => {
                                      setConversationToDelete(conv);
                                      setActiveMenuConvId(null);
                                    }}
                                    onMoveToProject={(targetProjId) => {
                                      moveConversationToProject(conv.id, targetProjId);
                                      setActiveMenuConvId(null);
                                    }}
                                    onRemoveFromProject={() => {
                                      moveConversationToProject(conv.id, null);
                                      setActiveMenuConvId(null);
                                    }}
                                    onOpenNewProject={() => {
                                      setActiveMenuConvId(null);
                                      setPendingMoveConversationId(conv.id);
                                      setIsCreateProjectModalOpen(true);
                                    }}
                                  />
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}

            {/* RECENT CONVERSATIONS SECTION */}
            {!isSidebarCollapsed ? (
              <div className="space-y-1 flex-1">
                <div className="px-3 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  Recent Conversations
                </div>

                <div className="space-y-0.5">
                  {recentConversations.length === 0 ? (
                    <div className="px-3 py-2 text-[11px] text-slate-400 dark:text-slate-500 italic">
                      No recent conversations
                    </div>
                  ) : (
                    recentConversations.map(conv => (
                      <ConversationItem
                        key={conv.id}
                        conv={conv}
                        isActive={activeConversationId === conv.id && activeSupervisorView === 'chat'}
                        isInProject={false}
                        currentProjectId={null}
                        projects={projects}
                        activeMenuConvId={activeMenuConvId}
                        setActiveMenuConvId={setActiveMenuConvId}
                        editingConvId={editingConvId}
                        editingTitle={editingTitle}
                        setEditingTitle={setEditingTitle}
                        renameInputRef={renameInputRef}
                        onSaveRename={handleSaveRename}
                        onStartRename={handleStartRename}
                        onSelect={() => {
                          setActiveConversationId(conv.id);
                          setActiveSupervisorView('chat');
                          if (onCloseMobile) onCloseMobile();
                        }}
                        onDelete={() => {
                          setConversationToDelete(conv);
                          setActiveMenuConvId(null);
                        }}
                        onMoveToProject={(targetProjId) => {
                          moveConversationToProject(conv.id, targetProjId);
                          setActiveMenuConvId(null);
                        }}
                        onRemoveFromProject={() => {}}
                        onOpenNewProject={() => {
                          setActiveMenuConvId(null);
                          setPendingMoveConversationId(conv.id);
                          setIsCreateProjectModalOpen(true);
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </aside>

      {/* Delete Project Confirmation Modal */}
      {projectToDelete && (
        <div 
          id="delete-project-modal-backdrop"
          onClick={() => setProjectToDelete(null)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
        >
          <div 
            id="delete-project-modal"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            
            <div className="text-center space-y-1">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Delete Project</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Are you sure you want to delete <span className="font-semibold text-slate-800 dark:text-slate-200">"{projectToDelete.name}"</span>? Conversations inside will be unassigned and kept in recent chats.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                id="cancel-delete-project-btn"
                onClick={() => setProjectToDelete(null)}
                className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-project-btn"
                onClick={() => {
                  deleteProject(projectToDelete.id);
                  setProjectToDelete(null);
                }}
                className="flex-1 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Conversation Confirmation Modal */}
      {conversationToDelete && (
        <div 
          id="delete-conversation-modal-backdrop"
          onClick={() => setConversationToDelete(null)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
        >
          <div 
            id="delete-conversation-modal"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            
            <div className="text-center space-y-1">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Delete Conversation</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Are you sure you want to delete <span className="font-semibold text-slate-800 dark:text-slate-200">"{conversationToDelete.title}"</span>? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                id="cancel-delete-conversation-btn"
                onClick={() => setConversationToDelete(null)}
                className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-conversation-btn"
                onClick={() => {
                  deleteConversation(conversationToDelete.id);
                  setConversationToDelete(null);
                }}
                className="flex-1 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

interface ConversationItemProps {
  conv: Conversation;
  isActive: boolean;
  isInProject: boolean;
  currentProjectId: string | null;
  projects: Project[];
  activeMenuConvId: string | null;
  setActiveMenuConvId: (id: string | null) => void;
  editingConvId: string | null;
  editingTitle: string;
  setEditingTitle: (t: string) => void;
  renameInputRef: React.RefObject<HTMLInputElement>;
  onSaveRename: (id: string) => void;
  onStartRename: (conv: Conversation, e: React.MouseEvent) => void;
  onSelect: () => void;
  onDelete: () => void;
  onMoveToProject: (targetProjId: string) => void;
  onRemoveFromProject: () => void;
  onOpenNewProject: () => void;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conv,
  isActive,
  isInProject,
  currentProjectId,
  projects,
  activeMenuConvId,
  setActiveMenuConvId,
  editingConvId,
  editingTitle,
  setEditingTitle,
  renameInputRef,
  onSaveRename,
  onStartRename,
  onSelect,
  onDelete,
  onMoveToProject,
  onRemoveFromProject,
  onOpenNewProject,
}) => {
  const isMenuOpen = activeMenuConvId === conv.id;
  const isEditing = editingConvId === conv.id;
  const [menuView, setMenuView] = useState<'main' | 'move'>('main');

  // Reset menu view when menu is closed or changed
  useEffect(() => {
    if (!isMenuOpen) {
      setMenuView('main');
    }
  }, [isMenuOpen]);

  return (
    <div
      className={`relative group/conv flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition cursor-pointer ${
        isMenuOpen ? 'z-30 bg-slate-200/80 dark:bg-slate-800' : ''
      } ${
        isActive
          ? 'bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-white font-medium border border-blue-200 dark:border-slate-700/80 shadow-2xs'
          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
      }`}
      onClick={onSelect}
      data-dropdown-container
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
        {isEditing ? (
          <input
            ref={renameInputRef}
            type="text"
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onBlur={() => onSaveRename(conv.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveRename(conv.id);
              if (e.key === 'Escape') onSaveRename(conv.id);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-white px-1.5 py-0.5 rounded text-xs border border-blue-500 focus:outline-none"
          />
        ) : (
          <span className="truncate">{conv.title}</span>
        )}
      </div>

      {/* Action Trigger "..." */}
      {!isEditing && (
        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            id={`conversation-actions-btn-${conv.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setMenuView('main');
              setActiveMenuConvId(isMenuOpen ? null : conv.id);
            }}
            className={`p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-300/60 dark:hover:bg-slate-700 transition cursor-pointer ${
              isMenuOpen ? 'opacity-100 bg-slate-300/60 dark:bg-slate-700 text-slate-900 dark:text-white' : 'opacity-0 group-hover/conv:opacity-100'
            }`}
            title="More actions"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>

          {/* Action Menu Popup */}
          {isMenuOpen && (
            <div 
              className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-100 dark:divide-slate-700/60"
              onClick={(e) => e.stopPropagation()}
            >
              {menuView === 'move' ? (
                /* Move to Project Embedded View */
                <div className="py-1">
                  <div className="px-2.5 py-1 flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 mb-1">
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <FolderInput className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      Move to Project
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuView('main');
                      }}
                      className="text-[10px] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-0.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      Back
                    </button>
                  </div>

                  {/* Option: New Project */}
                  <button
                    id={`conv-move-new-project-${conv.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenNewProject();
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs text-blue-600 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 font-medium cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span>New Project...</span>
                  </button>

                  {/* List of existing projects */}
                  <div className="max-h-40 overflow-y-auto custom-scrollbar pt-1 border-t border-slate-100 dark:border-slate-700/40">
                    {projects.length === 0 ? (
                      <div className="px-3 py-2 text-[11px] text-slate-400 dark:text-slate-400 italic">
                        No projects created yet
                      </div>
                    ) : (
                      projects.map((p) => {
                        const isCurrent = p.id === currentProjectId;
                        return (
                          <button
                            key={p.id}
                            id={`conv-move-to-${p.id}`}
                            disabled={isCurrent}
                            onClick={(e) => {
                              e.stopPropagation();
                              onMoveToProject(p.id);
                            }}
                            className={`w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 transition ${
                              isCurrent
                                ? 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/60 cursor-default'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer'
                            }`}
                          >
                            <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span className="truncate flex-1">{p.name}</span>
                            {isCurrent && (
                              <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">
                                Current
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                /* Main Conversation Options */
                <>
                  <div className="py-0.5">
                    {/* Rename */}
                    <button
                      id={`conv-action-rename-${conv.id}`}
                      onClick={(e) => onStartRename(conv, e)}
                      className="w-full px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Rename</span>
                    </button>

                    {/* Move to project trigger */}
                    <button
                      id={`conv-action-move-${conv.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuView('move');
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <FolderInput className="w-3.5 h-3.5 text-slate-400" />
                        <span>Move to project</span>
                      </span>
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                    </button>

                    {/* Remove from project if currently inside one */}
                    {isInProject && (
                      <button
                        id={`conv-action-remove-from-project-${conv.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveFromProject();
                        }}
                        className="w-full px-3 py-1.5 text-left text-xs text-amber-600 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 cursor-pointer"
                      >
                        <FolderMinus className="w-3.5 h-3.5" />
                        <span>Remove from project</span>
                      </button>
                    )}
                  </div>

                  {/* Delete */}
                  <div className="py-0.5">
                    <button
                      id={`conv-action-delete-${conv.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
