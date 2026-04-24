import React, { useState } from 'react';
import { Send, Plus, Clock, CheckCircle, XCircle, MessageCircle } from 'lucide-react';
import { sampleMessages, sampleCreators, sampleCustomRequests } from '../data/seed';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/ui/Avatar';
import { formatCurrency, timeAgo } from '../lib/utils';
import type { CustomRequestStatus } from '../types';

const CONVERSATIONS = [
  { id: 'c1', partner_id: 'user_1', partner_name: 'Aria Luxe', partner_avatar: 'https://i.pravatar.cc/150?img=47', last_message: 'Thank you for the tip! Working on something special…', last_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), unread: 0 },
  { id: 'c2', partner_id: 'user_3', partner_name: 'Selena Noir', partner_avatar: 'https://i.pravatar.cc/150?img=45', last_message: 'Your custom request has been accepted.', last_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), unread: 1 },
];

const STATUS_COLORS: Record<CustomRequestStatus, string> = {
  pending: 'text-amber-400 bg-amber-400/10 border-amber-400/25',
  accepted: 'text-arc-success bg-arc-success/10 border-arc-success/25',
  rejected: 'text-arc-error bg-arc-error/10 border-arc-error/25',
  completed: 'text-blue-400 bg-blue-400/10 border-blue-400/25',
  cancelled: 'text-arc-muted bg-white/5 border-white/10',
};

export default function MessagesPage() {
  const { user } = useAuth();
  const [activeConv, setActiveConv] = useState(CONVERSATIONS[0].id);
  const [newMessage, setNewMessage] = useState('');
  const [localMessages, setLocalMessages] = useState(sampleMessages);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [reqDesc, setReqDesc] = useState('');
  const [reqPrice, setReqPrice] = useState('50');
  const [activeTab, setActiveTab] = useState<'messages' | 'requests'>('messages');

  const conv = CONVERSATIONS.find((c) => c.id === activeConv)!;

  function sendMessage() {
    if (!newMessage.trim()) return;
    setLocalMessages((prev) => [
      ...prev,
      {
        id: `msg_${Date.now()}`,
        sender_id: user?.id ?? 'user_me',
        receiver_id: conv.partner_id,
        content: newMessage,
        created_at: new Date().toISOString(),
        sender_name: user?.display_name,
        sender_avatar: user?.avatar_url,
      },
    ]);
    setNewMessage('');
  }

  function sendRequest() {
    setShowRequestForm(false);
    setReqDesc('');
    setReqPrice('50');
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
            {/* Conversation list */}
            <div className="card-surface rounded-xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-gold-border/40">
                <h3 className="font-serif text-sm text-white">Conversations</h3>
              </div>
              <div className="flex-1 overflow-y-auto">
                {CONVERSATIONS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveConv(c.id)}
                    className={`w-full flex items-start gap-3 p-4 text-left transition-all border-b border-white/5 ${
                      activeConv === c.id ? 'bg-gold-muted' : 'hover:bg-bg-hover'
                    }`}
                  >
                    <Avatar src={c.partner_avatar} name={c.partner_name} size="sm" ring={activeConv === c.id} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${activeConv === c.id ? 'text-gold' : 'text-white'}`}>
                          {c.partner_name}
                        </p>
                        {c.unread > 0 && (
                          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-gold text-bg-primary text-xs flex items-center justify-center font-bold">
                            {c.unread}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-arc-muted truncate mt-0.5">{c.last_message}</p>
                      <p className="text-xs text-arc-muted mt-0.5">{timeAgo(c.last_at)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat view */}
            <div className="lg:col-span-2 card-surface rounded-xl overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gold-border/40">
                <div className="flex items-center gap-3">
                  <Avatar src={conv.partner_avatar} name={conv.partner_name} size="sm" ring />
                  <span className="font-serif text-sm text-white">{conv.partner_name}</span>
                </div>
                <button
                  onClick={() => setShowRequestForm(!showRequestForm)}
                  className="btn-outline text-xs px-3 py-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Custom Request
                </button>
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
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-arc-muted text-xs">$</span>
                      <input
                        type="number"
                        value={reqPrice}
                        onChange={(e) => setReqPrice(e.target.value)}
                        className="input-dark pl-7 text-xs py-2"
                        placeholder="Offered price"
                      />
                    </div>
                    <button onClick={sendRequest} className="btn-gold text-xs px-4 py-2">
                      Send Request
                    </button>
                    <button onClick={() => setShowRequestForm(false)} className="btn-ghost text-xs px-3 py-2">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {localMessages.map((msg) => {
                  const isMine = msg.sender_id === (user?.id ?? 'user_me');
                  return (
                    <div key={msg.id} className={`flex gap-3 ${isMine ? 'flex-row-reverse' : ''}`}>
                      <Avatar
                        src={msg.sender_avatar}
                        name={msg.sender_name}
                        size="xs"
                        className="flex-shrink-0 mt-0.5"
                      />
                      <div className={`max-w-xs lg:max-w-sm ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                        <div
                          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                            isMine
                              ? 'bg-gold text-bg-primary rounded-br-sm'
                              : 'bg-bg-hover text-white border border-white/5 rounded-bl-sm'
                          }`}
                        >
                          {msg.content}
                        </div>
                        <span className="text-xs text-arc-muted px-1">{timeAgo(msg.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Input */}
              <div className="p-4 border-t border-gold-border/40">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder={`Message ${conv.partner_name}…`}
                    className="input-dark flex-1 py-2.5"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className="btn-gold px-4 py-2.5"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-arc-secondary">{sampleCustomRequests.length} requests</p>
            </div>
            {sampleCustomRequests.map((req) => {
              const creator = sampleCreators.find((c) => c.id === req.creator_id);
              return (
                <div key={req.id} className="card-surface p-6 rounded-xl">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      {creator && (
                        <>
                          <Avatar src={creator.avatar_url} name={creator.display_name} size="sm" ring />
                          <div>
                            <p className="text-sm text-white">{creator.display_name}</p>
                            <p className="text-xs text-arc-muted">@{creator.username}</p>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-serif text-xl text-gold">{formatCurrency(req.offered_price)}</p>
                      <p className="text-xs text-arc-muted">offered</p>
                    </div>
                  </div>

                  <p className="text-sm text-arc-secondary leading-relaxed mb-4">{req.description}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full border ${STATUS_COLORS[req.status]}`}>
                        {req.status}
                      </span>
                      <span className="text-xs text-arc-muted flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo(req.created_at)}
                      </span>
                    </div>
                    {req.status === 'accepted' && (
                      <div className="flex items-center gap-1.5 text-xs text-arc-success">
                        <CheckCircle className="w-3.5 h-3.5" />
                        In progress
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <button
              onClick={() => setActiveTab('messages')}
              className="btn-outline w-full py-3"
            >
              <Plus className="w-4 h-4" />
              New Custom Request
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
