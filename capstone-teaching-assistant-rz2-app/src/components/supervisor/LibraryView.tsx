import React, { useState, useMemo, useRef } from 'react';
import { 
  Layers, 
  Upload, 
  Trash2, 
  Download, 
  MessageSquarePlus, 
  Search, 
  Folder, 
  FileText, 
  Image as ImageIcon, 
  CheckSquare, 
  Square, 
  Plus, 
  X, 
  CheckCircle2, 
  Filter,
  Eye 
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AttachedFile } from '../../types';
import { formatBytes, formatDate } from '../../utils/formatters';

export const LibraryView: React.FC = () => {
  const { 
    libraryFiles, 
    projects, 
    uploadFiles, 
    deleteFile, 
    deleteFilesBulk, 
    startConversationWithFiles, 
    setActiveSupervisorView,
    previewFile,
    downloadFile
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTargetProjectId, setUploadTargetProjectId] = useState<string>('UNCATEGORISED');
  const [isUploading, setIsUploading] = useState(false);

  // Deletion modal state
  const [fileToDelete, setFileToDelete] = useState<AttachedFile | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Group files by Project and Uncategorised
  const groupedFiles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = libraryFiles.filter(f => !q || f.name.toLowerCase().includes(q));

    const groups: {
      projectId: string | null;
      projectName: string;
      files: AttachedFile[];
      isUncategorised: boolean;
    }[] = [];

    // Projects
    projects.forEach(p => {
      const pFiles = filtered.filter(f => f.projectId === p.id);
      groups.push({
        projectId: p.id,
        projectName: p.name,
        files: pFiles,
        isUncategorised: false,
      });
    });

    // Uncategorised
    const uncatFiles = filtered.filter(f => !f.projectId);
    groups.push({
      projectId: null,
      projectName: 'Uncategorised',
      files: uncatFiles,
      isUncategorised: true,
    });

    return groups;
  }, [libraryFiles, projects, searchQuery]);

  const toggleSelectFile = (fileId: string) => {
    setSelectedFileIds(prev => 
      prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
    );
  };

  const toggleSelectAllProject = (projectFiles: AttachedFile[]) => {
    const projIds = projectFiles.map(f => f.id);
    if (projIds.length === 0) return;
    const allSelected = projIds.every(id => selectedFileIds.includes(id));

    if (allSelected) {
      setSelectedFileIds(prev => prev.filter(id => !projIds.includes(id)));
    } else {
      setSelectedFileIds(prev => Array.from(new Set([...prev, ...projIds])));
    }
  };

  // Bulk actions
  const handleDeleteSelected = () => {
    if (selectedFileIds.length === 0) return;
    setIsBulkDeleteModalOpen(true);
  };

  const confirmBulkDelete = () => {
    deleteFilesBulk(selectedFileIds);
    setSelectedFileIds([]);
    setIsBulkDeleteModalOpen(false);
  };

  const confirmSingleDelete = () => {
    if (fileToDelete) {
      deleteFile(fileToDelete.id);
      setSelectedFileIds(prev => prev.filter(id => id !== fileToDelete.id));
      setFileToDelete(null);
    }
  };

  const handleDownloadSelected = () => {
    if (selectedFileIds.length === 0) return;
    const filesToDownload = libraryFiles.filter(f => selectedFileIds.includes(f.id));
    filesToDownload.forEach(f => downloadFile(f));
  };

  const handleStartConversationWithSelected = () => {
    if (selectedFileIds.length === 0) return;
    const chosenFiles = libraryFiles.filter(f => selectedFileIds.includes(f.id));
    startConversationWithFiles(chosenFiles);
  };

  // Upload handlers
  const handleUploadSubmit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploading(true);
    const targetProj = uploadTargetProjectId === 'UNCATEGORISED' ? null : uploadTargetProjectId;
    await uploadFiles(e.target.files, targetProj);
    setIsUploading(false);
    setIsUploadModalOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-blue-600" />
            File & Document Library
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage project charters, student submission files, biomedical diagrams, and uncategorised documents.
          </p>
        </div>

        <button
          id="open-upload-modal-btn"
          onClick={() => setIsUploadModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-blue-500/20 hover:shadow-blue-500/30 transition cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Files & Images</span>
        </button>
      </div>

      {/* Search and summary */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative max-w-md w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="library-search-input"
            type="text"
            placeholder="Search files by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-2">
          <span>Total: <strong>{libraryFiles.length}</strong> files</span>
          <span>&bull;</span>
          <span>Selected: <strong className="text-blue-600 dark:text-blue-400">{selectedFileIds.length}</strong></span>
        </div>
      </div>

      {/* Bulk Action Toolbar (Floating when items selected) */}
      {selectedFileIds.length > 0 && (
        <div 
          id="library-bulk-actions-bar"
          className="sticky top-16 z-20 bg-blue-600 text-white p-3 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-150"
        >
          <div className="flex items-center gap-2 text-xs font-bold pl-2">
            <CheckSquare className="w-4 h-4" />
            <span>{selectedFileIds.length} files selected</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Start conversation */}
            <button
              id="bulk-start-conversation-btn"
              onClick={handleStartConversationWithSelected}
              className="px-3 py-1.5 rounded-xl bg-white text-blue-700 hover:bg-blue-50 text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              <span>Start Conversation</span>
            </button>

            {/* Download */}
            <button
              id="bulk-download-btn"
              onClick={handleDownloadSelected}
              className="px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5 cursor-pointer border border-blue-500"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>

            {/* Delete */}
            <button
              id="bulk-delete-btn"
              onClick={handleDeleteSelected}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>

            <button
              onClick={() => setSelectedFileIds([])}
              className="p-1.5 rounded-lg text-blue-200 hover:text-white transition"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Categorized File Groups & Tables */}
      <div className="space-y-6">
        {groupedFiles.map(group => {
          const allSelected = group.files.length > 0 && group.files.every(f => selectedFileIds.includes(f.id));

          return (
            <div 
              key={group.projectName} 
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden"
            >
              {/* Category Header */}
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Folder className={`w-4 h-4 ${group.isUncategorised ? 'text-slate-400' : 'text-amber-500'}`} />
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {group.projectName}
                  </h2>
                  <span className="text-xs text-slate-400">
                    ({group.files.length} items)
                  </span>
                </div>

                {group.files.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleSelectAllProject(group.files)}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5 cursor-pointer"
                  >
                    {allSelected ? (
                      <CheckSquare className="w-3.5 h-3.5" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
                  </button>
                )}
              </div>

              {/* Table */}
              {group.files.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 italic">
                  No files uploaded under this project yet.
                </div>
              ) : (
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                    <thead className="bg-slate-100/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3 w-8"></th>
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">Size</th>
                        <th className="py-2.5 px-3">Uploaded At</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {group.files.map(file => {
                        const isChecked = selectedFileIds.includes(file.id);

                        return (
                          <tr 
                            key={file.id}
                            className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition ${
                              isChecked ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                            }`}
                          >
                            <td className="py-3 px-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelectFile(file.id)}
                                className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-3 font-medium text-slate-900 dark:text-white">
                              <button
                                type="button"
                                onClick={() => previewFile(file)}
                                className="flex items-center gap-2 text-left hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer group"
                                title="Click to preview file"
                              >
                                {file.isImage ? (
                                  <div className="w-7 h-7 rounded bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-500 shrink-0 group-hover:scale-105 transition-transform">
                                    <ImageIcon className="w-4 h-4" />
                                  </div>
                                ) : (
                                  <div className="w-7 h-7 rounded bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-500 shrink-0 group-hover:scale-105 transition-transform">
                                    <FileText className="w-4 h-4" />
                                  </div>
                                )}
                                <span className="font-semibold underline decoration-transparent group-hover:decoration-blue-500 underline-offset-2 transition">{file.name}</span>
                              </button>
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                              {formatBytes(file.size)}
                            </td>
                            <td className="py-3 px-3 text-slate-500 text-[11px]">
                              {formatDate(file.uploadedAt)}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => previewFile(file)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer"
                                  title="Preview File"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    startConversationWithFiles([file], file.projectId || null);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer"
                                  title="Start Conversation with this file"
                                >
                                  <MessageSquarePlus className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => downloadFile(file)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                                  title="Download File"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setFileToDelete(file)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                  title="Delete File"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
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
        })}
      </div>

      {/* Single File Delete Confirmation Modal */}
      {fileToDelete && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFileToDelete(null);
          }}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Delete File?
                </h3>
                <p className="text-xs text-slate-500 truncate max-w-[200px]">
                  {fileToDelete.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to permanently delete this file from your library?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSingleDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                Delete File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsBulkDeleteModalOpen(false);
          }}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Delete {selectedFileIds.length} Files?
                </h3>
                <p className="text-xs text-slate-500">
                  Bulk library removal
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to permanently delete these {selectedFileIds.length} selected files from your library?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBulkDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                Delete Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Upload Files & Images
                </h3>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Destination Project Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Destination Project
                </label>
                <select
                  value={uploadTargetProjectId}
                  onChange={(e) => setUploadTargetProjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="UNCATEGORISED">Uncategorised</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Drag & drop or Browse file box */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-2xl p-6 text-center cursor-pointer bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50/30 transition group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleUploadSubmit}
                />
                <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 mx-auto flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Click to select files & images from your computer
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Supports PDF, DOCX, CSV, PNG, JPG, JSON, Code, etc.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
