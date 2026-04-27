import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Key, ArrowLeft, Copy, Check, Send, Users,
  Clock, Zap, Crown, ChevronRight, Star, Lock, Gift,
  AlertCircle, ExternalLink, Sparkles, MessageCircle,
} from 'lucide-react';
import Avatar from '../components/ui/Avatar';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, timeAgo } from '../lib/utils';
import type { KeyType, UserTierStatus } from '../types';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? (import.meta.env.PROD ? 'https://archangels-club-production.up.railway.app' : '');

// ─── Visual config ────────────────────────────────────────────────────────────

const KEY_CONFIG: Record<KeyType, {
  label: string; border: string; bg: string; badge: string; badgeBg: string;
  glow: string; codeColor: string;
}> = {
  black: {
    label: 'BLACK ACCESS',
    border: 'border-yellow-500/50',
    bg: 'bg-gradient-to-br from-zinc-900/80 to-black',
    badge: 'text-yellow-400',
    badgeBg: 'bg-yellow-500/10 border-yellow-500/30',
    glow: 'shadow-[0_0_30px_rgba(212,175,55,0.15)]',
    codeColor: 'text-yellow-300',
  },
  gold: {
    label: 'GOLD ACCESS',
    border: 'border-amber-400/50',
    bg: 'bg-gradient-to-br from-amber-950/20 to-bg-surface',
    badge: 'text-amber-400',
    badgeBg: 'bg-amber-400/10 border-amber-400/30',
    glow: 'shadow-[0_0_20px_rgba(251,191,36,0.08)]',
    codeColor: 'text-amber-300',
  },
  standard: {
    label: 'STANDARD',
    border: 'border-white/15',
    bg: 'bg-bg-surface',
    badge: 'text-arc-secondary',
    badgeBg: 'bg-white/5 border-white/10',
    glow: '',
    codeColor: 'text-arc-secondary',
  },
};

const TIER_CONFIG: Record<UserTierStatus, {
  label: string; color: string; bg: string; border: string; icon: React.ReactNode;
}> = {
  connector: {
    label: 'Connector',
    color: 'text-slate-300',
    bg: 'bg-slate-400/10',
    border: 'border-slate-400/30',
    icon: <Users className="w-3.5 h-3.5" />,
  },
  inner_circle: {
    label: 'Inner Circle',
    color: 'text-gold',
    bg: 'bg-gold-muted',
    border: 'border-gold-border',
    icon: <Crown className="w-3.5 h-3.5" />,
  },
  gatekeeper: {
    label: 'Gatekeeper',
    color: 'text-violet-300',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    icon: <Star className="w-3.5 h-3.5" />,
  },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  unused: { label: 'Available', color: 'text-gold', bg: 'bg-gold-muted border-gold-border' },
  used: { label: 'Redeemed', color: 'text-arc-success', bg: 'bg-arc-success/10 border-arc-success/25' },
  expired: { label: 'Expired', color: 'text-arc-muted', bg: 'bg-white/5 border-white/10' },
  transferred: { label: 'Transferred', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/25' },
};

type KeyFilter = 'all' | 'unused' | 'used';
type Section = 'vault' | 'drops' | 'exchange' | 'invites';

// ─── API types ────────────────────────────────────────────────────────────────

interface VaultSummary {
  total: number;
  available: number;
  used: number;
  tier_status: UserTierStatus;
  successful_invites: number;
  referral_earnings_total: number;
  by_type: { standard: number; gold: number; black: number };
}

interface KeyRaw {
  id: string;
  key_type: KeyType;
  status: string;
  invite_code: string;
  expires_at: string | null;
  invitee_name: string | null;
  invitee_avatar: string | null;
}

interface DropRaw {
  id: string;
  drop_name: string;
  drop_description: string | null;
  key_type: KeyType;
  quantity: number;
  claimed: number;
  start_time: string;
  end_time: string;
}

interface ExchangeListingRaw {
  id: string;
  key_type: KeyType;
  lister_name: string;
  lister_avatar: string | null;
  listed_at: string;
  status: string;
}

interface ReferralRaw {
  id: string;
  invite_code: string;
  key_type: KeyType;
  status: string;
  created_at: string;
  earnings: number | string;
  invitee_name: string | null;
  invitee_avatar: string | null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: UserTierStatus }) {
  const c = TIER_CONFIG[tier];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${c.color} ${c.bg} ${c.border}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

function KeyTypePill({ type }: { type: KeyType }) {
  const c = KEY_CONFIG[type];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wider ${c.badge} ${c.badgeBg}`}>
      <Key className="w-2.5 h-2.5" />
      {c.label}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.unused;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-medium ${c.color} ${c.bg}`}>
      {c.label}
    </span>
  );
}

function useCountdown(endTime: string) {
  const diff = new Date(endTime).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function DropCard({
  drop, onClaim, claimed, claimError,
}: {
  drop: DropRaw;
  onClaim: (id: string) => void;
  claimed: boolean;
  claimError?: string;
}) {
  const countdown = useCountdown(drop.end_time);
  const isUpcoming = new Date(drop.start_time) > new Date();
  const remaining = Number(drop.quantity) - Number(drop.claimed);
  const pct = Math.round((Number(drop.claimed) / Number(drop.quantity)) * 100);
  const c = KEY_CONFIG[drop.key_type] ?? KEY_CONFIG.standard;

  return (
    <div className={`rounded-xl border p-5 ${c.border} ${c.bg} ${c.glow}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <KeyTypePill type={drop.key_type} />
            {isUpcoming ? (
              <span className="text-[10px] text-arc-muted font-medium px-2 py-0.5 rounded-full bg-white/5 border border-white/10">Upcoming</span>
            ) : (
              <span className="text-[10px] text-arc-success font-medium px-2 py-0.5 rounded-full bg-arc-success/10 border border-arc-success/25">Live</span>
            )}
          </div>
          <h3 className="font-serif text-white text-base">{drop.drop_name}</h3>
          {drop.drop_description && (
            <p className="text-xs text-arc-secondary mt-1 leading-relaxed">{drop.drop_description}</p>
          )}
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-arc-muted">{drop.claimed} claimed</span>
          <span className="text-arc-secondary">{remaining} remaining</span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: drop.key_type === 'black' ? '#D4AF37' : drop.key_type === 'gold' ? '#FBBF24' : 'rgba(255,255,255,0.4)' }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs text-arc-muted">
          <Clock className="w-3.5 h-3.5" />
          {isUpcoming ? `Opens in ${countdown}` : `Closes in ${countdown}`}
        </div>
        {!isUpcoming && (
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={() => onClaim(drop.id)}
              disabled={claimed || remaining === 0}
              className={`text-xs px-4 py-2 rounded-lg font-medium transition-all ${
                claimed
                  ? 'bg-arc-success/15 text-arc-success border border-arc-success/25 cursor-default'
                  : remaining === 0
                  ? 'bg-white/5 text-arc-muted border border-white/10 cursor-default'
                  : 'btn-gold text-xs py-2 px-4'
              }`}
            >
              {claimed ? (
                <span className="flex items-center gap-1.5"><Check className="w-3 h-3" />Claimed</span>
              ) : remaining === 0 ? 'Sold Out' : 'Claim Key'}
            </button>
            {claimError && <p className="text-[10px] text-arc-error">{claimError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function KeyCard({
  accessKey,
  onSend, isSending,
  onCopyLink, copiedId,
  onList, listedId, listError,
}: {
  accessKey: KeyRaw;
  onSend: (id: string) => void;
  isSending: boolean;
  onCopyLink: (id: string, code: string) => void;
  copiedId: string | null;
  onList: (id: string) => void;
  listedId: string | null;
  listError?: string;
}) {
  const c = KEY_CONFIG[accessKey.key_type] ?? KEY_CONFIG.standard;
  const isUnused = accessKey.status === 'unused';

  return (
    <div className={`rounded-xl border p-5 transition-all ${c.border} ${c.bg} ${c.glow}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <KeyTypePill type={accessKey.key_type} />
            <StatusPill status={accessKey.status} />
          </div>
          <p className={`font-mono text-sm tracking-widest ${c.codeColor}`}>{accessKey.invite_code}</p>
          {accessKey.expires_at && (
            <p className="text-[10px] text-arc-muted mt-1">Expires {timeAgo(accessKey.expires_at)}</p>
          )}
        </div>
        {(accessKey.status === 'used' || accessKey.status === 'transferred') && accessKey.invitee_name && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Avatar src={accessKey.invitee_avatar ?? undefined} name={accessKey.invitee_name} size="xs" />
            <span className="text-xs text-arc-secondary">{accessKey.invitee_name}</span>
          </div>
        )}
      </div>

      {isUnused && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onSend(accessKey.id)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                isSending
                  ? 'bg-gold-muted border-gold text-gold'
                  : 'border-white/10 text-arc-secondary hover:border-gold/40 hover:text-white'
              }`}
            >
              <Send className="w-3 h-3" />
              Grant Entry
            </button>
            <button
              onClick={() => onCopyLink(accessKey.id, accessKey.invite_code)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-white/10 text-arc-secondary hover:border-gold/40 hover:text-white transition-all"
            >
              {copiedId === accessKey.id ? <Check className="w-3 h-3 text-arc-success" /> : <Copy className="w-3 h-3" />}
              {copiedId === accessKey.id ? 'Copied' : 'Invite Link'}
            </button>
            {listedId !== accessKey.id && (
              <button
                onClick={() => onList(accessKey.id)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-white/10 text-arc-secondary hover:border-gold/40 hover:text-white transition-all"
              >
                <ExternalLink className="w-3 h-3" />
                List on Exchange
              </button>
            )}
            {listedId === accessKey.id && (
              <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-blue-500/25 bg-blue-500/10 text-blue-400">
                <Check className="w-3 h-3" />
                Listed
              </span>
            )}
          </div>
          {listError && <p className="text-[10px] text-arc-error">{listError}</p>}
        </div>
      )}
    </div>
  );
}

function ExchangeCard({ listing }: { listing: ExchangeListingRaw }) {
  const c = KEY_CONFIG[listing.key_type] ?? KEY_CONFIG.standard;
  return (
    <div className="card-surface p-4 rounded-xl flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar src={listing.lister_avatar ?? undefined} name={listing.lister_name} size="sm" ring />
        <div className="min-w-0">
          <p className="text-sm text-white truncate">{listing.lister_name}</p>
          <KeyTypePill type={listing.key_type} />
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-xs text-arc-muted hidden sm:block">{timeAgo(listing.listed_at)}</span>
        <Link
          to="/messages"
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gold/30 text-gold hover:bg-gold-muted transition-all"
        >
          <MessageCircle className="w-3 h-3" />
          Message
        </Link>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AccessKeysPage() {
  const { token } = useAuth();
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const [vault, setVault] = useState<VaultSummary | null>(null);
  const [keys, setKeys] = useState<KeyRaw[]>([]);
  const [referrals, setReferrals] = useState<ReferralRaw[]>([]);
  const [vaultLoading, setVaultLoading] = useState(true);
  const [vaultError, setVaultError] = useState('');

  const [drops, setDrops] = useState<DropRaw[]>([]);

  const [exchange, setExchange] = useState<ExchangeListingRaw[]>([]);
  const [exchangeLoading, setExchangeLoading] = useState(false);
  const [exchangeLoaded, setExchangeLoaded] = useState(false);

  const [keyFilter, setKeyFilter] = useState<KeyFilter>('all');
  const [sendingKeyId, setSendingKeyId] = useState<string | null>(null);
  const [recipientUsername, setRecipientUsername] = useState('');
  const [sendStatus, setSendStatus] = useState<Record<string, 'sending' | 'sent' | 'error'>>({});
  const [sendError, setSendError] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [listedIds, setListedIds] = useState<Set<string>>(new Set());
  const [listError, setListError] = useState<Record<string, string>>({});
  const [claimedDropIds, setClaimedDropIds] = useState<Set<string>>(new Set());
  const [claimError, setClaimError] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<Section>('vault');

  // Load vault (keys + referrals + summary)
  useEffect(() => {
    if (!token) return;
    setVaultLoading(true);
    setVaultError('');
    fetch(`${API_BASE}/api/keys/vault`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setVaultError(data.error); return; }
        setKeys(data.keys ?? []);
        setReferrals(data.referrals ?? []);
        setVault(data.summary ?? null);
      })
      .catch(() => setVaultError('Unable to load your vault.'))
      .finally(() => setVaultLoading(false));

    fetch(`${API_BASE}/api/keys/drops`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setDrops(data); })
      .catch(() => {});
  }, [token]);

  // Load exchange lazily when section is opened
  useEffect(() => {
    if (activeSection !== 'exchange' || exchangeLoaded || !token) return;
    setExchangeLoading(true);
    fetch(`${API_BASE}/api/keys/exchange`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) { setExchange(data); setExchangeLoaded(true); }
      })
      .catch(() => {})
      .finally(() => setExchangeLoading(false));
  }, [activeSection, exchangeLoaded, token]);

  function handleSend(keyId: string) {
    setSendingKeyId(sendingKeyId === keyId ? null : keyId);
    setRecipientUsername('');
  }

  async function handleConfirmSend(keyId: string) {
    if (!recipientUsername.trim() || !token) return;
    setSendStatus((p) => ({ ...p, [keyId]: 'sending' }));
    setSendError((p) => ({ ...p, [keyId]: '' }));
    try {
      const res = await fetch(`${API_BASE}/api/keys/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ key_id: keyId, recipient_username: recipientUsername.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendStatus((p) => ({ ...p, [keyId]: 'error' }));
        setSendError((p) => ({ ...p, [keyId]: data.error ?? 'Transfer failed.' }));
        return;
      }
      setSendStatus((p) => ({ ...p, [keyId]: 'sent' }));
      setSendingKeyId(null);
      setRecipientUsername('');
      setKeys((prev) => prev.map((k) => k.id === keyId ? { ...k, status: 'transferred' } : k));
    } catch {
      setSendStatus((p) => ({ ...p, [keyId]: 'error' }));
      setSendError((p) => ({ ...p, [keyId]: 'Unable to reach server.' }));
    }
  }

  function handleCopyLink(keyId: string, code: string) {
    const link = `${window.location.origin}/signup?ref=${code}`;
    navigator.clipboard.writeText(link).catch(() => {});
    setCopiedId(keyId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleList(keyId: string) {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/keys/${keyId}/list`, { method: 'POST', headers: authHeaders });
      if (res.ok) {
        setListedIds((p) => new Set([...p, keyId]));
      } else {
        const data = await res.json();
        setListError((p) => ({ ...p, [keyId]: data.error ?? 'Failed to list key.' }));
      }
    } catch {
      setListError((p) => ({ ...p, [keyId]: 'Unable to reach server.' }));
    }
  }

  async function handleClaim(dropId: string) {
    if (!token) return;
    setClaimError((p) => ({ ...p, [dropId]: '' }));
    try {
      const res = await fetch(`${API_BASE}/api/keys/drops/${dropId}/claim`, { method: 'POST', headers: authHeaders });
      if (res.ok) {
        setClaimedDropIds((p) => new Set([...p, dropId]));
        setDrops((prev) => prev.map((d) => d.id === dropId ? { ...d, claimed: Number(d.claimed) + 1 } : d));
      } else {
        const data = await res.json();
        setClaimError((p) => ({ ...p, [dropId]: data.error ?? 'Failed to claim key.' }));
      }
    } catch {
      setClaimError((p) => ({ ...p, [dropId]: 'Unable to reach server.' }));
    }
  }

  const displayedKeys = keys.filter((k) => {
    if (keyFilter === 'unused') return k.status === 'unused';
    if (keyFilter === 'used') return k.status === 'used' || k.status === 'transferred';
    return true;
  });

  const availableDrops = drops.filter((d) => new Date(d.end_time) > new Date());
  const liveDrops = availableDrops.filter((d) => new Date(d.start_time) <= new Date());

  const sectionNav: { id: Section; label: string; badge?: number }[] = [
    { id: 'vault', label: 'Key Vault', badge: vault?.available },
    { id: 'drops', label: 'Key Drops', badge: liveDrops.length || undefined },
    { id: 'exchange', label: 'The Exchange', badge: exchangeLoaded ? exchange.length : undefined },
    { id: 'invites', label: 'Your Invites', badge: referrals.length },
  ];

  if (vaultLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (vaultError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-arc-error text-sm mb-4">{vaultError}</p>
          <Link to="/dashboard" className="btn-outline text-sm">Return to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Back */}
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-arc-secondary hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <p className="section-eyebrow mb-2">Access Vault</p>
            <h1 className="font-serif text-3xl text-white">Your Access Keys</h1>
            <p className="text-arc-secondary text-sm mt-1">
              Extend access. Grant entry. Invite privately.
            </p>
          </div>
          {vault && <TierBadge tier={vault.tier_status} />}
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Available', value: vault?.available ?? 0, sub: 'keys', color: 'text-gold' },
            { label: 'Black Keys', value: vault?.by_type.black ?? 0, sub: 'highest tier', color: 'text-yellow-400' },
            { label: 'Gold Keys', value: vault?.by_type.gold ?? 0, sub: 'priority access', color: 'text-amber-400' },
            { label: 'Invite Earnings', value: formatCurrency(vault?.referral_earnings_total ?? 0), sub: `${vault?.successful_invites ?? 0} approved`, color: 'text-arc-success' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="card-surface p-4 rounded-xl text-center">
              <p className={`font-serif text-xl ${color}`}>{value}</p>
              <p className="text-xs text-white mt-0.5">{label}</p>
              <p className="text-[10px] text-arc-muted mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Live drop alert */}
        {liveDrops.length > 0 && (
          <button
            onClick={() => setActiveSection('drops')}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-gold-muted border border-gold-border mb-6 text-left hover:bg-gold-muted/80 transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-gold/15 border border-gold-border flex items-center justify-center flex-shrink-0">
              <Gift className="w-4 h-4 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gold">{liveDrops[0].drop_name} is live</p>
              <p className="text-xs text-arc-secondary">{Number(liveDrops[0].quantity) - Number(liveDrops[0].claimed)} keys remaining — claim yours</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gold group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}

        {/* Section nav */}
        <div className="border-b border-gold-border/40 mb-8">
          <div className="flex gap-1 overflow-x-auto">
            {sectionNav.map(({ id, label, badge }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-sans transition-all border-b-2 -mb-px whitespace-nowrap ${
                  activeSection === id ? 'border-gold text-gold' : 'border-transparent text-arc-secondary hover:text-white'
                }`}
              >
                {label}
                {badge !== undefined && badge > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-bg-primary text-[10px] font-bold">
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── KEY VAULT ─────────────────────────────────────────────────────── */}
        {activeSection === 'vault' && (
          <div>
            <div className="flex items-center gap-2 mb-6">
              {(['all', 'unused', 'used'] as KeyFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setKeyFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all capitalize ${
                    keyFilter === f ? 'bg-gold-muted border-gold text-gold' : 'border-white/10 text-arc-secondary hover:border-white/20 hover:text-white'
                  }`}
                >
                  {f === 'all' ? 'All Keys' : f === 'unused' ? 'Available' : 'Redeemed'}
                </button>
              ))}
              <span className="text-xs text-arc-muted ml-auto">{displayedKeys.length} key{displayedKeys.length !== 1 ? 's' : ''}</span>
            </div>

            {displayedKeys.length === 0 && (
              <div className="card-surface p-12 rounded-xl text-center">
                <Key className="w-8 h-8 text-arc-muted mx-auto mb-3" />
                <p className="text-arc-secondary text-sm">No keys in your vault.</p>
                <p className="text-xs text-arc-muted mt-1">Keys are earned by inviting approved members or through Key Drops.</p>
              </div>
            )}

            <div className="space-y-4">
              {displayedKeys.map((key) => (
                <div key={key.id}>
                  <KeyCard
                    accessKey={key}
                    onSend={handleSend}
                    isSending={sendingKeyId === key.id}
                    onCopyLink={handleCopyLink}
                    copiedId={copiedId}
                    onList={handleList}
                    listedId={listedIds.has(key.id) ? key.id : null}
                    listError={listError[key.id]}
                  />

                  {/* Inline send form */}
                  {sendingKeyId === key.id && (
                    <div className="mt-2 p-4 rounded-xl border border-gold/20 bg-gold-muted/20">
                      <p className="text-xs text-arc-secondary mb-3 flex items-center gap-1.5">
                        <Zap className="w-3 h-3 text-gold" />
                        Grant Entry — enter the recipient's username
                      </p>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-arc-muted text-xs">@</span>
                          <input
                            type="text"
                            value={recipientUsername}
                            onChange={(e) => setRecipientUsername(e.target.value.replace(/\s/g, '').toLowerCase())}
                            placeholder="username"
                            className="input-dark pl-7 text-sm"
                            autoFocus
                          />
                        </div>
                        <button
                          onClick={() => handleConfirmSend(key.id)}
                          disabled={!recipientUsername.trim() || sendStatus[key.id] === 'sending'}
                          className="btn-gold px-4 py-2 text-sm"
                        >
                          {sendStatus[key.id] === 'sending' ? (
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : <Send className="w-4 h-4" />}
                          Send
                        </button>
                        <button onClick={() => setSendingKeyId(null)} className="px-3 py-2 text-xs text-arc-muted hover:text-white border border-white/10 rounded-lg transition-all">
                          Cancel
                        </button>
                      </div>
                      {sendError[key.id] && (
                        <p className="text-xs text-arc-error mt-2">{sendError[key.id]}</p>
                      )}
                      {sendStatus[key.id] === 'sent' && (
                        <p className="text-xs text-arc-success mt-2 flex items-center gap-1"><Check className="w-3 h-3" />Key transferred.</p>
                      )}
                      <p className="text-[10px] text-arc-muted mt-2">
                        The recipient must still pass admin approval. Invites do not bypass the review process.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Key type legend */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['standard', 'gold', 'black'] as KeyType[]).map((type) => {
                const c = KEY_CONFIG[type];
                const benefits: Record<KeyType, string[]> = {
                  standard: ['Normal review priority', 'Access to platform features', 'Invite tracking + earnings'],
                  gold: ['Faster review priority', 'Elevated access tier', 'Priority support visibility'],
                  black: ['Highest review priority', 'Top-tier access benefits', 'Maximum platform visibility'],
                };
                return (
                  <div key={type} className={`rounded-xl border p-4 ${c.border} ${c.bg}`}>
                    <KeyTypePill type={type} />
                    <ul className="mt-3 space-y-1.5">
                      {benefits[type].map((b) => (
                        <li key={b} className="flex items-start gap-1.5 text-xs text-arc-secondary">
                          <Check className={`w-3 h-3 flex-shrink-0 mt-0.5 ${c.badge}`} />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── KEY DROPS ─────────────────────────────────────────────────────── */}
        {activeSection === 'drops' && (
          <div className="space-y-6">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/8 border border-amber-500/20">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-arc-secondary leading-relaxed">
                Key Drops are time-limited events where eligible members can claim keys. All invited users must still pass admin approval.
              </p>
            </div>
            {availableDrops.map((drop) => (
              <DropCard
                key={drop.id}
                drop={drop}
                onClaim={handleClaim}
                claimed={claimedDropIds.has(drop.id)}
                claimError={claimError[drop.id]}
              />
            ))}
            {availableDrops.length === 0 && (
              <div className="card-surface p-12 rounded-xl text-center">
                <Gift className="w-8 h-8 text-arc-muted mx-auto mb-3" />
                <p className="text-arc-secondary text-sm">No active drops right now.</p>
                <p className="text-xs text-arc-muted mt-1">Watch this space — drops are announced without notice.</p>
              </div>
            )}
          </div>
        )}

        {/* ── THE EXCHANGE ──────────────────────────────────────────────────── */}
        {activeSection === 'exchange' && (
          <div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-white/4 border border-white/8 mb-6">
              <Lock className="w-4 h-4 text-arc-muted flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-white mb-0.5">Private Exchange</p>
                <p className="text-xs text-arc-muted leading-relaxed">
                  Members may offer keys for transfer. Message the lister to request — they decide whether to proceed.
                  Platform retains a 5% coordination fee on transferred keys.
                </p>
              </div>
            </div>
            {exchangeLoading && (
              <div className="flex justify-center py-12">
                <div className="w-7 h-7 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
              </div>
            )}
            {!exchangeLoading && exchange.length === 0 && (
              <div className="card-surface p-12 rounded-xl text-center">
                <ExternalLink className="w-8 h-8 text-arc-muted mx-auto mb-3" />
                <p className="text-arc-secondary text-sm">No keys listed for exchange right now.</p>
              </div>
            )}
            <div className="space-y-3">
              {exchange.map((listing) => (
                <ExchangeCard key={listing.id} listing={listing} />
              ))}
            </div>
          </div>
        )}

        {/* ── YOUR INVITES ──────────────────────────────────────────────────── */}
        {activeSection === 'invites' && (
          <div>
            <div className="card-surface p-5 rounded-xl mb-6 flex items-center gap-6">
              <div className="text-center">
                <p className="font-serif text-2xl text-arc-success">{formatCurrency(vault?.referral_earnings_total ?? 0)}</p>
                <p className="text-xs text-arc-muted mt-0.5">Total Invite Earnings</p>
              </div>
              <div className="h-10 w-px bg-white/5" />
              <div className="text-center">
                <p className="font-serif text-2xl text-gold">{vault?.successful_invites ?? 0}</p>
                <p className="text-xs text-arc-muted mt-0.5">Approved Invites</p>
              </div>
              <div className="h-10 w-px bg-white/5" />
              <div className="text-center">
                <p className="font-serif text-2xl text-white">{referrals.length}</p>
                <p className="text-xs text-arc-muted mt-0.5">Total Invites Sent</p>
              </div>
              {vault && (
                <div className="ml-auto text-right hidden sm:block">
                  <TierBadge tier={vault.tier_status} />
                  <p className="text-[10px] text-arc-muted mt-1">10 invites → Gatekeeper</p>
                </div>
              )}
            </div>

            {referrals.length === 0 ? (
              <div className="card-surface p-12 rounded-xl text-center">
                <Users className="w-8 h-8 text-arc-muted mx-auto mb-3" />
                <p className="text-arc-secondary text-sm">No invites sent yet.</p>
                <p className="text-xs text-arc-muted mt-1">Grant an access key to invite someone.</p>
              </div>
            ) : (
              <div className="card-surface rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/5">
                  <h3 className="font-serif text-base text-white">Invite Log</h3>
                </div>
                <div className="divide-y divide-white/5">
                  {referrals.map((ref) => (
                    <div key={ref.id} className="flex items-center gap-4 px-5 py-4">
                      <Avatar src={ref.invitee_avatar ?? undefined} name={ref.invitee_name ?? '?'} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">{ref.invitee_name ?? 'Pending registration'}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <KeyTypePill type={ref.key_type} />
                          <span className="font-mono text-[10px] text-arc-muted">{ref.invite_code}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${
                          ref.status === 'approved' ? 'text-arc-success bg-arc-success/10 border-arc-success/25'
                          : ref.status === 'pending' ? 'text-amber-400 bg-amber-400/10 border-amber-400/25'
                          : 'text-arc-error bg-arc-error/10 border-arc-error/25'
                        }`}>
                          {ref.status}
                        </span>
                        {Number(ref.earnings) > 0 && (
                          <p className="text-xs text-arc-success mt-1 font-serif">+{formatCurrency(Number(ref.earnings))}</p>
                        )}
                        <p className="text-[10px] text-arc-muted mt-0.5">{timeAgo(ref.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tier progression */}
            <div className="mt-6 card-surface p-5 rounded-xl">
              <h3 className="font-serif text-base text-white mb-4">Status Progression</h3>
              <div className="space-y-3">
                {([
                  { tier: 'connector' as UserTierStatus, label: 'Connector', req: '1–3 approved invites' },
                  { tier: 'inner_circle' as UserTierStatus, label: 'Inner Circle', req: '4–9 approved invites' },
                  { tier: 'gatekeeper' as UserTierStatus, label: 'Gatekeeper', req: '10+ approved invites' },
                ]).map(({ tier, label, req }) => {
                  const t = TIER_CONFIG[tier];
                  const active = vault?.tier_status === tier;
                  return (
                    <div key={tier} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      active ? `${t.bg} ${t.border}` : 'border-white/5 bg-white/2'
                    }`}>
                      <span className={`${t.color}`}>{t.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${active ? t.color : 'text-arc-secondary'}`}>{label}</p>
                        <p className="text-xs text-arc-muted">{req}</p>
                      </div>
                      {active && <Sparkles className={`w-4 h-4 ${t.color} flex-shrink-0`} />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
