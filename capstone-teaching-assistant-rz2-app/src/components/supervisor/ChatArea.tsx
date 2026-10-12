import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, Download, Bot, FileText, Eye } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatDateTime } from '../../utils/formatters';
import { remarkHtmlBreaks } from '../../utils/markdown';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { MessageReference } from '../../types';

interface ReferenceGroup {
  fileId: string;
  filename: string;
  mimeType?: string;
  chunks: string[];
}

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

export function groupReferences(
  references: MessageReference[]
): ReferenceGroup[] {
  const groups = new Map<string, ReferenceGroup>();
  for (const reference of references) {
    const group = groups.get(reference.fileId);
    if (group) {
      if (!group.chunks.includes(reference.content))
        group.chunks.push(reference.content);
    } else {
      groups.set(reference.fileId, {
        fileId: reference.fileId,
        filename: reference.filename,
        mimeType: reference.mimeType,
        chunks: [reference.content]
      });
    }
  }
  return [...groups.values()];
}

export const ChatArea: React.FC = () => {
  const { activeConversation, isGeneratingResponse, api, previewFile } =
    useApp();
  const [copied, setCopied] = useState<string | null>(null);
  const [downloadErrors, setDownloadErrors] = useState<Record<string, string>>(
    {}
  );
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);
  const download = async (id: string, name: string) => {
    try {
      const blob = await api.downloadFile(id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = name;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadErrors((prev) => ({
        ...prev,
        [id]: error instanceof Error ? error.message : 'File unavailable.'
      }));
    }
  };
  const preview = (group: ReferenceGroup) =>
    previewFile({
      id: group.fileId,
      name: group.filename,
      size: 0,
      type:
        group.mimeType ||
        (IMAGE_EXTENSIONS.test(group.filename) ? 'image/*' : ''),
      uploadedAt: ''
    });
  const lastMessageId = activeConversation?.messages.at(-1)?.id;
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950">
      <div className="px-6 py-3 bg-white/80 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 font-semibold text-slate-900 dark:text-white truncate">
        {activeConversation?.title || 'New conversation'}
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
        {!activeConversation?.messages.length && (
          <div className="max-w-xl mx-auto py-16 text-center space-y-4">
            <Bot className="mx-auto text-blue-600" size={40} />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Your teaching assistant
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Ask questions using your semester’s documents and your personal
              conversation history.
            </p>
          </div>
        )}
        <div className="max-w-4xl mx-auto space-y-6">
          {activeConversation?.messages.map((message) => (
            <article
              key={message.id}
              className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`rounded-2xl p-4 max-w-full text-sm ${message.role === 'user' ? 'bg-blue-600 text-white whitespace-pre-wrap max-w-[85%]' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 w-full shadow-sm'}`}
              >
                {message.role === 'user' ? (
                  message.content
                ) : !message.content &&
                  isGeneratingResponse &&
                  message.id === lastMessageId ? (
                  <TypingIndicator />
                ) : (
                  <div className="prose max-w-none overflow-x-auto">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkHtmlBreaks]}
                    >
                      {message.content || 'No response was generated.'}
                    </ReactMarkdown>
                  </div>
                )}
                {message.references?.length ? (
                  <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      References
                    </p>
                    <div className="space-y-2">
                      {groupReferences(message.references).map((group) => (
                        <details
                          key={group.fileId}
                          className="group/ref text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40"
                        >
                          <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer list-none">
                            <FileText
                              size={14}
                              className="shrink-0 text-blue-600 dark:text-blue-400"
                            />
                            <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                              {group.filename}
                            </span>
                            <span className="shrink-0 text-slate-400">
                              {group.chunks.length}{' '}
                              {group.chunks.length === 1 ? 'excerpt' : 'excerpts'}
                            </span>
                            <span className="ml-auto flex shrink-0 gap-1">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  preview(group);
                                }}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                              >
                                <Eye size={13} />
                                Preview
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  void download(group.fileId, group.filename);
                                }}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                              >
                                <Download size={13} />
                                Download
                              </button>
                            </span>
                          </summary>
                          <div className="px-3 pb-3 space-y-2">
                            {group.chunks.map((chunk, index) => (
                              <blockquote
                                key={index}
                                className="p-3 rounded-lg bg-white dark:bg-slate-900 border-l-2 border-blue-400 whitespace-pre-wrap text-slate-600 dark:text-slate-300"
                              >
                                {chunk}
                              </blockquote>
                            ))}
                          </div>
                          {downloadErrors[group.fileId] && (
                            <p
                              role="alert"
                              className="px-3 pb-2 text-rose-600 dark:text-rose-400"
                            >
                              {downloadErrors[group.fileId]}
                            </p>
                          )}
                        </details>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex gap-2 mt-1 text-[11px] text-slate-400">
                <span>{formatDateTime(message.timestamp)}</span>
                <button
                  aria-label="Copy message"
                  onClick={async () => {
                    await navigator.clipboard.writeText(message.content);
                    setCopied(message.id);
                  }}
                >
                  {copied === message.id ? (
                    <Check size={13} />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>
              </div>
            </article>
          ))}
          <div ref={bottom} />
        </div>
      </div>
      <ChatInput />
    </div>
  );
};
