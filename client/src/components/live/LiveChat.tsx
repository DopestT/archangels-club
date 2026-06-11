import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Trash2, Flag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import { useLanguage } from '../../context/LanguageContext';

interface ChatMessage {
  id: string;
  user_id: string;
  display_name: string;
  message: string;
  is_deleted: boolean;
  is_reported: boolean;
  created_at: string;
}

interface Props {
  roomId: string;
  isOpen: boolean;
  isCreator: boolean;
}

const POLL_INTERVAL = 3000;

export default function LiveChat({ roomId, isOpen, isCreator }: Props) {
  const { user, isAdmin } = useAuth();
  const { t } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const latestTsRef = useRef<string | undefined>(undefined);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!isOpen) return;
    try {
      const url = latestTsRef.current
        ? `/api/live/${roomId}/chat?after=${encodeURIComponent(latestTsRef.current)}&limit=50`
        : `/api/live/${roomId}/chat?limit=50`;
      const data = await apiFetch(url) as ChatMessage[];
      if (data.length > 0) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const newMsgs = data.filter((m: ChatMessage) => !existingIds.has(m.id));
          if (newMsgs.length === 0) return prev;
          latestTsRef.current = newMsgs[newMsgs.length - 1].created_at;
          return [...prev, ...newMsgs];
        });
      }
    } catch {
      // polling errors are silent
    }
  }, [roomId, isOpen]);

  // Initial load + polling
  useEffect(() => {
    if (!isOpen) return;
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchMessages, isOpen]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      await apiFetch(`/api/live/${roomId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      setInput('');
      // Fetch immediately after sending
      await fetchMessages();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to send message.');
    } finally {
      setSending(false);
    }
  }

  async function deleteMessage(msgId: string) {
    try {
      await apiFetch(`/api/live/${roomId}/chat/${msgId}`, { method: 'DELETE' });
      setMessages(prev => prev.filter(m => m.id !== msgId));
    } catch {
      // silent
    }
  }

  async function reportMessage(msgId: string) {
    try {
      await apiFetch(`/api/live/${roomId}/chat/${msgId}/report`, { method: 'POST' });
    } catch {
      // silent
    }
  }

  if (!isOpen) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        Chat available when room is live.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {messages.length === 0 ? (
          <p className="text-center text-zinc-600 text-xs mt-4">No messages yet. Be the first!</p>
        ) : (
          messages.map(msg => {
            const isOwn = msg.user_id === user?.id;
            const canDelete = isOwn || isCreator || isAdmin;
            return (
              <div key={msg.id} className="group flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-yellow-400">{msg.display_name} </span>
                  <span className="text-xs text-zinc-300 break-words">{msg.message}</span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  {canDelete && (
                    <button
                      onClick={() => deleteMessage(msg.id)}
                      className="text-zinc-600 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                  {!isOwn && (
                    <button
                      onClick={() => reportMessage(msg.id)}
                      className="text-zinc-600 hover:text-orange-400 transition-colors"
                      title="Report"
                    >
                      <Flag size={11} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400 px-3 py-1 bg-red-900/20 border-t border-red-900/30">
          {error}
        </p>
      )}

      {/* Input */}
      <div className="border-t border-zinc-800 px-3 py-2 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={t('live.chat_placeholder')}
          maxLength={500}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-yellow-600/50 min-w-0"
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="px-3 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-black font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
