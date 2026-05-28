import React from 'react';
import { Activity } from 'lucide-react';

interface Transaction { created_at: string; amount: number; }
interface AccessRequest { id: string; }
interface Report { id: string; }
interface CreatorApplication { id: string; }
interface ContentItem { id: string; }

interface Props {
  transactions: Transaction[];
  accessRequests: AccessRequest[];
  reports: Report[];
  creators: CreatorApplication[];
  content: ContentItem[];
  loading?: boolean;
}

type Status = 'clear' | 'elevated' | 'critical';

interface Vital {
  label: string;
  value: string | number;
  sub: string;
  status: Status;
}

function statusDot(s: Status) {
  if (s === 'clear')    return 'bg-arc-success';
  if (s === 'elevated') return 'bg-amber-400';
  return 'bg-arc-error';
}
function statusText(s: Status) {
  if (s === 'clear')    return 'text-arc-success';
  if (s === 'elevated') return 'text-amber-400';
  return 'text-arc-error';
}
function statusBorder(s: Status) {
  if (s === 'clear')    return 'border-arc-success/18';
  if (s === 'elevated') return 'border-amber-400/22';
  return 'border-arc-error/28';
}
function statusBg(s: Status) {
  if (s === 'clear')    return 'rgba(34,197,94,0.04)';
  if (s === 'elevated') return 'rgba(251,191,36,0.055)';
  return 'rgba(239,68,68,0.07)';
}
function statusTopAccent(s: Status) {
  if (s === 'clear')    return undefined;
  if (s === 'elevated') return 'rgba(251,191,36,0.5)';
  return 'rgba(239,68,68,0.65)';
}

function VitalSkeleton() {
  return (
    <div className="rounded-xl p-3.5 border border-white/5 animate-pulse">
      <div className="flex items-center gap-1.5 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-white/10 flex-shrink-0" />
        <div className="h-2 bg-white/6 rounded w-3/5" />
      </div>
      <div className="h-6 bg-white/8 rounded w-1/2 mb-2" />
      <div className="h-2 bg-white/5 rounded w-3/4" />
    </div>
  );
}

export default function PulseStatusPanel({ transactions, accessRequests, reports, creators, content, loading = false }: Props) {
  const now = Date.now();
  const last24h = transactions.filter(tx => now - new Date(tx.created_at).getTime() < 86_400_000);
  const revenueToday = last24h.reduce((sum, tx) => sum + Number(tx.amount), 0);

  const queueDepth  = accessRequests.length + creators.length;
  const modPressure = reports.length;
  const backlog     = content.length;

  const vitals: Vital[] = [
    {
      label: 'Transactions / 24h',
      value: last24h.length,
      sub: `$${revenueToday.toFixed(2)} gross`,
      status: last24h.length > 0 ? 'clear' : 'elevated',
    },
    {
      label: 'Access Queue',
      value: queueDepth,
      sub: queueDepth === 0 ? 'All clear' : `${accessRequests.length} access · ${creators.length} creator`,
      status: queueDepth === 0 ? 'clear' : queueDepth > 10 ? 'critical' : 'elevated',
    },
    {
      label: 'Moderation',
      value: modPressure,
      sub: modPressure === 0 ? 'No open reports' : `Open report${modPressure !== 1 ? 's' : ''}`,
      status: modPressure === 0 ? 'clear' : modPressure > 5 ? 'critical' : 'elevated',
    },
    {
      label: 'Content Backlog',
      value: backlog,
      sub: backlog === 0 ? 'Queue empty' : 'Pending review',
      status: backlog === 0 ? 'clear' : backlog > 8 ? 'critical' : 'elevated',
    },
    {
      label: 'System',
      value: 'Nominal',
      sub: 'All services live',
      status: 'clear',
    },
  ];

  const overallStatus: Status = vitals.some(v => v.status === 'critical')
    ? 'critical'
    : vitals.some(v => v.status === 'elevated')
    ? 'elevated'
    : 'clear';

  return (
    <section>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-arc-muted">Pulse Status</p>
          <div className="flex items-center gap-1.5">
            {/* Live status dot with ring on critical */}
            <span className="relative flex-shrink-0 flex items-center justify-center w-3 h-3">
              <span className={`block w-1.5 h-1.5 rounded-full ${statusDot(overallStatus)}`}
                style={{ animation: 'pulseSignalDot 2.6s ease-in-out infinite' }} />
              {overallStatus === 'critical' && (
                <span
                  className="absolute inset-0 rounded-full border border-arc-error"
                  style={{ animation: 'pulseRing 2.2s ease-out infinite' }}
                />
              )}
            </span>
            <span className={`text-[9px] font-semibold uppercase tracking-widest ${statusText(overallStatus)}`}>
              {overallStatus === 'clear'    ? 'All Systems Nominal'
               : overallStatus === 'elevated' ? 'Attention Required'
               : 'Intervention Needed'}
            </span>
          </div>
        </div>
        <Activity className="w-3.5 h-3.5 text-arc-muted/40" />
      </div>

      {/* Vital cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {loading
          ? [1, 2, 3, 4, 5].map(i => <VitalSkeleton key={i} />)
          : vitals.map((v) => {
              const topAccent = statusTopAccent(v.status);
              return (
                <div
                  key={v.label}
                  className={`relative rounded-xl p-3.5 border overflow-hidden transition-all duration-200 ${statusBorder(v.status)}`}
                  style={{ background: statusBg(v.status) }}
                >
                  {/* Top accent bar on non-clear vitals */}
                  {topAccent && (
                    <div
                      className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl"
                      style={{ background: topAccent }}
                    />
                  )}
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className={`w-1 h-1 rounded-full flex-shrink-0 ${statusDot(v.status)}`} />
                    <span className="text-[9px] font-semibold tracking-wide uppercase text-arc-muted truncate">{v.label}</span>
                  </div>
                  <p className={`font-serif text-xl font-normal ${statusText(v.status)}`}>{v.value}</p>
                  <p className="text-[10px] text-arc-muted mt-0.5 leading-tight">{v.sub}</p>
                </div>
              );
            })
        }
      </div>
    </section>
  );
}
