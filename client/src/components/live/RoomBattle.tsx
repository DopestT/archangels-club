import React from 'react';
import { Swords } from 'lucide-react';

// TODO(room-battle): Room battles require a `live_battles` table pairing two
// live_room_ids with a shared end time and a score computed from tips+viewers.
// This component is a UI placeholder — wire to POST /api/live/battles when ready.

interface BattleTeam {
  creatorName: string;
  score: number;
  avatarUrl?: string | null;
}

interface Props {
  teamA: BattleTeam;
  teamB: BattleTeam;
  endsAt: Date;
}

export default function RoomBattle({ teamA, teamB, endsAt }: Props) {
  const total = teamA.score + teamB.score || 1;
  const pctA = Math.round((teamA.score / total) * 100);
  const pctB = 100 - pctA;
  const secondsLeft = Math.max(0, Math.floor((endsAt.getTime() - Date.now()) / 1000));
  const timeLabel = secondsLeft > 60
    ? `${Math.floor(secondsLeft / 60)}m left`
    : `${secondsLeft}s left`;

  return (
    <div className="mx-4 my-3 bg-zinc-900/80 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-1.5">
          <Swords size={13} className="text-red-400" />
          <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">Battle</span>
        </div>
        <span className="text-[10px] text-zinc-500">{timeLabel}</span>
      </div>

      <div className="flex items-center gap-2 px-3 py-3">
        {/* Team A */}
        <div className="flex-1 text-center min-w-0">
          {teamA.avatarUrl && (
            <img src={teamA.avatarUrl} alt="" className="w-8 h-8 rounded-full border border-zinc-700 mx-auto mb-1 object-cover" />
          )}
          <p className="text-xs font-semibold text-white truncate">{teamA.creatorName}</p>
          <p className="text-[10px] text-yellow-400 font-bold">{pctA}%</p>
        </div>

        {/* VS */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-black text-red-400">VS</span>
          {/* Battle bar */}
          <div className="flex h-2 rounded-full overflow-hidden w-24 border border-zinc-700">
            <div className="bg-yellow-500 transition-all duration-700" style={{ width: `${pctA}%` }} />
            <div className="bg-purple-500 transition-all duration-700" style={{ width: `${pctB}%` }} />
          </div>
        </div>

        {/* Team B */}
        <div className="flex-1 text-center min-w-0">
          {teamB.avatarUrl && (
            <img src={teamB.avatarUrl} alt="" className="w-8 h-8 rounded-full border border-zinc-700 mx-auto mb-1 object-cover" />
          )}
          <p className="text-xs font-semibold text-white truncate">{teamB.creatorName}</p>
          <p className="text-[10px] text-purple-400 font-bold">{pctB}%</p>
        </div>
      </div>
    </div>
  );
}
