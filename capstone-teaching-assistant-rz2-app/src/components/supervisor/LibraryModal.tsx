import React, { useState, useMemo } from 'react';
import { 
  X, 
  Layers, 
  Folder, 
  FileText, 
  Image as ImageIcon, 
  CheckSquare, 
  Square, 
  Plus, 
  Search,
  Check,
  Eye
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AttachedFile } from '../../types';
import { formatBytes, formatDate } from '../../utils/formatters';

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFiles: (files: AttachedFile[]) => void;
}

export const LibraryModal: React.FC<LibraryModalProps> = ({ isOpen, onClose, onSelectFiles }) => {
  const { libraryFiles, projects, previewFile } = useApp();
  const [selectedFileRows, setSelectedFileRows] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Reset selection and search whenever modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedFileRows([]);
      setSearchQuery('');
    }
  }, [isOpen]);

  // Group files by project and uncategorised
  const groupedFiles = useMemo(() => {
    const rawFiles = Array.isArray(libraryFiles) ? libraryFiles.filter(Boolean) : [];
    const rawProjects = Array.isArray(projects) ? projects.filter(Boolean) : [];
    const q = (searchQuery || '').toLowerCase().trim();

    const filtered = rawFiles.filter(f => {
      if (!f) return false;
      if (!q) return true;
      return (f.name || '').toLowerCase().includes(q);
    });

    const groups: {
      projectId: string | null;
      projectName: string;
      files: AttachedFile[];
      isUncategorised: boolean;
    }[] = [];

    // Projects
    rawProjects.forEach(p => {
      if (!p || !p.id) return;
      const pFiles = filtered.filter(f => f && f.projectIds?.includes(p.id));
      if (pFiles.length > 0 || !searchQuery) {
        groups.push({
          projectId: p.id,
          projectName: p.name || 'Untitled Project',
          files: pFiles,
          isUncategorised: false,
        });
      }
    });

    // Uncategorised (files without a current project membership)
    const existingProjectIds = new Set(rawProjects.map(p => p.id));
    const uncatFiles = filtered.filter(
      file => file && !file.projectIds?.some(projectId => existingProjectIds.has(projectId)),
    );
    if (uncatFiles.length > 0 || !searchQuery) {
      groups.push({
        projectId: null,
        projectName: 'Uncategorised',
        files: uncatFiles,
        isUncategorised: true,
      });
    }

    return groups;
  }, [libraryFiles, projects, searchQuery]);

  if (!isOpen) return null;

  const rowKey = (projectId: string | null, fileId: string) => `${projectId || 'uncategorised'}:${fileId}`;

  const toggleFile = (projectId: string | null, fileId: string) => {
    if (!fileId) return;
    const key = rowKey(projectId, fileId);
    setSelectedFileRows(prev =>
      prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key]
    );
  };

  const toggleSelectAllProject = (projectId: string | null, projectFiles: AttachedFile[]) => {
    const projectRows = projectFiles.map(file => rowKey(projectId, file.id));
    if (projectRows.length === 0) return;
    const allSelected = projectRows.every(key => selectedFileRows.includes(key));

    if (allSelected) {
      setSelectedFileRows(prev => prev.filter(key => !projectRows.includes(key)));
    } else {
      setSelectedFileRows(prev => Array.from(new Set([...prev, ...projectRows])));
    }
  };

  const handleConfirm = () => {
    const rawFiles = Array.isArray(libraryFiles) ? libraryFiles.filter(Boolean) : [];
    const selectedIds = new Set(selectedFileRows.map(key => key.slice(key.indexOf(':') + 1)));
    const chosen = rawFiles.filter(f => f && f.id && selectedIds.has(f.id));
    onSelectFiles(chosen);
    onClose();
  };

  return (
    <div 
      id="add-from-library-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
    >
      <div 
        id="add-from-library-modal"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Add from Library
              </h2>
              <p className="text-xs text-slate-500">
                Select documents, charters, or images to attach to your conversation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search files by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Groups and Tables */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {groupedFiles.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs italic">
              No files or images found in your library.
            </div>
          ) : (
            groupedFiles.map(group => {
              const allProjSelected = group.files.length > 0 && group.files.every(f => selectedFileRows.includes(rowKey(group.projectId, f.id)));

              return (
                <div key={group.projectName} className="space-y-2.5">
                  {/* Category Label with Select All for project (except Uncategorised) */}
                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-850 px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Folder className={`w-4 h-4 ${group.isUncategorised ? 'text-slate-400' : 'text-amber-500'}`} />
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                        {group.projectName}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        ({group.files.length} {group.files.length === 1 ? 'file' : 'files'})
                      </span>
                    </div>

                    {/* Select all checkbox for projects (per spec: except Uncategorised) */}
                    {!group.isUncategorised && group.files.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleSelectAllProject(group.projectId, group.files)}
                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5 cursor-pointer"
                      >
                        {allProjSelected ? (
                          <CheckSquare className="w-3.5 h-3.5" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>{allProjSelected ? 'Deselect All' : 'Select All Files'}</span>
                      </button>
                    )}
                  </div>

                  {/* Files Table under Project Label */}
                  {group.files.length === 0 ? (
                    <div className="px-3 py-2 text-[11px] text-slate-400 italic">
                      No files attached to this project.
                    </div>
                  ) : (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
                      <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                        <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-2 px-3 w-8"></th>
                            <th className="py-2 px-3">Name</th>
                            <th className="py-2 px-3">Size</th>
                            <th className="py-2 px-3">Uploaded At</th>
                            <th className="py-2 px-3 text-right w-12">Preview</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {group.files.map(file => {
                            if (!file) return null;
                            const isChecked = selectedFileRows.includes(rowKey(group.projectId, file.id));
                            return (
                              <tr
                                key={file.id}
                                onClick={() => toggleFile(group.projectId, file.id)}
                                className={`cursor-pointer transition ${
                                  isChecked 
                                    ? 'bg-blue-50/70 dark:bg-blue-950/30 text-blue-950 dark:text-blue-100 font-medium' 
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                }`}
                              >
                                <td className="py-2.5 px-3">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      toggleFile(group.projectId, file.id);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                </td>
                                <td className="py-2.5 px-3 font-medium flex items-center gap-2">
                                  {file.isImage ? (
                                    <ImageIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                  ) : (
                                    <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                  )}
                                  <span className="truncate max-w-xs">{file.name || 'Untitled Document'}</span>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                                  {formatBytes(file.size)}
                                </td>
                                <td className="py-2.5 px-3 text-[11px] text-slate-500">
                                  {formatDate(file.uploadedAt)}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      previewFile(file);
                                    }}
                                    className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition"
                                    title="Preview file"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-900">
          <div className="text-xs text-slate-500">
            <strong>{selectedFileRows.length}</strong> {selectedFileRows.length === 1 ? 'file' : 'files'} selected
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="attach-selected-library-files-btn"
              type="button"
              disabled={selectedFileRows.length === 0}
              onClick={handleConfirm}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Attach Selected ({selectedFileRows.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
