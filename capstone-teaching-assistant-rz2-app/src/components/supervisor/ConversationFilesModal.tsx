import React from 'react';
import { X, FileText, Image as ImageIcon, Download, Layers, Eye } from 'lucide-react';
import { Conversation, AttachedFile } from '../../types';
import { formatBytes, formatDate } from '../../utils/formatters';
import { useApp } from '../../context/AppContext';

interface ConversationFilesModalProps {
  isOpen: boolean;
  conversation: Conversation | null;
  onClose: () => void;
}

export const ConversationFilesModal: React.FC<ConversationFilesModalProps> = ({ isOpen, conversation, onClose }) => {
  const { previewFile, downloadFile } = useApp();
  if (!isOpen || !conversation) return null;

  // Gather all attached files from user messages in this conversation
  const filesMap = new Map<string, AttachedFile>();
  conversation.messages.forEach(m => {
    if (m.attachedFiles) {
      m.attachedFiles.forEach(f => filesMap.set(f.id, f));
    }
  });

  const conversationFiles = Array.from(filesMap.values());

  return (
    <div 
      id="conversation-files-modal-backdrop"
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
    >
      <div 
        id="conversation-files-modal"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Files in this Conversation
              </h2>
              <p className="text-xs text-slate-500 truncate max-w-xs">
                {conversation.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {conversationFiles.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 italic">
              No files or images were attached to this conversation.
            </div>
          ) : (
            <div className="space-y-2">
              {conversationFiles.map(file => (
                <div 
                  key={file.id}
                  className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                    {file.isImage ? (
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center shrink-0">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-500 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => previewFile(file)}
                        className="text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 truncate text-left block cursor-pointer"
                        title="Click to preview"
                      >
                        {file.name}
                      </button>
                      <div className="text-[10px] text-slate-400">
                        {formatBytes(file.size)} &bull; {formatDate(file.uploadedAt)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => previewFile(file)}
                      className="p-2 rounded-xl bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 transition shadow-2xs border border-slate-200/80 dark:border-slate-700 cursor-pointer"
                      title="Preview File"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => downloadFile(file)}
                      className="p-2 rounded-xl bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 transition shadow-2xs border border-slate-200/80 dark:border-slate-700 cursor-pointer"
                      title="Download File"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
