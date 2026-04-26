import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Plus, Clock, CheckCircle, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/ui/Avatar';
import { formatCurrency, timeAgo } from '../lib/utils';
import { apiFetch } from '../lib/api';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

interface Conversation {
  partner_id: string;
  partner_name: string;
  partner_avatar: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  partner_creator_profile_id: string | null;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  sender_name: string;
  sender_avatar: string | null;
}

interface CustomRequest {
  id: string;
  description: string;
  offered_price: number;
  status: string;
  created_at: string;
  creator_name: string;
  creator_avatar: string | null;
  creator_username: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending:   'text-amber-400 bg-amber-400/10 border-amber-400/25',
  accepted:  'text-arc-success bg-arc-success/10 border-arc-success/25',
  rejected:  'text-arc-error bg-arc-error/10 border-arc-error/25',
  completed: 'text-blue-400 bg-blue-400/10 border-blue-400/25',
  cancelled: 'text-arc-muted bg-white/5 border-white/10',
};

export default function MessagesPage() {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState<'messages' | 'requests'>('messages');

  // Conversations + thread
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Message input
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Custom request form
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [reqDesc, setReqDesc] = useState('');
  const [reqPrice, setReqPrice] = useState('50');
  const [reqSending, setReqSending] = useState(false);
  const [reqError, setReqError] = useState('');

  // Custom requests tab
  const [myRequests, setMyRequests] = useState<CustomRequest[]>([]);
  const [reqsLoading, setReqsLoading] = useState(false);

  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const activeConv = conversations.find((c) => c.partner_id === activePartnerId) ?? null;

  // Load conversations on mount
  useEffect(() => {
    if (!token) return;
    setConvLoading(true);
    fetch(`${API_BASE}/api/messages`, { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setConversations(data);
          if (data.length > 0 && !activePartnerId) {
            setActivePartnerId(data[0].partner_id);
          }
        }
      })
      .catch(() => {})
      .finally(() => setConvLoading(false));
  }, [token]);

  // Load thread when partner changes
  const loadMessages = useCallback((partnerId: string) => {
    if (!token) return;
    setMsgsLoading(true);
    fetch(`${API_BASE}/api/messages/${partnerId}`, { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setMessages(data); })
      .catch(() => {})
      .finally(() => setMsgsLoading(false));
  }, [token]);

  useEffect(() => {
    if (activePartnerId) loadMessages(activePartnerId);
  }, [activePartnerId, loadMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load custom requests tab
  useEffect(() => {
    if (activeTab !== 'requests' || !token) return;
    setReqsLoading(true);
    fetch(`${API_BASE}/api/messages/my-requests`, { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setMyRequests(data); })
      .catch(() => {})
      .finally(() => setReqsLoading(false));
  }, [activeTab, token]);

  async function sendMessage() {
    if (!newMessage.trim() || !activePartnerId || !token) return;
    setSending(true);
    const content = newMessage.trim();
    setNewMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/messages`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiver_id: activePartnerId, content }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: data.id ?? `tmp_${Date.now()}`,
            sender_id: user?.id ?? '',
            receiver_id: activePartnerId,
            content,
            created_at: new Date().toISOString(),
            sender_name: user?.display_name ?? '',
            sender_avatar: user?.avatar_url ?? null,
          },
        ]);
        // Update last_message in conversations
        setConversations((prev) =>
          prev.map((c) =>
            c.partner_id === activePartnerId
              ? { ...c, last_message: content, last_message_at: new Date().toISOString() }
              : c
          )
        );
      } else {
        setNewMessage(content);
      }
    } catch {
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  }

  async function sendRequest() {
    if (!reqDesc.trim() || !activePartnerId || !activeConv?.partner_creator_profile_id || !token) return;
    setReqError('');
    setReqSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/messages/custom-request`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator_id: activeConv.partner_creator_profile_id,
          description: reqDesc.trim(),
          offered_price: Number(reqPrice) || 50,
        }),
      });
      if (res.ok) {
        setShowRequestForm(false);
        setReqDesc('');
        setReqPrice('50');
      } else {
        const data = await res.json();
        setReqError(data.error ?? 'Failed to send request.');
      }
    } catch {
      setReqError('Unable to reach server.');
    } finally {
      setReqSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="section-eyebrow mb-2">Private Messaging</p>
          <h1 className="font-serif text-3xl text-white">Messages</h1>
        </div>

        {/* Tab switch */}
        <div className="flex gap-1 mb-6 border-b border-gold-border/40">
          {(['messages', 'requests'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-sans capitalize transition-all border-b-2 -mb-px ${
                activeTab === tab ? 'border-gold text-gold' : 'border-transparent text-arc-secondary hover:text-white'
              }`}
            >
              {tab === 'messages' ? 'Messages' : 'Custom Requests'}
            </button>
          ))}
        </div>

        {activeTab === 'messages' && (
          convLoading ? (
            <div className="flex items-center justify-center py-20 text-arc-muted text-sm">Loading…</div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <MessageCircle className="w-10 h-10 text-arc-muted mb-4" />
              <p className="text-arc-secondary text-sm mb-1">No conversations yet.</p>
              <p className="text-xs text-arc-muted">Visit a creator's profile and send them a message.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
              {/* Conversation list */}
              <div className="card-surface rounded-xl overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gold-border/40">
                  <h3 className="font-serif text-sm text-white">Conversations</h3>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {conversations.map((c) => (
                    <button
                      key={c.partner_id}
                      onClick={() => setActivePartnerId(c.partner_id)}
                      className={`w-full flex items-start gap-3 p-4 text-left transition-all border-b border-white/5 ${
                        activePartnerId === c.partner_id ? 'bg-gold-muted' : 'hover:bg-bg-hover'
                      }`}
                    >
                      <Avatar src={c.partner_avatar ?? undefined} name={c.partner_name} size="sm" ring={activePartnerId === c.partner_id} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm truncate ${activePartnerId === c.partner_id ? 'text-gold' : 'text-white'}`}>
                            {c.partner_name}
                          </p>
                          {Number(c.unread_count) > 0 && (
                            <span className="flex-shrink-0 w-4 h-4 rounded-full bg-gold text-bg-primary text-xs flex items-center justify-center font-bold">
                              {c.unread_count}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-arc-muted truncate mt-0.5">{c.last_message}</p>
                        <p className="text-xs text-arc-muted mt-0.5">{timeAgo(c.last_message_at)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat view */}
              {activeConv && (
                <div className="lg:col-span-2 card-surface rounded-xl overflow-hidden flex flex-col">
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 border-b border-gold-border/40">
                    <div className="flex items-center gap-3">
                      <Avatar src={activeConv.partner_avatar ?? undefined} name={activeConv.partner_name} size="sm" ring />
                      <span className="font-serif text-sm text-white">{activeConv.partner_name}</span>
                    </div>
                    {activeConv.partner_creator_profile_id && (
                      <button
                        onClick={() => { setShowRequestForm(!showRequestForm); setReqError(''); }}
                        className="btn-outline text-xs px-3 py-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Custom Request
                      </button>
                    )}
                  </div>

                  {/* Custom request form */}
                  {showRequestForm && (
                    <div className="p-4 bg-bg-hover border-b border-gold-border/40">
                      <h4 className="text-xs font-medium text-gold mb-3">New Custom Request</h4>
                      <textarea
                        value={reqDesc}
                        onChange={(e) => setReqDesc(e.target.value)}
                        placeholder="Describe exactly what you want…"
                        className="input-dark text-xs min-h-20 resize-none mb-3"
                      />
                      {reqError && <p className="text-xs text-arc-error mb-2">{reqError}</p>}
                      <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-arc-muted text-xs">$</span>
                          <input
                            type="number"
                            value={reqPrice}
                            onChange={(e) => setReqPrice(e.target.value)}
                            className="input-dark pl-7 text-xs py-2"
                            placeholder="Offered price"
                            min="1"
                          />
                        </div>
                        <button
                          onClick={sendRequest}
                          disabled={reqSending || !reqDesc.trim()}
                          className="btn-gold text-xs px-4 py-2"
                        >
                          {reqSending ? 'Sending…' : 'Send Request'}
                        </button>
                        <button onClick={() => { setShowRequestForm(false); setReqError(''); }} className="btn-ghost text-xs px-3 py-2">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {msgsLoading ? (
                      <div className="flex items-center justify-center h-full text-arc-muted text-sm">Loading…</div>
                    ) : messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-arc-muted text-sm">No messages yet. Say hello.</div>
                    ) : (
                      messages.map((msg) => {
                        const isMine = msg.sender_id === user?.id;
                        return (
                          <div key={msg.id} className={`flex gap-3 ${isMine ? 'flex-row-reverse' : ''}`}>
                            <Avatar src={msg.sender_avatar ?? undefined} name={msg.sender_name} size="xs" className="flex-shrink-0 mt-0.5" />
                            <div className={`max-w-xs lg:max-w-sm ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                              <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                isMine
                                  ? 'bg-gold text-bg-primary rounded-br-sm'
                                  : 'bg-bg-hover text-white border border-white/5 rounded-bl-sm'
                              }`}>
                                {msg.content}
                              </div>
                              <span className="text-xs text-arc-muted px-1">{timeAgo(msg.created_at)}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="p-4 border-t border-gold-border/40">
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                        placeholder={`Message ${activeConv.partner_name}…`}
                        className="input-dark flex-1 py-2.5"
                        disabled={sending}
                      />
                      <button
                        onClick={sendMessage}
                        disabled={!newMessage.trim() || sending}
                        className="btn-gold px-4 py-2.5"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {activeTab === 'requests' && (
          <div className="space-y-4">
            {reqsLoading ? (
              <div className="flex items-center justify-center py-16 text-arc-muted text-sm">Loading…</div>
            ) : myRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <MessageCircle className="w-10 h-10 text-arc-muted mb-4" />
                <p className="text-arc-secondary text-sm mb-1">No custom requests yet.</p>
                <p className="text-xs text-arc-muted">Send a custom request from a creator's profile page.</p>
              </div>
            ) : (
              myRequests.map((req) => (
                <div key={req.id} className="card-surface p-6 rounded-xl">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar src={req.creator_avatar ?? undefined} name={req.creator_name} size="sm" ring />
                      <div>
                        <p className="text-sm text-white">{req.creator_name}</p>
                        <p className="text-xs text-arc-muted">@{req.creator_username}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-serif text-xl text-gold">{formatCurrency(Number(req.offered_price))}</p>
                      <p className="text-xs text-arc-muted">offered</p>
                    </div>
                  </div>

                  <p className="text-sm text-arc-secondary leading-relaxed mb-4">{req.description}</p>

                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border ${STATUS_COLORS[req.status] ?? STATUS_COLORS.pending}`}>
                      {req.status}
                    </span>
                    <span className="text-xs text-arc-muted flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {timeAgo(req.created_at)}
                    </span>
                    {req.status === 'accepted' && (
                      <div className="flex items-center gap-1.5 text-xs text-arc-success ml-auto">
                        <CheckCircle className="w-3.5 h-3.5" />
                        In progress
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
