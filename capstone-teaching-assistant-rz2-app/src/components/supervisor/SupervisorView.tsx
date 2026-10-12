import React from 'react';
import { useApp } from '../../context/AppContext';
import { ChatArea } from './ChatArea';
import { SearchConversationModal } from './SearchConversationModal';

export const SupervisorView: React.FC = () => {
  const { currentUser } = useApp();
  const semester = currentUser?.semester;
  return (
    <div
      key={`${semester?.id}:${semester?.deleted_at}`}
      className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950"
    >
      <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200">
        <strong>{semester?.name || 'No semester assigned'}</strong>
        {semester?.deleted_at ? (
          <p role="status" className="text-amber-700 dark:text-amber-400">
            Archived semester — conversation history is read-only.
          </p>
        ) : (
          semester?.ready_file_count === 0 && (
            <p role="status" className="text-slate-500 dark:text-slate-400">
              Semester documents are unavailable. Chat can use your conversation
              history and general knowledge.
            </p>
          )
        )}
      </div>
      <ChatArea />
      <SearchConversationModal />
    </div>
  );
};
