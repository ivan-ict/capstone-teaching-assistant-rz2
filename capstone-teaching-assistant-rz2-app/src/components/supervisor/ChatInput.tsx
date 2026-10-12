import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ChatInput: React.FC = () => {
  const { sendMessage, isGeneratingResponse, currentUser } = useApp();
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
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
      className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
    >
      <div className="flex gap-3 max-w-4xl mx-auto">
        <textarea
          aria-label="Message"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          disabled={archived || submitting || isGeneratingResponse}
          placeholder={
            archived
              ? 'This semester is read-only'
              : 'Ask about your semester documents…'
          }
          rows={2}
          className="flex-1 resize-none rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent p-3 text-sm disabled:opacity-50"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
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
          className="self-end rounded-xl bg-blue-600 text-white p-3 disabled:opacity-40"
        >
          <Send size={18} />
        </button>
      </div>
    </form>
  );
};
