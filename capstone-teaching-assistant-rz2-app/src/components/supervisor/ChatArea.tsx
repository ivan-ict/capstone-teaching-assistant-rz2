import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, Download, Bot, FileText } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatDateTime } from '../../utils/formatters';
import { remarkHtmlBreaks } from '../../utils/markdown';
import { ChatInput } from './ChatInput';

export const ChatArea: React.FC = () => {
  const { activeConversation, isGeneratingResponse, api } = useApp();
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
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadErrors((prev) => ({
        ...prev,
        [id]: error instanceof Error ? error.message : 'File unavailable.'
      }));
    }
  };
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-6 py-3 bg-white/80 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 font-semibold">
        {activeConversation?.title || 'New conversation'}
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
        {!activeConversation?.messages.length && (
          <div className="max-w-xl mx-auto py-16 text-center space-y-4">
            <Bot className="mx-auto text-blue-600" size={40} />
            <h2 className="text-xl font-bold">Your teaching assistant</h2>
            <p className="text-sm text-slate-500">
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
                className={`rounded-2xl p-4 max-w-full text-sm ${message.role === 'user' ? 'bg-blue-600 text-white whitespace-pre-wrap max-w-[85%]' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full'}`}
              >
                {message.role === 'user' ? (
                  message.content
                ) : (
                  <div className="prose max-w-none overflow-x-auto">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkHtmlBreaks]}
                    >
                      {message.content ||
                        (isGeneratingResponse
                          ? 'Thinking…'
                          : 'No response was generated.')}
                    </ReactMarkdown>
                  </div>
                )}
                {message.references?.length ? (
                  <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
                    {message.references.map((reference, index) => (
                      <details
                        key={`${reference.fileId}:${index}`}
                        className="text-xs"
                      >
                        <summary className="cursor-pointer text-blue-600 dark:text-blue-400">
                          <FileText size={13} className="inline mr-1" />
                          {reference.filename}
                        </summary>
                        <blockquote className="my-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 whitespace-pre-wrap">
                          {reference.content}
                        </blockquote>
                        <button
                          onClick={() =>
                            void download(reference.fileId, reference.filename)
                          }
                          className="flex gap-1 items-center text-blue-600"
                        >
                          <Download size={13} />
                          Download original
                        </button>
                        {downloadErrors[reference.fileId] && (
                          <p role="alert" className="text-rose-600 mt-1">
                            {downloadErrors[reference.fileId]}
                          </p>
                        )}
                      </details>
                    ))}
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
