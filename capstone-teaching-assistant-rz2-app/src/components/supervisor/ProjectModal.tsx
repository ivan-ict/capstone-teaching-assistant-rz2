import React, { useState, useEffect } from 'react';
import { X, FolderPlus, Sparkles, MessageSquare } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ProjectModal: React.FC = () => {
  const { 
    isCreateProjectModalOpen, 
    setIsCreateProjectModalOpen, 
    createProject,
    pendingMoveConversationId,
    setPendingMoveConversationId,
    conversations,
    projects
  } = useApp();

  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [error, setError] = useState('');

  const pendingConv = conversations.find(c => c.id === pendingMoveConversationId);

  useEffect(() => {
    if (isCreateProjectModalOpen) {
      setName('');
      setInstructions('');
      setError('');
    }
  }, [isCreateProjectModalOpen]);

  if (!isCreateProjectModalOpen) return null;

  const handleClose = () => {
    setIsCreateProjectModalOpen(false);
    setPendingMoveConversationId(null);
    setName('');
    setInstructions('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Please provide a project name');
      return;
    }

    const isDuplicate = projects.some(p => p.name.trim().toLowerCase() === cleanName.toLowerCase());
    if (isDuplicate) {
      setError(`A project named "${cleanName}" already exists. Project names cannot be duplicated.`);
      return;
    }

    const createdProject = await createProject(cleanName, instructions);
    if (!createdProject) return;
    setName('');
    setInstructions('');
    setError('');
    setIsCreateProjectModalOpen(false);
  };

  return (
    <div 
      id="create-project-modal-backdrop"
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
    >
      <div 
        id="create-project-modal"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 flex items-center justify-center">
              <FolderPlus className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Create New Project
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Close"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          {pendingConv && (
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs flex items-center gap-2.5">
              <MessageSquare className="w-4 h-4 text-blue-500 shrink-0" />
              <span>
                Conversation <strong>"{pendingConv.title}"</strong> will be added to this project.
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Project Name *
            </label>
            <input
              id="create-project-name-input"
              type="text"
              required
              placeholder="e.g. AI Health Diagnosis Capstone 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Instructions (Optional)
              </label>
              <span className="text-[11px] text-slate-400">Context Guidelines</span>
            </div>
            <textarea
              id="create-project-instructions-input"
              rows={4}
              placeholder="Set context and customise how CTA responds in this project."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 custom-scrollbar"
            />
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              Provide project objectives, specific domain standards (e.g. IEEE formats, ROS versions, HIPAA), or grading rules.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              id="submit-create-project-btn"
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
            >
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
