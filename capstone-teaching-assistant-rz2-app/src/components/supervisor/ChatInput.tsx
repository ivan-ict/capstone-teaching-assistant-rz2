import React, { useLayoutEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const MAX_INPUT_HEIGHT = 200;

export const ChatInput: React.FC = () => {
  const { sendMessage, isGeneratingResponse, currentUser } = useApp();
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }, [content]);
  const archived =
    !currentUser?.semester || Boolean(currentUser.semester.deleted_at);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (archived || submitting || isGeneratingResponse || !content.trim())
      return;
    setSubmitting(true);
    try {
      if (await sendMessage(content)) setContent('');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <form
      onSubmit={submit}
      className="px-4 pb-4 pt-2 bg-slate-50 dark:bg-slate-950"
    >
      <div className="max-w-4xl mx-auto flex items-end gap-2 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition">
        <textarea
          ref={textareaRef}
          aria-label="Message"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          disabled={archived || submitting || isGeneratingResponse}
          placeholder={
            archived
              ? 'This semester is read-only'
              : 'Ask about your semester documents…'
          }
          rows={1}
          style={{ maxHeight: MAX_INPUT_HEIGHT }}
          className="flex-1 resize-none overflow-y-auto bg-transparent px-2 py-2 text-sm leading-6 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 custom-scrollbar"
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              void submit(event);
            }
          }}
        />
        <button
          type="submit"
          aria-label="Send message"
          disabled={
            archived || submitting || isGeneratingResponse || !content.trim()
          }
          className="shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700 text-white p-2.5 transition disabled:opacity-40 disabled:hover:bg-blue-600"
        >
          <Send size={18} />
        </button>
      </div>
      <p className="max-w-4xl mx-auto mt-1.5 text-center text-[11px] text-slate-400">
        Enter to send · Shift + Enter for a new line
      </p>
    </form>
  );
};
