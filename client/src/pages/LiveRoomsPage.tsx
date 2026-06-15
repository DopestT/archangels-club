import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Radio, Layers } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import LiveRoomCard, { type LiveRoom } from '../components/live/LiveRoomCard';

export default function LiveRoomsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Live Now — Archangels Club';
    load();
    const interval = setInterval(load, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, []);

  async function load() {
    try {
      const data = await apiFetch('/api/live') as LiveRoom[];
      setRooms(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load live rooms.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Radio size={28} className="text-yellow-400" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse border-2 border-black" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{t('live.now')}</h1>
              <p className="text-sm text-zinc-500">Private by Design. Live right now.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/live/swipe')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-yellow-600/30 bg-yellow-600/10 text-yellow-400 text-sm font-medium hover:bg-yellow-600/20 transition-colors shrink-0"
          >
            <Layers size={16} />
            Swipe
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 rounded-xl bg-zinc-900 animate-pulse border border-zinc-800" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16 space-y-3">
            <p className="text-zinc-500 text-sm">{error}</p>
            <button onClick={load} className="text-yellow-400 text-sm hover:underline">Try again</button>
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <Radio size={40} className="mx-auto text-zinc-700" />
            <p className="text-zinc-500">{t('live.no_rooms')}</p>
            <p className="text-xs text-zinc-600">Check back soon or explore creators to see who's going live.</p>
            <Link
              to="/explore"
              className="inline-block mt-2 px-4 py-2 rounded-lg border border-yellow-600/30 text-yellow-400 text-sm hover:bg-yellow-600/10 transition-colors"
            >
              Explore Creators
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map(room => (
              <LiveRoomCard key={room.id} room={room} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
