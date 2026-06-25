import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins, Send, ShieldCheck, Trophy, Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useToast } from '../components/ui/Toast';

interface Persona {
  id: string;
  name: string;
  tagline: string;
  avatar_url: string;
  tags: string[];
  goal_title: string;
  goal_gold: number;
  goal_progress: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  is_gift?: boolean;
  gift_name?: string;
  gift_icon?: string;
  gift_gold?: number;
  created_at: string;
}

interface Supporter {
  user_id: string;
  display_name: string;
  total_gold: number;
}

interface GiftItem {
  id: string;
  name: string;
  gold: number;
  icon: string;
}

const GIFTS: GiftItem[] = [
  { id: 'golden_rose',     name: 'Golden Rose',        gold: 25,  icon: '🌹' },
  { id: 'halo_spark',      name: 'Halo Spark',         gold: 50,  icon: '✨' },
  { id: 'angel_wings',     name: 'Angel Wings',        gold: 100, icon: '🕊️' },
  { id: 'crown_light',     name: 'Crown Light',        gold: 250, icon: '👑' },
  { id: 'private_by_design', name: 'Private by Design', gold: 500, icon: '🔮' },
];

interface GiftAnimation {
  icon: string;
  name: string;
  gold: number;
}

export default function AIPersonaRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [persona, setPersona] = useState<Persona | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [goldBalance, setGoldBalance] = useState(0);
  const [supporters, setSupporters] = useState<Supporter[]>([]);
  const [memorySummary, setMemorySummary] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [giftingId, setGiftingId] = useState<string | null>(null);
  const [giftAnim, setGiftAnim] = useState<GiftAnimation | null>(null);
  const [showMemory, setShowMemory] = useState(false);
  const [loading, setLoading] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!id) return;
    const init = async () => {
      try {
        const [sessionRes, supportersRes] = await Promise.all([
          apiFetch(`/api/ai-personas/${id}/session`),
          apiFetch(`/api/ai-personas/${id}/supporters`),
        ]);
        if (sessionRes.ok) {
          const data = await sessionRes.json();
          setPersona(data.persona);
          setMessages(data.messages ?? []);
          setGoldBalance(data.gold_balance ?? 0);
          setMemorySummary(data.memory_summary ?? '');
        }
        if (supportersRes.ok) {
          const data = await supportersRes.json();
          setSupporters(data.supporters ?? []);
        }
      } catch {
        toast.error('Could not load room.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async () => {
    if (!input.trim() || sending || !id) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    const tempId = `tmp-${Date.now()}`;
    setMessages(m => [...m, { id: tempId, role: 'user', content: text, created_at: new Date().toISOString() }]);
    try {
      const res = await apiFetch(`/api/ai-personas/${id}/chat`, {
        method: 'POST',
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) throw new Error('chat failed');
      const data = await res.json();
      setMessages(m => [
        ...m.filter(msg => msg.id !== tempId),
        data.user_message,
        data.assistant_message,
      ]);
    } catch {
      setMessages(m => m.filter(msg => msg.id !== tempId));
      toast.error('Message failed. Try again.');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const sendGift = async (gift: GiftItem) => {
    if (giftingId || !id) return;
    if (goldBalance < gift.gold) {
      toast.warning(`Not enough Gold. You need ${gift.gold} G.`);
      return;
    }
    setGiftingId(gift.id);
    try {
      const res = await apiFetch(`/api/ai-personas/${id}/gift`, {
        method: 'POST',
        body: JSON.stringify({ gift_id: gift.id, privacy: 'public' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'gift failed');
      }
      const data = await res.json();
      setGoldBalance(data.new_balance ?? 0);
      if (data.assistant_message) {
        setMessages(m => [...m, data.assistant_message]);
      }
      // Animate
      setGiftAnim({ icon: gift.icon, name: gift.name, gold: gift.gold });
      setTimeout(() => setGiftAnim(null), 2200);
      // Update supporters
      if (data.supporters) setSupporters(data.supporters);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gift failed.';
      toast.error(msg);
    } finally {
      setGiftingId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const goalPct = persona
    ? Math.min(100, Math.round(((persona.goal_progress ?? 0) / (persona.goal_gold || 1)) * 100))
    : 0;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold border-t-transparent" />
          <p className="text-sm text-arc-secondary">Entering the Room…</p>
        </div>
      </div>
    );
  }

  if (!persona) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-bg-primary">
        <p className="text-white">Angel not found.</p>
        <button onClick={() => navigate('/angels')} className="btn-outline">Back to Studio</button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-bg-primary overflow-hidden">
      {/* Gift overlay */}
      {giftAnim && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="gift-reveal flex flex-col items-center gap-3">
            <span className="text-8xl drop-shadow-2xl">{giftAnim.icon}</span>
            <p className="text-2xl font-bold text-white">{giftAnim.name}</p>
            <p className="text-sm text-gold">{giftAnim.gold} Gold sent ✨</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/8 bg-bg-surface px-4 py-3">
        <button
          onClick={() => navigate('/angels')}
          className="arc-pressable rounded-lg p-1.5 text-arc-secondary hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {persona.avatar_url ? (
          <img src={persona.avatar_url} alt={persona.name} className="h-9 w-9 rounded-full object-cover ring-1 ring-gold/30" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/20 text-lg">✨</div>
        )}

        <div className="flex-1 min-w-0">
          <p className="truncate font-semibold text-white text-sm">{persona.name}</p>
          <p className="truncate text-xs text-arc-secondary">{persona.tagline}</p>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg border border-gold/20 bg-bg-primary px-3 py-1.5">
          <Coins className="h-3.5 w-3.5 text-gold" />
          <span className="text-sm font-semibold text-gold">{goldBalance.toLocaleString()}</span>
        </div>
      </div>

      {/* Compliance strip */}
      <div className="flex items-center gap-2 border-b border-white/5 bg-bg-surface/60 px-4 py-1.5">
        <ShieldCheck className="h-3 w-3 shrink-0 text-gold/60" />
        <p className="text-[10px] text-arc-muted">
          18+ · AI persona · not a real person · gifts are entertainment currency with no cash value
        </p>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Room Goal bar */}
          <div className="flex items-center gap-3 border-b border-white/5 px-4 py-2.5">
            <span className="text-xs text-arc-secondary shrink-0">{persona.goal_title}</span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-white/8">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold to-gold/70 transition-all duration-700"
                style={{ width: `${goalPct}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gold shrink-0">{goalPct}%</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 no-scrollbar">
            {messages.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <span className="text-4xl">✨</span>
                <p className="text-sm text-arc-secondary">Say hello to {persona.name}</p>
              </div>
            )}
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} personaName={persona.name} avatarUrl={persona.avatar_url} />
            ))}
            {sending && (
              <div className="flex items-end gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/20 text-sm">✨</div>
                <div className="rounded-2xl rounded-bl-sm bg-bg-surface px-4 py-3">
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Gift bar */}
          <div className="border-t border-white/8 px-3 py-2 bg-bg-surface/80">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {GIFTS.map(g => (
                <button
                  key={g.id}
                  onClick={() => sendGift(g)}
                  disabled={!!giftingId || goldBalance < g.gold}
                  className={[
                    'arc-pressable flex shrink-0 flex-col items-center gap-0.5 rounded-xl border px-3 py-2 text-center transition-all duration-150',
                    giftingId === g.id
                      ? 'border-gold/60 bg-gold/10 opacity-70'
                      : goldBalance < g.gold
                      ? 'border-white/5 bg-bg-hover opacity-40 cursor-not-allowed'
                      : 'border-white/8 bg-bg-hover hover:border-gold/40 hover:bg-gold/5',
                  ].join(' ')}
                >
                  <span className="text-xl leading-none">{g.icon}</span>
                  <span className="text-[10px] font-medium text-arc-secondary leading-tight">{g.name}</span>
                  <span className="text-[10px] font-semibold text-gold leading-tight">{g.gold}G</span>
                </button>
              ))}
            </div>
          </div>

          {/* Message input */}
          <div className="flex items-end gap-2 border-t border-white/8 bg-bg-surface px-3 py-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${persona.name}…`}
              rows={1}
              className="input-dark min-h-[44px] max-h-28 flex-1 resize-none py-2.5"
              style={{ height: 'auto' }}
              onInput={e => {
                const t = e.currentTarget;
                t.style.height = 'auto';
                t.style.height = `${Math.min(t.scrollHeight, 112)}px`;
              }}
            />
            <button
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              className="arc-pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold text-bg-primary transition-opacity disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Right sidebar (desktop only) */}
        <aside className="hidden w-64 shrink-0 flex-col gap-4 overflow-y-auto border-l border-white/8 bg-bg-surface p-4 lg:flex no-scrollbar">
          {/* Top Supporters */}
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-gold" />
              <p className="text-xs font-semibold uppercase tracking-widest text-arc-secondary">Top Supporters</p>
            </div>
            {supporters.length === 0 ? (
              <p className="text-xs text-arc-muted">Be the first supporter!</p>
            ) : (
              <ol className="space-y-2">
                {supporters.map((s, i) => (
                  <li key={s.user_id} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-arc-muted w-4">{i + 1}</span>
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/15 text-[10px] font-bold text-gold uppercase shrink-0">
                      {(s.display_name || 'A')[0]}
                    </div>
                    <span className="flex-1 truncate text-xs text-white">{s.display_name || 'Anonymous'}</span>
                    <span className="text-xs font-medium text-gold">{s.total_gold.toLocaleString()}G</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="arc-divider" />

          {/* Memory */}
          <div>
            <button
              onClick={() => setShowMemory(v => !v)}
              className="mb-2 flex w-full items-center justify-between gap-1.5"
            >
              <div className="flex items-center gap-1.5">
                <Brain className="h-3.5 w-3.5 text-gold" />
                <p className="text-xs font-semibold uppercase tracking-widest text-arc-secondary">Memory</p>
              </div>
              {showMemory ? <ChevronUp className="h-3 w-3 text-arc-muted" /> : <ChevronDown className="h-3 w-3 text-arc-muted" />}
            </button>
            {showMemory && (
              <p className="text-xs leading-relaxed text-arc-secondary">
                {memorySummary || `${persona.name} is still learning about you. Keep chatting!`}
              </p>
            )}
          </div>

          <div className="arc-divider" />

          {/* Gift guide */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-arc-secondary">Gift Guide</p>
            <ul className="space-y-1.5">
              {GIFTS.map(g => (
                <li key={g.id} className="flex items-center gap-2">
                  <span className="text-sm">{g.icon}</span>
                  <span className="flex-1 text-xs text-arc-secondary">{g.name}</span>
                  <span className="text-xs font-medium text-gold">{g.gold}G</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  personaName,
  avatarUrl,
}: {
  msg: ChatMessage;
  personaName: string;
  avatarUrl: string;
}) {
  const isUser = msg.role === 'user';

  if (msg.is_gift) {
    return (
      <div className="flex justify-center">
        <div className="flex items-center gap-2 rounded-full border border-gold/25 bg-gold/10 px-4 py-1.5 text-xs text-gold">
          <span>{msg.gift_name ?? 'Gift'}</span>
          <span className="opacity-60">·</span>
          <span>{msg.gift_gold ?? 0}G sent</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && (
        avatarUrl ? (
          <img src={avatarUrl} alt={personaName} className="h-7 w-7 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/20 text-sm">✨</div>
        )
      )}
      <div
        className={[
          'max-w-[72%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'rounded-br-sm bg-gold/15 text-white'
            : 'rounded-bl-sm bg-bg-surface text-white border border-white/8',
        ].join(' ')}
      >
        {msg.content}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-0.5">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-arc-secondary"
          style={{
            animation: `pulseSignalDot 1.1s ease-in-out ${i * 0.18}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
