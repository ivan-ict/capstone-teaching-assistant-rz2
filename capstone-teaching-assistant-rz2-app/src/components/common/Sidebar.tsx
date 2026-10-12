import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  Users,
  Building2,
  Plus,
  Search,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Trash2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AdminActiveView, Conversation } from '../../types';
import { ConfirmDialog } from './ui/ConfirmDialog';

export const Sidebar: React.FC = () => {
  const {
    currentUser,
    activeAdminView,
    setActiveAdminView,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    conversations,
    activeConversationId,
    setActiveConversationId,
    createConversation,
    renameConversation,
    deleteConversation,
    setIsSearchModalOpen
  } = useApp();
  const admin = currentUser?.role === 'admin';
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(
    null
  );
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingConvId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingConvId]);

  const startRename = (conversation: Conversation) => {
    setEditingConvId(conversation.id);
    setEditingTitle(conversation.title);
  };

  const saveRename = (conversation: Conversation) => {
    const title = editingTitle.trim();
    if (title && title !== conversation.title)
      void renameConversation(conversation.id, title);
    setEditingConvId(null);
  };
  const readOnly =
    !currentUser?.semester || Boolean(currentUser.semester.deleted_at);
  const nav: { id: AdminActiveView; label: string; icon: typeof Users }[] = [
    { id: 'supervisors', label: 'Supervisors', icon: Users },
    { id: 'faculties', label: 'Faculties', icon: Building2 },
    { id: 'semesters', label: 'Semesters', icon: Calendar }
  ];
  return (
    <aside
      className={`${isSidebarCollapsed ? 'w-16' : 'w-72'} shrink-0 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all`}
    >
      <div
        className={`h-14 px-3 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} border-b border-slate-200 dark:border-slate-800 shrink-0`}
      >
        {!isSidebarCollapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="font-bold text-xs text-slate-800 dark:text-slate-200 tracking-wider uppercase truncate">
              {admin ? 'Admin Workspace' : 'Supervisor Workspace'}
            </span>
          </div>
        )}
        <button
          aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setIsSidebarCollapsed((v) => !v)}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
        </button>
      </div>
      {admin ? (
        <nav className="p-2 space-y-1">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              title={label}
              onClick={() => setActiveAdminView(id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold ${activeAdminView === id ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              <Icon size={18} />
              {!isSidebarCollapsed && label}
            </button>
          ))}
        </nav>
      ) : (
        <>
          <div className="p-2 space-y-1">
            <button
              title="Search conversations"
              onClick={() => setIsSearchModalOpen(true)}
              className="w-full flex gap-3 p-3 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm"
            >
              <Search size={18} />
              {!isSidebarCollapsed && 'Search conversations'}
            </button>
            <button
              title="New conversation"
              disabled={readOnly}
              onClick={() => void createConversation()}
              className="w-full flex gap-3 p-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm disabled:opacity-40"
            >
              <Plus size={18} />
              {!isSidebarCollapsed && 'New conversation'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {!isSidebarCollapsed && (
              <p className="px-3 py-2 text-xs font-bold uppercase text-slate-400">
                Conversations
              </p>
            )}
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`group flex items-center rounded-xl ${activeConversationId === conversation.id ? 'bg-blue-50 dark:bg-blue-950' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                {editingConvId === conversation.id ? (
                  <div className="flex-1 flex items-center gap-2 p-2">
                    <MessageSquare size={16} className="shrink-0 ml-1" />
                    <input
                      ref={renameInputRef}
                      aria-label="Conversation title"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => saveRename(conversation)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveRename(conversation);
                        if (e.key === 'Escape') setEditingConvId(null);
                      }}
                      className="min-w-0 flex-1 px-2 py-1 text-xs rounded-lg border border-blue-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                ) : (
                  <button
                    title={conversation.title}
                    onClick={() => setActiveConversationId(conversation.id)}
                    onDoubleClick={() => !readOnly && startRename(conversation)}
                    className={`min-w-0 flex-1 flex items-center gap-2 p-3 text-left text-xs ${activeConversationId === conversation.id ? 'text-blue-700 dark:text-blue-300 font-semibold' : 'text-slate-700 dark:text-slate-300'}`}
                  >
                    <MessageSquare size={16} className="shrink-0" />
                    {!isSidebarCollapsed && (
                      <span className="truncate">{conversation.title}</span>
                    )}
                  </button>
                )}
                {!isSidebarCollapsed &&
                  !readOnly &&
                  editingConvId !== conversation.id && (
                    <div className="flex pr-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
                      <button
                        aria-label={`Rename ${conversation.title}`}
                        className="p-1 rounded text-slate-400 hover:text-blue-600"
                        onClick={() => startRename(conversation)}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        aria-label={`Delete ${conversation.title}`}
                        className="p-1 rounded text-slate-400 hover:text-rose-600"
                        onClick={() => setPendingDelete(conversation)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
              </div>
            ))}
            {!conversations.length && !isSidebarCollapsed && (
              <p className="p-3 text-xs text-slate-400">
                No conversations in this semester.
              </p>
            )}
          </div>
        </>
      )}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete conversation"
          message={
            <>
              Delete <strong>“{pendingDelete.title}”</strong>? This cannot be
              undone.
            </>
          }
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            void deleteConversation(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      )}
    </aside>
  );
};
