import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  ArrowUp, 
  Upload, 
  Layers, 
  X, 
  FileText, 
  Image as ImageIcon,
  Sparkles,
  Paperclip
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AttachedFile } from '../../types';
import { formatBytes } from '../../utils/formatters';
import { LibraryModal } from './LibraryModal';

interface ChatInputProps {
  onSendMessage: (text: string, attached: AttachedFile[]) => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, disabled }) => {
  const { uploadFiles, activeConversation, pendingChatAttachments, setPendingChatAttachments, previewFile } = useApp();
  const [inputText, setInputText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Consume pending attachments when navigating from Library or actions
  useEffect(() => {
    if (pendingChatAttachments && pendingChatAttachments.length > 0) {
      setAttachedFiles(prev => {
        const existingIds = new Set(prev.map(f => f.id));
        const newItems = pendingChatAttachments.filter(f => !existingIds.has(f.id));
        return [...prev, ...newItems];
      });
      setPendingChatAttachments([]);
      // Focus textarea
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [pendingChatAttachments, setPendingChatAttachments]);

  // Auto-resize textarea as text grows
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputText]);

  // Click outside to close add menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSend = () => {
    if ((!inputText.trim() && attachedFiles.length === 0) || disabled) return;
    onSendMessage(inputText.trim(), attachedFiles);
    setInputText('');
    setAttachedFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Upload from computer
  const handleNativeFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const currentProjId = activeConversation?.projectId || null;
    const uploaded = await uploadFiles(e.target.files, currentProjId);
    setAttachedFiles(prev => [...prev, ...uploaded]);
    setIsAddMenuOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Attach from library
  const handleSelectFromLibrary = (selected: AttachedFile[]) => {
    // Avoid duplicate attachments
    setAttachedFiles(prev => {
      const existingIds = new Set(prev.map(f => f.id));
      const newItems = selected.filter(f => !existingIds.has(f.id));
      return [...prev, ...newItems];
    });
  };

  const handleRemoveAttachment = (fileId: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 pb-4 select-none">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleNativeFileUpload}
      />

      {/* Main Box */}
      <div className="relative bg-white dark:bg-slate-850 border border-slate-200/90 dark:border-slate-700/80 rounded-3xl shadow-lg shadow-slate-200/40 dark:shadow-none transition focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
        
        {/* Scrollable list of attached images and files */}
        {attachedFiles.length > 0 && (
          <div 
            id="attached-files-scrollable-bar"
            className="p-3 pb-1 flex items-center gap-2 overflow-x-auto custom-scrollbar border-b border-slate-100 dark:border-slate-800/80"
          >
            {attachedFiles.map(file => (
              <div 
                key={file.id}
                className="group/chip inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 shrink-0 shadow-2xs"
              >
                <button
                  type="button"
                  onClick={() => previewFile(file)}
                  className="inline-flex items-center gap-1.5 text-left hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
                  title="Click to preview file"
                >
                  {file.isImage ? (
                    <ImageIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  )}
                  <span className="truncate max-w-[150px] underline decoration-slate-300 dark:decoration-slate-600 underline-offset-2">{file.name}</span>
                </button>
                <span className="text-[10px] text-slate-400 font-mono">
                  ({formatBytes(file.size)})
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(file.id)}
                  className="p-0.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                  title="Remove attachment"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Area + Left Add Icon + Right Send Button */}
        <div className="flex items-end p-2 sm:p-2.5 gap-2">
          {/* Add Icon on the Left of Message Input Area */}
          <div className="relative shrink-0" ref={addMenuRef}>
            <button
              id="chat-add-attachment-btn"
              type="button"
              onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
              className={`p-2 rounded-2xl transition cursor-pointer flex items-center justify-center ${
                isAddMenuOpen
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              title="Add images or files"
              aria-label="Add attachments"
            >
              <Plus className={`w-5 h-5 transition-transform ${isAddMenuOpen ? 'rotate-45' : ''}`} />
            </button>

            {/* Dropdown Options: Add images & files / Add from library */}
            {isAddMenuOpen && (
              <div 
                id="chat-attachment-dropdown-menu"
                className="absolute bottom-full left-0 mb-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
              >
                {/* 1. Add images & files (upload from computer) */}
                <button
                  id="attach-from-computer-btn"
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center gap-2.5 transition"
                >
                  <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                    <Upload className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-slate-900 dark:text-white">Add images & files</div>
                    <div className="text-[10px] text-slate-400 font-normal">Upload from computer</div>
                  </div>
                </button>

                {/* 2. Add from library */}
                <button
                  id="attach-from-library-btn"
                  onClick={() => {
                    setIsAddMenuOpen(false);
                    setIsLibraryModalOpen(true);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center gap-2.5 transition border-t border-slate-100 dark:border-slate-800"
                >
                  <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-slate-900 dark:text-white">Add from library</div>
                    <div className="text-[10px] text-slate-400 font-normal">Choose existing project files</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Text Area */}
          <textarea
            ref={textareaRef}
            id="chat-message-textarea"
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Capstone Teaching Assistant (e.g. review milestone, draft rubric)..."
            disabled={disabled}
            className="flex-1 bg-transparent border-0 resize-none py-2 px-1 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none max-h-48 leading-relaxed custom-scrollbar overflow-y-auto"
          />

          {/* Send Button on the Right */}
          <button
            id="chat-send-message-btn"
            type="button"
            disabled={(!inputText.trim() && attachedFiles.length === 0) || disabled}
            onClick={handleSend}
            className="p-2 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white shadow-md shadow-blue-500/20 transition shrink-0 cursor-pointer flex items-center justify-center active:scale-95"
            title="Send message"
            aria-label="Send message"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Library popup modal */}
      <LibraryModal
        isOpen={isLibraryModalOpen}
        onClose={() => setIsLibraryModalOpen(false)}
        onSelectFiles={handleSelectFromLibrary}
      />
    </div>
  );
};
