import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Lock, Star, Radio, Clock,
  Archive, AlertCircle, Loader2, Sparkles,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import LiveStream, { type StreamConfig } from '../components/live/LiveStream';
import LiveChat from '../components/live/LiveChat';
import GoldGiftDrawer from '../components/live/GoldGiftDrawer';
import RoomGoalBar from '../components/live/RoomGoalBar';
import CrownRace, { type TopTipper } from '../components/live/CrownRace';

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
  const { token, isAdmin } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [room, setRoom]               = useState<RoomDetail | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [streamCfg, setStreamCfg]     = useState<StreamConfig | null>(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showGiftDrawer, setShowGiftDrawer]   = useState(false);
  const [tippers, setTippers]                 = useState<TopTipper[]>([]);
  const [raisedCents, setRaisedCents]         = useState(0);

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

  // Poll leaderboard every 30s when room is live and viewer has access
  useEffect(() => {
    if (!room || room.status !== 'live') return;
    const isGranted = room.is_creator || isAdmin || room.access.granted;
    if (!isGranted) return;

    async function fetchLeaderboard() {
      try {
        const data = await apiFetch(`/api/live/${id}/leaderboard`) as {
          tippers: TopTipper[];
          raised_cents: number;
        };
        setTippers(data.tippers);
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

  // Fetch stream token when room is live and user has access
  useEffect(() => {
    if (!room || !isLive || !canView || streamCfg) return;
    let cancelled = false;

    async function getToken() {
      setStreamLoading(true);
      try {
        const data = await apiFetch(`/api/live/${id}/token`, { method: 'POST' }) as { stream: StreamConfig; role: string };
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

  async function handleSubscribe() {
    if (!room) return;
    setCheckoutLoading(true);
    try {
      const data = await apiFetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subscription',
          creator_id: room.creator_id,
          return_path: `/live/${room.id}`,
        }),
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
        body: JSON.stringify({
          type: 'live_ticket',
          live_room_id: room.id,
        }),
      }) as { url: string; already_purchased?: boolean };
      if (data.already_purchased) {
        await fetchRoom();
        setCheckoutLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch (err: any) {
      setError(err?.message ?? 'Could not start checkout.');
      setCheckoutLoading(false);
    }
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 size={32} className="text-yellow-400 animate-spin" />
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-zinc-400 text-sm">{error}</p>
        <Link to="/live" className="text-yellow-400 text-sm hover:underline">Back to Live Rooms</Link>
      </div>
    );
  }

  if (!room) return null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* Back */}
        <Link to="/live" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
          <ArrowLeft size={16} /> Back to Live
        </Link>

        {/* Title row */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {isLive ? (
                <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-red-600 text-white animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  LIVE
                </span>
              ) : room.status === 'ended' ? (
                <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-700 text-zinc-400">Ended</span>
              ) : (
                <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-700 text-zinc-500">Starting Soon</span>
              )}
              {room.access_type === 'paid' && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400 border border-yellow-800/40">
                  <Lock size={10} /> Ticket ${((room.price_cents ?? 0) / 100).toFixed(2)}
                </span>
              )}
              {room.access_type === 'subscribers' && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-300 border border-purple-800/40">
                  <Star size={10} /> Subscribers Only
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-white">{room.title}</h1>
            {room.description && (
              <p className="text-sm text-zinc-400">{room.description}</p>
            )}
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              {room.creator_avatar ? (
                <img src={room.creator_avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-yellow-700/40 flex items-center justify-center text-yellow-400 text-[10px] font-bold">
                  {room.creator_name?.[0]?.toUpperCase() ?? '?'}
                </div>
              )}
              <Link to={`/creator/${room.creator_username}`} className="hover:text-zinc-300 transition-colors">
                {room.creator_name}
              </Link>
            </div>
          </div>

          {/* Replay coming soon badge */}
          <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-zinc-700 text-zinc-500 cursor-not-allowed" title="Not yet available">
            <Archive size={12} />
            Save replay to Vault — Coming Soon
          </div>
        </div>

        {/* Main content */}
        {canView ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Video area */}
            <div className="lg:col-span-2 space-y-3">
              <div className="aspect-video w-full bg-zinc-900 rounded-xl overflow-hidden">
                {streamLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 size={28} className="text-yellow-400 animate-spin" />
                  </div>
                ) : streamCfg ? (
                  <LiveStream
                    config={streamCfg}
                    role={room.is_creator ? 'host' : 'audience'}
                    isLive={isLive}
                  />
                ) : !isLive ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-600">
                    <Clock size={28} />
                    <p className="text-sm">Waiting for creator to go live…</p>
                  </div>
                ) : null}
              </div>

              {/* Goal bar */}
              {room.goal_amount_cents && room.goal_amount_cents > 0 && (
                <RoomGoalBar
                  goalAmountCents={room.goal_amount_cents}
                  goalTitle={room.goal_title}
                  raisedCents={raisedCents}
                />
              )}

              {/* Crown race leaderboard */}
              {tippers.length > 0 && <CrownRace tippers={tippers} />}

              {/* Gift button (audience only, when live) */}
              {isLive && !room.is_creator && !isAdmin && (
                <button
                  onClick={() => setShowGiftDrawer(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-yellow-600/30 bg-yellow-600/10 hover:bg-yellow-600/20 text-yellow-400 text-sm font-semibold transition-all arc-pressable"
                >
                  <Sparkles size={16} />
                  Send a Gold Gift
                </button>
              )}
            </div>

            {/* Chat */}
            <div className="h-[420px] lg:h-auto lg:min-h-[420px] rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden flex flex-col">
              <div className="px-3 py-2 border-b border-zinc-800 flex items-center gap-2">
                <Radio size={14} className="text-yellow-400" />
                <span className="text-sm font-medium text-zinc-300">Live Chat</span>
              </div>
              <div className="flex-1 min-h-0">
                <LiveChat roomId={room.id} isOpen={isLive} isCreator={room.is_creator} />
              </div>
            </div>
          </div>
        ) : (
          /* Paywall */
          <div className="max-w-md mx-auto py-12 space-y-6 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-yellow-900/30 border border-yellow-800/40 flex items-center justify-center">
              <Lock size={28} className="text-yellow-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-white">Private by Design</h2>
              <p className="text-sm text-zinc-400">
                {room.access_type === 'paid'
                  ? `Get a ticket to join ${room.creator_name}'s live room.`
                  : `This room is for subscribers of ${room.creator_name}.`}
              </p>
              {room.access.reason && (
                <p className="text-xs text-zinc-500">{room.access.reason}</p>
              )}
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="space-y-3">
              {room.access_type === 'paid' && (
                <button
                  onClick={handleTicket}
                  disabled={checkoutLoading}
                  className="w-full py-3 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-black font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {checkoutLoading ? <Loader2 size={16} className="animate-spin mx-auto" /> : (
                    <>{t('live.get_ticket')} — ${((room.price_cents ?? 0) / 100).toFixed(2)}</>
                  )}
                </button>
              )}
              {room.access_type === 'subscribers' && (
                <button
                  onClick={handleSubscribe}
                  disabled={checkoutLoading}
                  className="w-full py-3 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-black font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {checkoutLoading ? <Loader2 size={16} className="animate-spin mx-auto" /> : `Subscribe to ${room.creator_name}`}
                </button>
              )}
              <Link
                to={`/creator/${room.creator_username}`}
                className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                View creator profile
              </Link>
            </div>
          </div>
        )}

        {/* Admin end-stream button */}
        {isAdmin && !room.is_creator && isLive && (
          <div className="border-t border-zinc-800 pt-4">
            <AdminEndStream roomId={room.id} onEnded={fetchRoom} />
          </div>
        )}
      </div>

      {/* Gold Gift Drawer */}
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

function AdminEndStream({ roomId, onEnded }: { roomId: string; onEnded: () => void }) {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');

  async function end() {
    setLoading(true);
    try {
      await apiFetch(`/api/live/${roomId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      onEnded();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-red-900/40 bg-red-900/10">
      <span className="text-xs text-red-400 font-medium">Admin:</span>
      <input
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Reason (optional)"
        className="flex-1 bg-transparent border-none text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none"
      />
      <button
        onClick={end}
        disabled={loading}
        className="px-3 py-1 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-medium disabled:opacity-40 transition-colors"
      >
        {loading ? 'Ending…' : 'End Stream'}
      </button>
    </div>
  );
}
