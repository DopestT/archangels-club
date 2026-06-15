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
  const [input, setInput]       = useState('');
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const bottomRef      = useRef<HTMLDivElement>(null);
  const latestTsRef    = useRef<string | undefined>(undefined);
  const pollRef        = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    if (!isOpen) return;
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchMessages, isOpen]);

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
    } catch { /* silent */ }
  }

  async function reportMessage(msgId: string) {
    try {
      await apiFetch(`/api/live/${roomId}/chat/${msgId}/report`, { method: 'POST' });
    } catch { /* silent */ }
  }

  if (!isOpen) {
    return (
      <div className="flex items-center justify-center h-full px-6 text-center">
        <p className="text-zinc-700 text-xs leading-relaxed font-serif italic">
          The Inner Circle is quiet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 min-h-0">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-700 text-xs text-center italic font-serif leading-relaxed">
              The Inner Circle is quiet.<br />
              <span className="not-italic text-zinc-800 text-[10px] tracking-wide font-sans">Say something worthy.</span>
            </p>
          </div>
        ) : (
          messages.map(msg => {
            const isOwn    = msg.user_id === user?.id;
            const canDelete = isOwn || isCreator || isAdmin;
            return (
              <div key={msg.id} className="group flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <span
                    className="text-[11px] font-semibold mr-1.5"
                    style={{ color: isOwn ? '#d4af37' : '#a1a1aa' }}
                  >
                    {msg.display_name}
                  </span>
                  <span className="text-xs text-zinc-400 break-words">{msg.message}</span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 pt-0.5">
                  {canDelete && (
                    <button
                      onClick={() => deleteMessage(msg.id)}
                      className="text-zinc-700 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                  {!isOwn && (
                    <button
                      onClick={() => reportMessage(msg.id)}
                      className="text-zinc-700 hover:text-zinc-400 transition-colors"
                      title="Report"
                    >
                      <Flag size={10} />
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
        <p className="text-[11px] text-red-400 px-4 py-1.5 bg-red-950/30 border-t border-red-900/20">
          {error}
        </p>
      )}

      {/* Input */}
      <div
        className="px-4 py-3 flex gap-2 items-center"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Send a message to the Inner Circle…"
          maxLength={500}
          className="flex-1 bg-transparent text-xs text-zinc-300 placeholder-zinc-700 focus:outline-none min-w-0"
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="flex-shrink-0 p-1.5 rounded-lg transition-all disabled:opacity-30"
          style={{ color: '#d4af37' }}
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}
