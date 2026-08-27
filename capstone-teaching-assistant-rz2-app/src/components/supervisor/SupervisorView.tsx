import React from 'react';
import { useApp } from '../../context/AppContext';
import { ChatArea } from './ChatArea';
import { LibraryView } from './LibraryView';
import { ProjectModal } from './ProjectModal';
import { ProjectSettingsModal } from './ProjectSettingsModal';
import { SearchConversationModal } from './SearchConversationModal';

export const SupervisorView: React.FC = () => {
  const { activeSupervisorView } = useApp();

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors">
      {activeSupervisorView === 'chat' && <ChatArea />}
      {activeSupervisorView === 'library' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <LibraryView />
        </div>
      )}

      {/* Global Supervisor Modals */}
      <ProjectModal />
      <ProjectSettingsModal />
      <SearchConversationModal />
    </div>
  );
};
