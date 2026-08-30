import React, { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  Copy, 
  Check, 
  MoreVertical, 
  Trash2, 
  FolderInput, 
  Layers, 
  Folder, 
  Settings, 
  Sparkles, 
  FileText, 
  Image as ImageIcon,
  Bot,
  User,
  GraduationCap,
  Calendar,
  ChevronRight,
  Info,
  BookOpen,
  Plus
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Conversation, Message, AttachedFile } from '../../types';
import { formatDateTime, getDateCategory, formatBytes } from '../../utils/formatters';
import { ChatInput } from './ChatInput';
import { ConversationFilesModal } from './ConversationFilesModal';
import { AppLogo } from '../common/AppLogo';

export const ChatArea: React.FC = () => {
  const { 
    activeConversation, 
    projects, 
    sendMessage, 
    isGeneratingResponse, 
    deleteConversation, 
    moveConversationToProject,
    setProjectToEdit,
    setIsCreateProjectModalOpen,
    setPendingMoveConversationId,
    createConversation,
    previewFile,
    libraryFiles
  } = useApp();

  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [isTopMenuOpen, setIsTopMenuOpen] = useState(false);
  const [isMoveSubMenuOpen, setIsMoveSubMenuOpen] = useState(false);
  const [isFilesModalOpen, setIsFilesModalOpen] = useState(false);
  const [isDeleteConvModalOpen, setIsDeleteConvModalOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const topMenuRef = useRef<HTMLDivElement>(null);

  const handleReferenceClick = (refName: string) => {
    const matched = libraryFiles.find(f => f.name.toLowerCase() === refName.toLowerCase() || refName.includes(f.name));
    if (matched) {
      previewFile(matched);
    } else {
      // create a transient previewable file representation
      previewFile({
        id: `ref-${Date.now()}`,
        name: refName,
        size: 512000,
        type: refName.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
        projectIds: activeConversation?.projectId ? [activeConversation.projectId] : [],
      });
    }
  };

  // Auto-scroll to bottom of newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages, isGeneratingResponse]);

  // Click outside top menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (topMenuRef.current && !topMenuRef.current.contains(e.target as Node)) {
        setIsTopMenuOpen(false);
        setIsMoveSubMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyText = (content: string, msgId: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const currentProject = activeConversation?.projectId 
    ? projects.find(p => p.id === activeConversation.projectId) 
    : null;
  const lastMessage = activeConversation?.messages[activeConversation.messages.length - 1] || null;
  const isWaitingForResponse = isGeneratingResponse && lastMessage?.role !== 'assistant';

  // Group messages by date category for datetime separator labels
  const groupedMessages = React.useMemo(() => {
    if (!activeConversation) return [];
    const groups: { dateLabel: string; messages: Message[] }[] = [];

    activeConversation.messages.forEach(msg => {
      const category = getDateCategory(msg.timestamp);
      const existingGroup = groups.find(g => g.dateLabel === category);
      if (existingGroup) {
        existingGroup.messages.push(msg);
      } else {
        groups.push({ dateLabel: category, messages: [msg] });
      }
    });

    return groups;
  }, [activeConversation]);

  // Guidelines prompt suggestions for empty state
  const promptSuggestions = [
    {
      title: 'Draft Milestone 2 Rubric',
      description: 'Generate grading criteria for technical design, testing, & team defense',
      prompt: 'Please draft a comprehensive grading rubric for Capstone Milestone 2 covering system architecture, automated test coverage, and live defense.',
    },
    {
      title: 'Analyze Student Proposal',
      description: 'Evaluate technical feasibility and risk mitigation for student ideas',
      prompt: 'How can I evaluate a student capstone proposal to identify hidden technical risks and scope creep?',
    },
    {
      title: 'Draft Schedule Announcement',
      description: 'Email template for presentation slots and progress submission deadlines',
      prompt: 'Draft an announcement email to capstone teams about next week’s defense schedule and deliverables checklist.',
    },
    {
      title: 'Technical Edge Cases & Review',
      description: 'Checklist for code repository auditing and pipeline security',
      prompt: 'What are the top 5 code review guidelines supervisors should check before signing off on final project submissions?',
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-slate-50/50 dark:bg-slate-950 transition-colors overflow-hidden">
      {/* Top Header of Main Chat Display */}
      <div 
        id="chat-top-header"
        className="h-14 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs flex items-center justify-between shrink-0 z-10"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
            {activeConversation?.title || 'New Conversation'}
          </h2>

          {currentProject && (
            <button
              onClick={() => setProjectToEdit(currentProject)}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition shrink-0"
              title="View Project Context & Settings"
            >
              <Folder className="w-3 h-3 text-amber-500" />
              <span className="truncate max-w-[120px] sm:max-w-[200px]">{currentProject.name}</span>
            </button>
          )}
        </div>

        {/* Top Right "More actions" icon on main display */}
        {activeConversation && (
          <div className="relative shrink-0" ref={topMenuRef}>
            <button
              id="chat-top-more-actions-btn"
              onClick={() => setIsTopMenuOpen(!isTopMenuOpen)}
              className={`p-2 rounded-xl border transition ${
                isTopMenuOpen
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700'
                  : 'bg-white dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'
              }`}
              title="More actions"
              aria-label="More conversation actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Dropdown: View files in conversation, delete, move to project */}
            {isTopMenuOpen && (
              <div 
                id="chat-top-actions-dropdown"
                className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-100 dark:divide-slate-800"
              >
                <div className="py-1">
                  {/* View files in conversation */}
                  <button
                    id="action-view-files-in-conversation"
                    onClick={() => {
                      setIsTopMenuOpen(false);
                      setIsFilesModalOpen(true);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5"
                  >
                    <Layers className="w-3.5 h-3.5 text-blue-500" />
                    <span>View files in conversation</span>
                  </button>

                  {/* Move to project */}
                  <div className="relative">
                    <button
                      id="action-move-conversation-top"
                      onClick={() => setIsMoveSubMenuOpen(!isMoveSubMenuOpen)}
                      className="w-full px-3.5 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2.5">
                        <FolderInput className="w-3.5 h-3.5 text-slate-400" />
                        <span>Move to project</span>
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>

                    {isMoveSubMenuOpen && (
                      <div className="bg-slate-50 dark:bg-slate-850 p-1.5 border-y border-slate-100 dark:border-slate-800 space-y-1">
                        <button
                          onClick={() => {
                            setIsTopMenuOpen(false);
                            setPendingMoveConversationId(activeConversation.id);
                            setIsCreateProjectModalOpen(true);
                          }}
                          className="w-full px-2.5 py-1 text-left text-xs text-blue-600 dark:text-blue-400 font-semibold hover:bg-slate-200/60 dark:hover:bg-slate-750 rounded-lg flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>New Project...</span>
                        </button>
                        {projects.map(p => (
                          <button
                            key={p.id}
                            disabled={p.id === activeConversation.projectId}
                            onClick={() => {
                              moveConversationToProject(activeConversation.id, p.id);
                              setIsTopMenuOpen(false);
                            }}
                            className={`w-full px-2.5 py-1 text-left text-xs rounded-lg truncate flex items-center gap-1.5 ${
                              p.id === activeConversation.projectId 
                                ? 'text-slate-400 cursor-not-allowed' 
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-750'
                            }`}
                          >
                            <Folder className="w-3 h-3 text-amber-500 shrink-0" />
                            <span className="truncate">{p.name}</span>
                          </button>
                        ))}
                        {activeConversation.projectId && (
                          <button
                            onClick={() => {
                              moveConversationToProject(activeConversation.id, null);
                              setIsTopMenuOpen(false);
                            }}
                            className="w-full px-2.5 py-1 text-left text-xs text-amber-600 dark:text-amber-400 hover:bg-slate-200/60 dark:hover:bg-slate-750 rounded-lg"
                          >
                            Remove from project
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Delete conversation */}
                <div className="py-1">
                  <button
                    id="action-delete-conversation-top"
                    onClick={() => {
                      setIsDeleteConvModalOpen(true);
                      setIsTopMenuOpen(false);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2.5 font-medium cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete conversation</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Messages Scroll Area */}
      <div 
        id="chat-messages-container"
        className="flex-1 overflow-y-auto px-3 sm:px-6 py-6 space-y-6 custom-scrollbar"
      >
        {(!activeConversation || activeConversation.messages.length === 0) ? (
          /* Empty State / Welcome Screen with instructions and suggested prompts */
          <div className="max-w-2xl mx-auto py-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <AppLogo size="xl" showSparkle={true} className="mx-auto" />

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                How can I assist your Capstone supervision today?
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
                Capstone Teaching Assistant helps you draft grading rubrics, audit student milestones, review technical architectures, and attach domain context documents.
              </p>
            </div>

            {/* Active project context alert if inside a project */}
            {currentProject && (
              <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-left text-xs space-y-1">
                <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-200">
                  <Folder className="w-4 h-4 text-amber-500" />
                  <span>Active Project: {currentProject.name}</span>
                </div>
                {currentProject.instructions && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300/80 italic">
                    "{currentProject.instructions}"
                  </p>
                )}
              </div>
            )}

            {/* Prompt Starter Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              {promptSuggestions.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(item.prompt, [])}
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 bg-white dark:bg-slate-900 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition group text-left cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {item.title}
                    </span>
                    <Sparkles className="w-3.5 h-3.5 text-blue-500 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition" />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                    {item.description}
                  </p>
                </button>
              ))}
            </div>

            {/* Quick guide hints */}
            <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-3 text-left">
              <BookOpen className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold text-slate-800 dark:text-slate-200">Tips for Best Results:</span>
                <p className="text-[11px]">
                  Use the <strong>+</strong> button below to attach student PDFs, CSV datasets, or code files from your computer or the Project Library for deep contextual analysis.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Render Messages by Date Category */
          <div className="max-w-4xl mx-auto space-y-6">
            {groupedMessages.map((group, groupIdx) => (
              <div key={groupIdx} className="space-y-6">
                {/* Date separator label */}
                <div className="flex items-center justify-center">
                  <div className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300/60 dark:border-slate-700">
                    {group.dateLabel}
                  </div>
                </div>

                {/* Messages in this date */}
                {group.messages.map((message) => {
                  const isUser = message.role === 'user';
                  const isCopied = copiedMsgId === message.id;

                  return (
                    <div
                      key={message.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-center'} group/msg`}
                    >
                      {/* USER MESSAGE: Align Right, Blue Background */}
                      {isUser ? (
                        <div className="max-w-[85%] sm:max-w-[75%] space-y-2">
                          <div 
                            id={`user-message-${message.id}`}
                            className="bg-blue-600 text-white rounded-3xl rounded-tr-md p-4 sm:p-4.5 shadow-md shadow-blue-600/15 space-y-2 text-sm leading-relaxed"
                          >
                            {/* Attached files and images sent by user */}
                            {message.attachedFiles && message.attachedFiles.length > 0 && (
                              <div className="space-y-1.5 pb-2 border-b border-blue-400/40">
                                <div className="text-[10px] uppercase font-bold tracking-wider text-blue-100">
                                  Attached Files & Images ({message.attachedFiles.length}):
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {message.attachedFiles.map((file) => (
                                    <button
                                      key={file.id}
                                      onClick={() => previewFile(file)}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-700/80 hover:bg-blue-800 border border-blue-400/50 text-xs font-medium text-white shadow-2xs transition cursor-pointer group"
                                      title="Click to preview file"
                                    >
                                      {file.isImage ? (
                                        <ImageIcon className="w-3.5 h-3.5 text-blue-200 group-hover:scale-110 transition-transform" />
                                      ) : (
                                        <FileText className="w-3.5 h-3.5 text-blue-200 group-hover:scale-110 transition-transform" />
                                      )}
                                      <span className="truncate max-w-[140px] underline decoration-blue-300/50 underline-offset-2">{file.name}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Message text */}
                            <div className="whitespace-pre-wrap select-text">
                              {message.content}
                            </div>
                          </div>

                          {/* Meta: Copy Button & Timestamp */}
                          <div className="flex items-center justify-end gap-2 text-[11px] text-slate-400 px-2">
                            <span>{formatDateTime(message.timestamp)}</span>
                            <button
                              id={`copy-user-msg-${message.id}`}
                              onClick={() => handleCopyText(message.content, message.id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition"
                              title="Copy text"
                            >
                              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* ASSISTANT MESSAGE: Align Center / Left with distinct styling */
                        <div className="w-full max-w-3xl space-y-2">
                          <div 
                            id={`assistant-message-${message.id}`}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-3"
                          >
                            {/* CTA Header badge */}
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                              <div className="flex items-center gap-2">
                                <AppLogo size="sm" />
                                <span className="font-bold text-xs text-slate-900 dark:text-white">
                                  Capstone Teaching Assistant
                                </span>
                              </div>

                              {/* Copy response icon */}
                              <button
                                id={`copy-assistant-msg-${message.id}`}
                                onClick={() => handleCopyText(message.content, message.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1 text-xs cursor-pointer"
                                title="Copy response"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                    <span className="text-emerald-600 text-[10px] font-semibold">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span className="text-[10px]">Copy</span>
                                  </>
                                )}
                              </button>
                            </div>

                            {/* Assistant formatted content */}
                            <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                              <ReactMarkdown>{message.content}</ReactMarkdown>
                            </div>

                            {/* Referenced files & context if any */}
                            {message.references && message.references.length > 0 && (
                              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  References & Context (Click to preview):
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {message.references.map((refItem, rIdx) => (
                                    <button
                                      key={rIdx}
                                      onClick={() => handleReferenceClick(refItem)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 transition cursor-pointer group"
                                      title={`Preview ${refItem}`}
                                    >
                                      <FileText className="w-3 h-3 text-blue-500 group-hover:scale-110 transition-transform" />
                                      <span>{refItem}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="text-[10px] text-slate-400 pl-4">
                            Generated at {formatDateTime(message.timestamp)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Generating Response Loading Indicator */}
            {isWaitingForResponse && (
              <div className="w-full max-w-3xl mx-auto flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm animate-pulse">
                <AppLogo size="sm" />
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <span>CTA is analyzing capstone context and generating response...</span>
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Chat Input Bar Component */}
      <ChatInput
        onSendMessage={(text, attached) => sendMessage(text, attached)}
        disabled={isGeneratingResponse}
      />

      {/* Conversation Files Modal */}
      <ConversationFilesModal
        isOpen={isFilesModalOpen}
        conversation={activeConversation}
        onClose={() => setIsFilesModalOpen(false)}
      />

      {/* Delete Conversation Confirmation Modal */}
      {isDeleteConvModalOpen && activeConversation && (
        <div 
          id="delete-active-conversation-modal-backdrop"
          onClick={() => setIsDeleteConvModalOpen(false)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
        >
          <div 
            id="delete-active-conversation-modal"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Delete Conversation
                </h3>
                <p className="text-xs text-slate-500">
                  Are you sure you want to delete this conversation?
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
              Conversation <strong className="text-slate-900 dark:text-white">"{activeConversation.title}"</strong> and all its chat messages will be permanently deleted.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteConvModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-active-conversation-btn"
                type="button"
                onClick={() => {
                  deleteConversation(activeConversation.id);
                  setIsDeleteConvModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Conversation</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
