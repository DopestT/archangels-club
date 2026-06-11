import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Radio, Plus, Play, Square, Settings, Archive,
  AlertCircle, Loader2, ChevronDown, ChevronUp, Eye,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import LiveStream, { type StreamConfig } from '../components/live/LiveStream';

interface LiveRoom {
  id: string;
  title: string;
  description: string | null;
  access_type: 'free' | 'subscribers' | 'paid';
  price_cents: number | null;
  status: 'idle' | 'live' | 'ended';
  started_at: string | null;
  ended_at: string | null;
  peak_viewer_count: number;
  created_at: string;
}

export default function CreatorLiveStudio() {
  const { token } = useAuth();
  const { t } = useLanguage();

  const [rooms, setRooms]             = useState<LiveRoom[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [showCreate, setShowCreate]   = useState(false);
  const [streamCfg, setStreamCfg]     = useState<StreamConfig | null>(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [ending, setEnding]           = useState(false);

  // Create form state
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [accessType, setAccessType]   = useState<'free' | 'subscribers' | 'paid'>('free');
  const [priceDollars, setPriceDollars] = useState('');
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const activeRoom = rooms.find(r => r.status === 'idle' || r.status === 'live') ?? null;
  const isLive = activeRoom?.status === 'live';

  const fetchRooms = useCallback(async () => {
    try {
      const data = await apiFetch('/api/live/my-rooms') as LiveRoom[];
      setRooms(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load rooms.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = 'Live Studio — Archangels Club';
    fetchRooms();
    const interval = setInterval(fetchRooms, 10000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  async function createRoom() {
    if (!title.trim() || title.trim().length < 3) {
      setCreateError('Title must be at least 3 characters.');
      return;
    }
    if (accessType === 'paid') {
      const pc = Math.round(Number(priceDollars) * 100);
      if (!pc || pc < 100) {
        setCreateError('Paid rooms require a price of at least $1.00.');
        return;
      }
    }
    setCreating(true);
    setCreateError(null);
    try {
      const priceCents = accessType === 'paid' ? Math.round(Number(priceDollars) * 100) : null;
      await apiFetch('/api/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || null, access_type: accessType, price_cents: priceCents }),
      });
      setTitle('');
      setDescription('');
      setAccessType('free');
      setPriceDollars('');
      setShowCreate(false);
      await fetchRooms();
    } catch (err: any) {
      setCreateError(err?.message ?? 'Failed to create room.');
    } finally {
      setCreating(false);
    }
  }

  async function goLive() {
    if (!activeRoom) return;
    setStreamLoading(true);
    try {
      const data = await apiFetch(`/api/live/${activeRoom.id}/start`, { method: 'POST' }) as { ok: boolean; stream: StreamConfig };
      setStreamCfg(data.stream);
      await fetchRooms();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to go live.');
    } finally {
      setStreamLoading(false);
    }
  }

  async function endStream() {
    if (!activeRoom) return;
    setEnding(true);
    try {
      await apiFetch(`/api/live/${activeRoom.id}/end`, { method: 'POST' });
      setStreamCfg(null);
      await fetchRooms();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to end stream.');
    } finally {
      setEnding(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 size={28} className="text-yellow-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Radio size={24} className="text-yellow-400" />
            <div>
              <h1 className="text-xl font-bold text-white">{t('live.studio_title')}</h1>
              <p className="text-xs text-zinc-500">Private by Design. Live on your terms.</p>
            </div>
          </div>
          <Link to="/studio" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
            ← Back to Studio
          </Link>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-red-800/40 bg-red-900/10 text-sm text-red-400">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Active Room */}
        {activeRoom ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
            {/* Status bar */}
            <div className={`h-1 w-full ${isLive ? 'bg-red-500 animate-pulse' : 'bg-zinc-700'}`} />

            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {isLive ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full bg-red-600 text-white animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" /> LIVE
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-400">Ready</span>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-white">{activeRoom.title}</h2>
                  {activeRoom.description && (
                    <p className="text-sm text-zinc-400">{activeRoom.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span className="capitalize">{activeRoom.access_type}</span>
                    {activeRoom.price_cents && (
                      <span>${(activeRoom.price_cents / 100).toFixed(2)}</span>
                    )}
                    {activeRoom.peak_viewer_count > 0 && (
                      <span className="flex items-center gap-1">
                        <Eye size={11} /> {activeRoom.peak_viewer_count} peak
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  {!isLive ? (
                    <button
                      onClick={goLive}
                      disabled={streamLoading}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold disabled:opacity-40 transition-colors"
                    >
                      {streamLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                      {t('live.go_live')}
                    </button>
                  ) : (
                    <button
                      onClick={endStream}
                      disabled={ending}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold disabled:opacity-40 transition-colors"
                    >
                      {ending ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />}
                      {t('live.end_stream')}
                    </button>
                  )}
                  <Link
                    to={`/live/${activeRoom.id}`}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
                    title="View public room"
                  >
                    <Eye size={14} />
                  </Link>
                </div>
              </div>

              {/* Stream preview (when live) */}
              {isLive && streamCfg && (
                <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
                  <LiveStream
                    config={streamCfg}
                    role="host"
                    isLive={true}
                  />
                </div>
              )}

              {isLive && !streamCfg && (
                <div className="p-3 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-400">
                  <p className="font-medium text-zinc-300 mb-1">Streaming Instructions</p>
                  <p>Your room is marked live. Reload the page or use an external encoder pointing to your Agora channel: <code className="text-yellow-400">{activeRoom.id}</code></p>
                </div>
              )}

              {/* Replay coming soon */}
              <div className="flex items-center gap-2 text-xs text-zinc-600 cursor-not-allowed" title="Not yet available">
                <Archive size={12} />
                Save replay to Vault — Coming Soon
              </div>
            </div>
          </div>
        ) : (
          /* No active room — create prompt */
          <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 p-8 text-center space-y-4">
            <Radio size={36} className="mx-auto text-zinc-700" />
            <div>
              <p className="text-zinc-400 font-medium">No active room</p>
              <p className="text-xs text-zinc-600 mt-1">Create a room to go live with your audience.</p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-black font-bold text-sm transition-colors"
            >
              <Plus size={16} /> Create Live Room
            </button>
          </div>
        )}

        {/* Create room form */}
        {!activeRoom && showCreate && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Settings size={16} className="text-yellow-400" /> Room Settings
              </h3>
              <button onClick={() => setShowCreate(false)} className="text-zinc-500 hover:text-zinc-300 text-sm">Cancel</button>
            </div>

            {createError && (
              <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">
                {createError}
              </p>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Title *</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Exclusive Q&A Session"
                  maxLength={100}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-yellow-600/50"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What's this stream about?"
                  rows={2}
                  maxLength={500}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-yellow-600/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Access Type</label>
                <select
                  value={accessType}
                  onChange={e => setAccessType(e.target.value as 'free' | 'subscribers' | 'paid')}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-600/50"
                >
                  <option value="free">Free — anyone can join</option>
                  <option value="subscribers">Subscribers only</option>
                  <option value="paid">Paid ticket required</option>
                </select>
              </div>

              {accessType === 'paid' && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Ticket Price (USD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={priceDollars}
                      onChange={e => setPriceDollars(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-7 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-yellow-600/50"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={createRoom}
              disabled={creating}
              className="w-full py-2.5 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-black font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Create Room'}
            </button>
          </div>
        )}

        {/* Past rooms */}
        {rooms.filter(r => r.status === 'ended').length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-zinc-400">Past Streams</h3>
            <div className="space-y-2">
              {rooms.filter(r => r.status === 'ended').map(r => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900/40 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-300 truncate">{r.title}</p>
                    <p className="text-xs text-zinc-600">
                      {r.ended_at ? new Date(r.ended_at).toLocaleDateString() : 'Ended'} · {r.peak_viewer_count} peak viewers
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-600">
                    <Archive size={12} className="text-zinc-700" />
                    <span className="text-zinc-700">Replay soon</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
