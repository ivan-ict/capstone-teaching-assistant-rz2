import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { LoginPage } from './components/auth/LoginPage';
import { AdminView } from './components/admin/AdminView';
import { SupervisorView } from './components/supervisor/SupervisorView';
import { ProfileModal } from './components/profile/ProfileModal';
import { FilePreviewModal } from './components/common/FilePreviewModal';

const MainLayout: React.FC = () => {
  const { currentUser, fileToPreview, setFileToPreview } = useApp();

  if (!currentUser) {
    return <LoginPage />;
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased font-sans transition-colors selection:bg-blue-600 selection:text-white">
      {/* Header (Top Navigation) */}
      <Header />

      {/* Main Body with Left Sidebar + View Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left menu side bar for Admin and Supervisor */}
        <Sidebar />

        {/* Main Display Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {currentUser.role === 'admin' ? <AdminView /> : <SupervisorView />}
        </main>
      </div>

      {/* Global Profile Modal */}
      <ProfileModal />

      {/* Global File Preview Modal */}
      <FilePreviewModal 
        file={fileToPreview} 
        onClose={() => setFileToPreview(null)} 
      />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
