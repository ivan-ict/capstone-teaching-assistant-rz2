import React from 'react';
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
import { AdminActiveView } from '../../types';

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
      <button
        aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={() => setIsSidebarCollapsed((v) => !v)}
        className="p-4 self-end text-slate-500"
      >
        {isSidebarCollapsed ? (
          <PanelLeftOpen size={18} />
        ) : (
          <PanelLeftClose size={18} />
        )}
      </button>
      {admin ? (
        <nav className="px-2 space-y-1">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              title={label}
              onClick={() => setActiveAdminView(id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold ${activeAdminView === id ? 'bg-blue-50 dark:bg-blue-950 text-blue-600' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
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
              className="w-full flex gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-sm"
            >
              <Search size={18} />
              {!isSidebarCollapsed && 'Search conversations'}
            </button>
            <button
              title="New conversation"
              disabled={readOnly}
              onClick={() => void createConversation()}
              className="w-full flex gap-3 p-3 rounded-xl bg-blue-600 text-white text-sm disabled:opacity-40"
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
                <button
                  title={conversation.title}
                  onClick={() => setActiveConversationId(conversation.id)}
                  className="min-w-0 flex-1 flex items-center gap-2 p-3 text-left text-xs"
                >
                  <MessageSquare size={16} className="shrink-0" />
                  {!isSidebarCollapsed && (
                    <span className="truncate">{conversation.title}</span>
                  )}
                </button>
                {!isSidebarCollapsed && !readOnly && (
                  <div className="flex pr-1">
                    <button
                      aria-label={`Rename ${conversation.title}`}
                      className="p-1 text-slate-400 hover:text-blue-600"
                      onClick={() => {
                        const title = window.prompt(
                          'Conversation title',
                          conversation.title
                        );
                        if (title?.trim())
                          void renameConversation(conversation.id, title);
                      }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      aria-label={`Delete ${conversation.title}`}
                      className="p-1 text-slate-400 hover:text-rose-600"
                      onClick={() => {
                        if (window.confirm(`Delete “${conversation.title}”?`))
                          void deleteConversation(conversation.id);
                      }}
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
    </aside>
  );
};
