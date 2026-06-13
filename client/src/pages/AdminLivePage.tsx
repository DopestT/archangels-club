import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio, AlertTriangle, Square, RefreshCw, Users, MessageSquare, Loader2 } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface AdminRoom {
  id: string;
  title: string;
  status: 'idle' | 'live' | 'ended';
  access_type: string;
  price_cents: number | null;
  started_at: string | null;
  ended_at: string | null;
  peak_viewer_count: number;
  creator_name: string;
  creator_email: string;
}

interface ReportedMessage {
  id: string;
  live_room_id: string;
  display_name: string;
  message: string;
  is_deleted: boolean;
  created_at: string;
  room_title: string;
}

export default function AdminLivePage() {
  const [rooms, setRooms]         = useState<AdminRoom[]>([]);
  const [reports, setReports]     = useState<ReportedMessage[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<'active' | 'recent' | 'reports'>('active');
  const [endingId, setEndingId]   = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Admin — Live Control · Archangels Club';
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [roomsData, reportsData] = await Promise.all([
        apiFetch('/api/live/admin/rooms') as Promise<AdminRoom[]>,
        apiFetch('/api/live/admin/reports') as Promise<ReportedMessage[]>,
      ]);
      setRooms(roomsData);
      setReports(reportsData);
    } catch {}
    setLoading(false);
  }

  async function endStream(roomId: string) {
    setEndingId(roomId);
    try {
      await apiFetch(`/api/live/${roomId}/end`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Admin force-ended' }),
      });
      await load();
    } catch {}
    setEndingId(null);
  }

  async function deleteMessage(roomId: string, msgId: string) {
    setDeletingId(msgId);
    try {
      await apiFetch(`/api/live/${roomId}/chat/${msgId}`, { method: 'DELETE' });
      setReports(prev => prev.filter(r => r.id !== msgId));
    } catch {}
    setDeletingId(null);
  }

  const liveRooms   = rooms.filter(r => r.status === 'live');
  const recentRooms = rooms.filter(r => r.status !== 'live').slice(0, 30);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Radio size={22} className="text-red-400" />
            <div>
              <h1 className="text-xl font-bold text-white">Live Control</h1>
              <p className="text-xs text-zinc-500">Monitor and moderate active streams</p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 text-xs hover:border-zinc-600 hover:text-white transition-colors arc-pressable"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{liveRooms.length}</p>
            <p className="text-xs text-zinc-500 mt-1">Live Now</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{rooms.length}</p>
            <p className="text-xs text-zinc-500 mt-1">Total Rooms</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${reports.length > 0 ? 'text-yellow-400' : 'text-zinc-600'}`}>
              {reports.length}
            </p>
            <p className="text-xs text-zinc-500 mt-1">Reported Messages</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-800">
          {(['active', 'recent', 'reports'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm capitalize transition-colors ${
                tab === t
                  ? 'text-white border-b-2 border-yellow-500'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t === 'reports' && reports.length > 0
                ? `Reports (${reports.length})`
                : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="text-yellow-400 animate-spin" />
          </div>
        ) : tab === 'active' ? (
          liveRooms.length === 0 ? (
            <div className="text-center py-16 text-zinc-600">
              <Radio size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No streams live right now</p>
            </div>
          ) : (
            <div className="space-y-3">
              {liveRooms.map(room => (
                <RoomRow
                  key={room.id}
                  room={room}
                  onEnd={() => endStream(room.id)}
                  ending={endingId === room.id}
                />
              ))}
            </div>
          )
        ) : tab === 'recent' ? (
          recentRooms.length === 0 ? (
            <div className="text-center py-16 text-zinc-600 text-sm">No recent rooms.</div>
          ) : (
            <div className="space-y-2">
              {recentRooms.map(room => (
                <RoomRow key={room.id} room={room} />
              ))}
            </div>
          )
        ) : (
          /* Reports tab */
          reports.length === 0 ? (
            <div className="text-center py-16 text-zinc-600">
              <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No reported messages</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map(msg => (
                <div key={msg.id} className="flex items-start gap-3 p-4 rounded-xl border border-yellow-800/30 bg-yellow-900/10">
                  <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-white">{msg.display_name}</span>
                      <span className="text-[10px] text-zinc-500">in "{msg.room_title}"</span>
                    </div>
                    <p className="text-sm text-zinc-300 break-words">{msg.message}</p>
                  </div>
                  <button
                    onClick={() => deleteMessage(msg.live_room_id, msg.id)}
                    disabled={deletingId === msg.id}
                    className="flex-shrink-0 px-3 py-1 rounded-lg bg-red-900/60 hover:bg-red-800 text-red-300 text-xs font-medium disabled:opacity-40 transition-colors"
                  >
                    {deletingId === msg.id ? '…' : 'Delete'}
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function RoomRow({
  room,
  onEnd,
  ending,
}: {
  room: AdminRoom;
  onEnd?: () => void;
  ending?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {room.status === 'live' && (
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-600 text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </span>
          )}
          {room.status === 'ended' && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-400">Ended</span>
          )}
          {room.status === 'idle' && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500">Idle</span>
          )}
          <span className="text-sm font-medium text-white truncate">{room.title}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span>{room.creator_name}</span>
          <span className="flex items-center gap-1">
            <Users size={11} />
            {room.peak_viewer_count} peak
          </span>
          <span className="capitalize">{room.access_type}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          to={`/live/${room.id}`}
          className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 text-xs hover:text-white hover:border-zinc-600 transition-colors"
        >
          View
        </Link>
        {room.status === 'live' && onEnd && (
          <button
            onClick={onEnd}
            disabled={ending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/60 hover:bg-red-800 text-red-300 text-xs font-medium disabled:opacity-40 transition-colors"
          >
            <Square size={11} />
            {ending ? 'Ending…' : 'End Stream'}
          </button>
        )}
      </div>
    </div>
  );
}
