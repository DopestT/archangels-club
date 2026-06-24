import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Lock, Star, AlertCircle, Loader2,
  Users, Archive, ChevronDown, ChevronUp,
  Send, Trash2, Flag,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import LiveStream, { type StreamConfig } from '../components/live/LiveStream';
import GoldGiftDrawer, { type GiftPrivacy } from '../components/live/GoldGiftDrawer';
import RoomGoalBar from '../components/live/RoomGoalBar';
import TopSupporters, { type Supporter } from '../components/live/TopSupporters';
import EntryRitual from '../components/live/EntryRitual';
import LiveChat from '../components/live/LiveChat';

interface RoomDetail {
  id: string;
  title: string;
  description: string | null;
  access_type: 'free' | 'subscribers' | 'paid';
  price_cents: number | null;
  status: 'idle' | 'live' | 'ended';
  started_at: string | null;
  ended_at: string | null;
  peak_viewer_count: number;
  replay_available: boolean;
  creator_user_id: string;
  creator_name: string;
  creator_avatar: string | null;
  creator_username: string;
  creator_id: string;
  is_creator: boolean;
  access: { granted: boolean; reason?: string };
  goal_amount_cents: number | null;
  goal_title: string | null;
}

export default function LiveRoomPage() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const { t } = useLanguage();

  const [room, setRoom]                   = useState<RoomDetail | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [streamCfg, setStreamCfg]         = useState<StreamConfig | null>(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showGiftDrawer, setShowGiftDrawer]   = useState(false);
  const [supporters, setSupporters]           = useState<Supporter[]>([]);
  const [raisedCents, setRaisedCents]         = useState(0);
  const [showEntryRitual, setShowEntryRitual] = useState(false);
  const [ritualDone, setRitualDone]           = useState(false);

  const canView = room && (room.is_creator || isAdmin || room.access.granted);
  const isLive  = room?.status === 'live';

  const fetchRoom = useCallback(async () => {
    if (!id) return;
    try {
      const data = await apiFetch(`/api/live/${id}`) as RoomDetail;
      setRoom(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Room not found.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRoom();
    const interval = setInterval(fetchRoom, 10000);
    return () => clearInterval(interval);
  }, [fetchRoom]);

  // Entry ritual — show once when the user first gets access to a live room
  useEffect(() => {
    if (room?.status === 'live' && canView && !ritualDone) {
      setShowEntryRitual(true);
    }
  }, [room?.status, canView]); // eslint-disable-line react-hooks/exhaustive-deps

  // Leaderboard polling every 30s
  useEffect(() => {
    if (!room || room.status !== 'live') return;
    const granted = room.is_creator || isAdmin || room.access.granted;
    if (!granted) return;

    async function fetchLeaderboard() {
      try {
        const data = await apiFetch(`/api/live/${id}/leaderboard`) as {
          tippers: Supporter[];
          raised_cents: number;
        };
        setSupporters(data.tippers);
        setRaisedCents(data.raised_cents);
      } catch {}
    }
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, [id, room?.status, room?.is_creator, room?.access.granted, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (room) document.title = `${room.title} — Archangels Club`;
  }, [room?.title]);

  // Fetch Agora stream token when live and user has access
  useEffect(() => {
    if (!room || !isLive || !canView || streamCfg) return;
    let cancelled = false;
    async function getToken() {
      setStreamLoading(true);
      try {
        const data = await apiFetch(`/api/live/${id}/token`, { method: 'POST' }) as { stream: StreamConfig };
        if (!cancelled) setStreamCfg(data.stream);
      } catch (err: any) {
        if (!cancelled) setStreamCfg({ provider: 'none', message: err?.message ?? 'Token unavailable.' });
      } finally {
        if (!cancelled) setStreamLoading(false);
      }
    }
    getToken();
    return () => { cancelled = true; };
  }, [id, isLive, canView]); // eslint-disable-line react-hooks/exhaustive-deps

  const renewToken = useCallback(async (): Promise<string | null> => {
    try {
      const data = await apiFetch(`/api/live/${id}/token`, { method: 'POST' }) as { stream: StreamConfig };
      if (data.stream.provider === 'agora' && data.stream.token) {
        setStreamCfg(data.stream);
        return data.stream.token;
      }
    } catch { /* non-fatal */ }
    return null;
  }, [id]);

  async function handleSubscribe() {
    if (!room) return;
    setCheckoutLoading(true);
    try {
      const data = await apiFetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'subscription', creator_id: room.creator_id, return_path: `/live/${room.id}` }),
      }) as { url: string };
      window.location.href = data.url;
    } catch (err: any) {
      setError(err?.message ?? 'Could not start checkout.');
      setCheckoutLoading(false);
    }
  }

  async function handleTicket() {
    if (!room) return;
    setCheckoutLoading(true);
    try {
      const data = await apiFetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'live_ticket', live_room_id: room.id }),
      }) as { url: string; already_purchased?: boolean };
      if (data.already_purchased) { await fetchRoom(); setCheckoutLoading(false); return; }
      window.location.href = data.url;
    } catch (err: any) {
      setError(err?.message ?? 'Could not start checkout.');
      setCheckoutLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 size={28} className="animate-spin" style={{ color: '#d4af37' }} />
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <AlertCircle size={28} className="text-zinc-700" />
        <p className="text-zinc-500 text-sm">{error}</p>
        <Link to="/live" className="text-sm hover:underline" style={{ color: '#d4af37' }}>Back to Live Rooms</Link>
      </div>
    );
  }

  if (!room) return null;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* ── Entry Ritual Overlay ── */}
      {showEntryRitual && !ritualDone && (
        <EntryRitual
          creatorName={room.creator_name}
          goldBalance={undefined}
          onComplete={() => { setRitualDone(true); setShowEntryRitual(false); }}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Back */}
        <Link
          to="/live"
          className="inline-flex items-center gap-2 text-xs text-zinc-700 hover:text-zinc-400 transition-colors tracking-wide mb-6"
        >
          <ArrowLeft size={13} /> Back to Live Rooms
        </Link>

        {canView ? (
          /* ─── AUTHED ROOM VIEW ─────────────────────────────────────── */
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">

            {/* LEFT: Stage + modules */}
            <div className="space-y-4">
              {/* Luxury Live Stage */}
              <LuxuryLiveStage room={room} isLive={isLive}>
                <div className="aspect-video w-full bg-black">
                  {streamLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 size={24} className="animate-spin" style={{ color: '#d4af37' }} />
                    </div>
                  ) : streamCfg ? (
                    <LiveStream
                      config={streamCfg}
                      role={room.is_creator ? 'host' : 'audience'}
                      isLive={isLive}
                      onRenewToken={renewToken}
                    />
                  ) : !isLive ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.18)' }}
                      >
                        <span style={{ color: '#a8832a', fontSize: 16 }}>◆</span>
                      </div>
                      <p className="text-zinc-700 text-xs tracking-widest uppercase">Waiting for the room to open</p>
                    </div>
                  ) : null}
                </div>
              </LuxuryLiveStage>

              {/* Gold Gift Rail (audience only, live only) */}
              {isLive && !room.is_creator && !isAdmin && (
                <GoldGiftRail onOpenDrawer={() => setShowGiftDrawer(true)} />
              )}

              {/* Room Goal */}
              {room.goal_amount_cents && room.goal_amount_cents > 0 && (
                <RoomGoalBar
                  goalAmountCents={room.goal_amount_cents}
                  goalTitle={room.goal_title}
                  raisedCents={raisedCents}
                />
              )}

              {/* Room Patrons */}
              {supporters.length > 0 && (
                <TopSupporters supporters={supporters} collapsible />
              )}

              {/* Save Replay to Vault */}
              <SaveReplayToVaultCard />

              {/* Admin / Creator controls */}
              {(isAdmin || room.is_creator) && isLive && (
                <LiveRoomAdminBar room={room} onEnded={fetchRoom} />
              )}
            </div>

            {/* RIGHT: Inner Circle Chat */}
            <div
              className="flex flex-col rounded-2xl overflow-hidden lg:h-[calc(100vh-140px)] lg:sticky lg:top-6"
              style={{
                background: 'rgba(9,9,11,0.98)',
                border: '1px solid rgba(212,175,55,0.1)',
                minHeight: 420,
              }}
            >
              {/* Chat header */}
              <div
                className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
              >
                <div>
                  <p className="text-xs font-medium text-zinc-200 tracking-wide">Inner Circle Chat</p>
                  <p className="text-[9px] tracking-[0.2em] text-zinc-700 uppercase mt-0.5">Private Room</p>
                </div>
                {isLive && (
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: '#22c55e', boxShadow: '0 0 6px rgba(34,197,94,0.6)' }}
                  />
                )}
              </div>
              <div className="flex-1 min-h-0">
                <LiveChat roomId={room.id} isOpen={isLive} isCreator={room.is_creator} />
              </div>
            </div>
          </div>
        ) : (
          /* ─── PAYWALL VIEW ─────────────────────────────────────────── */
          <PaywallView
            room={room}
            error={error}
            checkoutLoading={checkoutLoading}
            onTicket={handleTicket}
            onSubscribe={handleSubscribe}
          />
        )}
      </div>

      {/* Gift drawer */}
      {showGiftDrawer && room && (
        <GoldGiftDrawer
          roomId={room.id}
          creatorId={room.creator_id}
          onClose={() => setShowGiftDrawer(false)}
          onSent={() => setShowGiftDrawer(false)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   LuxuryLiveStage
   Wraps the existing video player in a premium cinematic stage frame.
───────────────────────────────────────────────────────────────────────────── */
function LuxuryLiveStage({
  room,
  isLive,
  children,
}: {
  room: RoomDetail;
  isLive: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #0c0b0e 0%, #050404 100%)',
        border: '1px solid rgba(212,175,55,0.2)',
        boxShadow: '0 0 60px rgba(212,175,55,0.04), inset 0 0 80px rgba(0,0,0,0.5)',
      }}
    >
      {/* Gold top line */}
      <div
        style={{
          height: 1,
          background: 'linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.55) 50%, transparent 100%)',
        }}
      />

      {/* Video slot */}
      {children}

      {/* Creator name card + status overlay */}
      <div
        className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        {/* Creator identity */}
        <div className="flex items-center gap-3 min-w-0">
          {room.creator_avatar ? (
            <img
              src={room.creator_avatar}
              alt=""
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              style={{ boxShadow: '0 0 0 1px rgba(212,175,55,0.25)' }}
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'rgba(212,175,55,0.1)', color: '#d4af37' }}
            >
              {room.creator_name?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{room.title}</p>
            <Link
              to={`/creator/${room.creator_username}`}
              className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors tracking-wide"
            >
              Hosted by {room.creator_name}
            </Link>
          </div>
        </div>

        {/* Status + meta */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {isLive ? (
            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: '#ef4444', boxShadow: '0 0 6px rgba(239,68,68,0.7)', animation: 'pulse 2s infinite' }}
              />
              <span className="text-[10px] font-bold tracking-[0.2em] text-red-400 uppercase">Live</span>
            </div>
          ) : room.status === 'ended' ? (
            <span className="text-[10px] text-zinc-700 tracking-widest uppercase">Ended</span>
          ) : (
            <span className="text-[10px] text-zinc-700 tracking-widest uppercase">Private Room</span>
          )}

          {room.peak_viewer_count > 0 && (
            <div className="flex items-center gap-1 text-zinc-700">
              <Users size={11} />
              <span className="text-[10px] tabular-nums">{room.peak_viewer_count}</span>
            </div>
          )}

          {room.access_type === 'paid' && (
            <span
              className="text-[9px] px-2 py-0.5 rounded-full tracking-wide"
              style={{ background: 'rgba(212,175,55,0.07)', color: '#a8832a', border: '1px solid rgba(212,175,55,0.18)' }}
            >
              Ticket
            </span>
          )}
          {room.access_type === 'subscribers' && (
            <span
              className="text-[9px] px-2 py-0.5 rounded-full tracking-wide"
              style={{ background: 'rgba(124,58,237,0.07)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.18)' }}
            >
              Members
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   GoldGiftRail
   Compact trigger row below the stage. Opens GoldGiftDrawer.
───────────────────────────────────────────────────────────────────────────── */
function GoldGiftRail({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  return (
    <button
      onClick={onOpenDrawer}
      className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-medium tracking-wide transition-all"
      style={{
        background: 'rgba(212,175,55,0.05)',
        border: '1px solid rgba(212,175,55,0.18)',
        color: '#d4af37',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(212,175,55,0.09)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(212,175,55,0.05)';
      }}
    >
      <span style={{ fontSize: 13, opacity: 0.8 }}>◆</span>
      <span>Send a Gift</span>
      <span className="text-[10px] text-zinc-600 ml-1">Gold Rain · Halo Drop · Room Blessing</span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   SaveReplayToVaultCard
   Premium locked coming-soon feature card.
───────────────────────────────────────────────────────────────────────────── */
function SaveReplayToVaultCard() {
  return (
    <div
      className="flex items-center gap-4 px-4 py-4 rounded-xl"
      style={{
        background: 'rgba(11,10,13,0.9)',
        border: '1px solid rgba(212,175,55,0.1)',
      }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: 'rgba(212,175,55,0.07)',
          border: '1px solid rgba(212,175,55,0.18)',
          boxShadow: '0 0 14px rgba(212,175,55,0.05)',
        }}
      >
        <Archive size={15} style={{ color: '#d4af37' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-zinc-200">Save Replay to Vault</p>
        <p className="text-[10px] text-zinc-600 mt-0.5 leading-relaxed">
          Preserve premium live moments inside a private Vault collection.
        </p>
      </div>
      <span
        className="flex-shrink-0 text-[9px] tracking-[0.15em] uppercase font-semibold px-2.5 py-1 rounded-full"
        style={{
          color: '#a8832a',
          background: 'rgba(212,175,55,0.07)',
          border: '1px solid rgba(212,175,55,0.18)',
        }}
      >
        Coming Soon
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   LiveRoomAdminBar
   Clean admin / creator control bar. End Stream requires confirmation.
───────────────────────────────────────────────────────────────────────────── */
function LiveRoomAdminBar({ room, onEnded }: { room: RoomDetail; onEnded: () => void }) {
  const [reason, setReason]             = useState('');
  const [showConfirm, setShowConfirm]   = useState(false);
  const [ending, setEnding]             = useState(false);

  async function end() {
    setEnding(true);
    try {
      await apiFetch(`/api/live/${room.id}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      setShowConfirm(false);
      onEnded();
    } catch {}
    setEnding(false);
  }

  return (
    <div
      className="rounded-xl px-4 py-4 space-y-3"
      style={{ background: 'rgba(18,6,6,0.85)', border: '1px solid rgba(239,68,68,0.1)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[9px] tracking-[0.2em] text-red-950 uppercase">Admin Controls</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Stream Status:{' '}
            <span className="text-red-400 font-medium">Live</span>
          </p>
        </div>

        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: 'rgba(239,68,68,0.1)',
              color: '#f87171',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
          >
            End Stream
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfirm(false)}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors px-2 py-1"
            >
              Cancel
            </button>
            <button
              onClick={end}
              disabled={ending}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
              style={{ background: '#7f1d1d', color: '#fca5a5' }}
            >
              {ending ? 'Ending…' : 'Confirm End'}
            </button>
          </div>
        )}
      </div>

      {showConfirm && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-zinc-600 tracking-wide">End this Live Room?</p>
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="w-full bg-transparent text-xs text-zinc-400 placeholder-zinc-700 focus:outline-none border-b border-zinc-800 pb-1"
          />
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PaywallView
───────────────────────────────────────────────────────────────────────────── */
function PaywallView({
  room,
  error,
  checkoutLoading,
  onTicket,
  onSubscribe,
}: {
  room: RoomDetail;
  error: string | null;
  checkoutLoading: boolean;
  onTicket: () => void;
  onSubscribe: () => void;
}) {
  return (
    <div className="max-w-sm mx-auto py-20 space-y-8 text-center">
      <div
        className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
        style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)' }}
      >
        <Lock size={20} style={{ color: '#d4af37' }} />
      </div>

      <div className="space-y-2">
        <p className="text-[10px] tracking-[0.25em] text-zinc-700 uppercase">Private by Design</p>
        <h2 className="text-lg font-serif text-white">Members Only</h2>
        <p className="text-sm text-zinc-500 leading-relaxed">
          {room.access_type === 'paid'
            ? `A ticket is required to enter ${room.creator_name}'s live room.`
            : `This room is exclusively for subscribers of ${room.creator_name}.`}
        </p>
        {room.access?.reason && (
          <p className="text-xs text-zinc-700">{room.access.reason}</p>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-950/20 border border-red-900/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {room.access_type === 'paid' && (
          <button
            onClick={onTicket}
            disabled={checkoutLoading}
            className="w-full py-3 rounded-xl font-semibold text-sm tracking-wide transition-all disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, #d4af37 0%, #a8832a 100%)',
              color: '#000',
              boxShadow: '0 0 20px rgba(212,175,55,0.12)',
            }}
          >
            {checkoutLoading
              ? <Loader2 size={16} className="animate-spin mx-auto" />
              : `Get Ticket — $${((room.price_cents ?? 0) / 100).toFixed(2)}`
            }
          </button>
        )}
        {room.access_type === 'subscribers' && (
          <button
            onClick={onSubscribe}
            disabled={checkoutLoading}
            className="w-full py-3 rounded-xl font-semibold text-sm tracking-wide transition-all disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, #d4af37 0%, #a8832a 100%)',
              color: '#000',
            }}
          >
            {checkoutLoading
              ? <Loader2 size={16} className="animate-spin mx-auto" />
              : `Subscribe to ${room.creator_name}`
            }
          </button>
        )}
        <Link
          to={`/creator/${room.creator_username}`}
          className="block text-xs text-zinc-700 hover:text-zinc-500 transition-colors tracking-wide"
        >
          View creator profile
        </Link>
      </div>
    </div>
  );
}
