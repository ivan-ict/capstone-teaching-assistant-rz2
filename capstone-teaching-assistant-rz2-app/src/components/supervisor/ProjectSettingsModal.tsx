import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  Trash2, 
  FileText, 
  Image as ImageIcon, 
  Check, 
  Folder, 
  Layers 
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AttachedFile } from '../../types';
import { formatBytes, formatDate } from '../../utils/formatters';

export const ProjectSettingsModal: React.FC = () => {
  const { 
    projectToEdit, 
    setProjectToEdit, 
    updateProject, 
    projects,
    libraryFiles, 
    removeFileFromProject,
  } = useApp();

  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [activeTab, setActiveTab] = useState<'general' | 'files'>('general');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fileToRemove, setFileToRemove] = useState<AttachedFile | null>(null);

  useEffect(() => {
    if (projectToEdit) {
      setName(projectToEdit.name);
      setInstructions(projectToEdit.instructions || '');
      setErrorMessage('');
      setSavedSuccess(false);
    }
  }, [projectToEdit]);

  if (!projectToEdit) return null;

  const projectFiles = libraryFiles.filter(f => f.projectIds?.includes(projectToEdit.id));

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMessage('Project name cannot be empty.');
      return;
    }

    const isDuplicate = projects.some(p => p.id !== projectToEdit.id && p.name.trim().toLowerCase() === cleanName.toLowerCase());
    if (isDuplicate) {
      setErrorMessage(`A project named "${cleanName}" already exists. Project names must be unique.`);
      return;
    }

    updateProject(projectToEdit.id, cleanName, instructions);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div 
      id="project-settings-modal-backdrop"
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
    >
      <div 
        id="project-settings-modal"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Project Settings
              </h2>
              <p className="text-xs text-slate-500 truncate max-w-sm">
                {projectToEdit.name}
              </p>
            </div>
          </div>
          <button
            onClick={() => setProjectToEdit(null)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 gap-6 shrink-0">
          <button
            id="proj-settings-tab-general"
            onClick={() => setActiveTab('general')}
            className={`py-3 text-xs font-bold border-b-2 transition ${
              activeTab === 'general'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            General & Instructions
          </button>

          <button
            id="proj-settings-tab-files"
            onClick={() => setActiveTab('files')}
            className={`py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'files'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Attached Files & Images</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {projectFiles.length}
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'general' ? (
            <form onSubmit={handleSaveGeneral} className="space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                  {errorMessage}
                </div>
              )}

              {savedSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>Project settings updated successfully!</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Project Name *
                </label>
                <input
                  id="edit-project-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Instructions & Domain Guidelines
                </label>
                <textarea
                  id="edit-project-instructions"
                  rows={5}
                  placeholder="Set context and customise how CTA responds in this project."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 custom-scrollbar"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  CTA uses these instructions to tailor rubric generation, project milestone reviews, and automated student feedback.
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  id="save-project-settings-btn"
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            /* Attached Files Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Project Context Library
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Files and images currently available for CTA reference inside this project.
                  </p>
                </div>

                {/* Direct project uploads are hidden until the backend supports project files. */}
              </div>

              {projectFiles.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-400 italic">
                  No files or images attached to this project yet.
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">File Name</th>
                        <th className="py-2.5 px-3">Size</th>
                        <th className="py-2.5 px-3">Uploaded</th>
                        <th className="py-2.5 px-3 text-right">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {projectFiles.map(file => (
                        <tr key={file.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                          <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white flex items-center gap-2">
                            {file.isImage ? (
                              <ImageIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            )}
                            <span className="truncate max-w-xs">{file.name}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                            {formatBytes(file.size)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {formatDate(file.uploadedAt)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              id={`delete-project-file-${file.id}`}
                              onClick={() => setFileToRemove(file)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                              title="Delete file"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Remove File Confirmation Modal */}
      {fileToRemove && (
        <div 
          id="delete-project-file-modal-backdrop"
          onClick={() => setFileToRemove(null)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-60 animate-in fade-in duration-150"
        >
          <div 
            id="delete-project-file-modal"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Remove File
                </h3>
                <p className="text-xs text-slate-500">
                  Are you sure you want to remove this file?
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
              File <strong className="text-slate-900 dark:text-white">"{fileToRemove.name}"</strong> will be permanently removed from this project context.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setFileToRemove(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-project-file-btn"
                type="button"
                onClick={async () => {
                  await removeFileFromProject(projectToEdit.id, fileToRemove.id);
                  setFileToRemove(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove File</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
