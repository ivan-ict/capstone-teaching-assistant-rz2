import React, { useState, useEffect, useRef } from 'react';
import { Search, X, MessageSquare, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatDate } from '../../utils/formatters';

export const SearchConversationModal: React.FC = () => {
  const { 
    isSearchModalOpen, 
    setIsSearchModalOpen, 
    conversations, 
    searchConversations,
    setActiveConversationId, 
    setActiveSupervisorView 
  } = useApp();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState(conversations);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchModalOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isSearchModalOpen]);

  useEffect(() => {
    let cancelled = false;
    if (!isSearchModalOpen) return;
    const timer = window.setTimeout(async () => {
      if (!query.trim()) {
        setResults(conversations);
        return;
      }
      const nextResults = await searchConversations(query);
      if (!cancelled) setResults(nextResults);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [conversations, isSearchModalOpen, query, searchConversations]);

  // Keyboard shortcut Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
      if (e.key === 'Escape' && isSearchModalOpen) {
        setIsSearchModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchModalOpen, setIsSearchModalOpen]);

  if (!isSearchModalOpen) return null;

  const filteredConversations = results;

  const handleSelect = (convId: string) => {
    setActiveConversationId(convId);
    setActiveSupervisorView('chat');
    setIsSearchModalOpen(false);
  };

  return (
    <div 
      id="search-conversation-modal-backdrop"
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-start justify-center p-4 pt-16 sm:pt-24 z-50 animate-in fade-in duration-150"
    >
      <div 
        id="search-conversation-modal"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
          <input
            ref={inputRef}
            id="search-conversation-live-input"
            type="text"
            placeholder="Search conversations, rubrics, or messages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />
          <button
            onClick={() => setIsSearchModalOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2 space-y-1 divide-y divide-slate-100 dark:divide-slate-800/60">
          {filteredConversations.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 italic">
              No conversations found matching "{query}".
            </div>
          ) : (
            filteredConversations.map(conv => {
              const lastMessage = conv.messages[conv.messages.length - 1];

              return (
                <div
                  key={conv.id}
                  onClick={() => handleSelect(conv.id)}
                  className="p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition flex items-center justify-between group"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2 mb-0.5">
                      <MessageSquare className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {conv.title}
                      </span>
                    </div>

                    {lastMessage && (
                      <p className="text-[11px] text-slate-500 truncate max-w-md">
                        {lastMessage.role === 'user' ? 'You: ' : 'CTA: '}
                        {lastMessage.content}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-400">
                      {formatDate(conv.updatedAt)}
                    </span>
                    <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition">
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Navigate with click or search query</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
};
