import React from 'react';
import { useApp } from '../../context/AppContext';
import { SupervisorManagement } from './SupervisorManagement';
import { FacultyManagement } from './FacultyManagement';

export const AdminView: React.FC = () => {
  const { activeAdminView } = useApp();

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 transition-colors">
      {activeAdminView === 'supervisors' && <SupervisorManagement />}
      {activeAdminView === 'faculties' && <FacultyManagement />}
    </div>
  );
};
