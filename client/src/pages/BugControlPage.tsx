import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Bug, AlertTriangle, Globe, Database, CreditCard, Shield,
  CheckCircle, XCircle, Clock, RefreshCw, LayoutDashboard,
  ChevronRight, Filter, Eye, EyeOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { timeAgo } from '../lib/utils';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

// ─── Types ────────────────────────────────────────────────────────────────────

type BugStatus   = 'open' | 'fixed' | 'ignored';
type BugSeverity = 'critical' | 'high' | 'medium' | 'low';
type BugArea     = 'frontend' | 'backend' | 'database' | 'stripe' | 'auth';

interface Bug {
  id:           string;
  status:       BugStatus;
  severity:     BugSeverity;
  area:         BugArea;
  type:         string;
  message:      string;
  file:         string | null;
  line:         number | null;
  route:        string | null;
  code:         string | null;
  fix_category: string | null;
  suggestion:   string | null;
  first_seen:   string | null;
  last_seen:    string | null;
}

interface Check {
  name: string;
  pass: boolean;
}

interface BugReport {
  timestamp:  string | null;
  git_sha:    string;
  summary:    { total: number; errors: number; warnings: number; all_pass: boolean };
  checks:     Check[];
  bugs:       Bug[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<BugSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const SEVERITY_STYLES: Record<BugSeverity, string> = {
  critical: 'text-red-400 bg-red-400/10 border-red-400/30',
  high:     'text-orange-400 bg-orange-400/10 border-orange-400/30',
  medium:   'text-amber-400 bg-amber-400/10 border-amber-400/30',
  low:      'text-arc-muted bg-white/5 border-white/10',
};

const AREA_STYLES: Record<string, string> = {
  frontend: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  backend:  'text-purple-400 bg-purple-400/10 border-purple-400/20',
  database: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  stripe:   'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
  auth:     'text-rose-400 bg-rose-400/10 border-rose-400/20',
};

const AREA_ICONS: Record<string, React.ReactNode> = {
  frontend: <Globe    className="w-3 h-3" />,
  backend:  <Shield   className="w-3 h-3" />,
  database: <Database className="w-3 h-3" />,
  stripe:   <CreditCard className="w-3 h-3" />,
  auth:     <Shield   className="w-3 h-3" />,
};

// ─── Overrides stored in localStorage ────────────────────────────────────────

const LS_KEY = 'arc_bug_overrides';

function loadOverrides(): Record<string, BugStatus> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}'); }
  catch { return {}; }
}

function saveOverrides(o: Record<string, BugStatus>) {
  localStorage.setItem(LS_KEY, JSON.stringify(o));
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label, count, icon, color, active, onClick,
}: {
  label: string; count: number; icon: React.ReactNode;
  color: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`card-surface rounded-xl p-5 text-left transition-all border ${
        active ? `${color} shadow-md` : 'border-white/5 hover:border-white/20'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`p-2 rounded-lg ${active ? 'bg-current/10' : 'bg-white/5'}`}>{icon}</span>
        <span className={`text-2xl font-serif ${count > 0 ? 'text-white' : 'text-arc-muted'}`}>{count}</span>
      </div>
      <p className="text-xs text-arc-muted">{label}</p>
    </button>
  );
}

// ─── Check badge ─────────────────────────────────────────────────────────────

function CheckBadge({ check }: { check: Check }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
      check.pass
        ? 'text-arc-success bg-arc-success/10 border-arc-success/25'
        : 'text-arc-error bg-arc-error/10 border-arc-error/25'
    }`}>
      {check.pass
        ? <CheckCircle className="w-3 h-3" />
        : <XCircle     className="w-3 h-3" />}
      {check.name}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BugControlPage() {
  const { token } = useAuth();
  const [report, setReport] = useState<BugReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overrides, setOverrides] = useState<Record<string, BugStatus>>(loadOverrides);
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [showIgnored, setShowIgnored] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/bug-report`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReport(await res.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function applyOverride(id: string, status: BugStatus) {
    const next = { ...overrides, [id]: status };
    setOverrides(next);
    saveOverrides(next);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-gold animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 text-arc-error mx-auto mb-3" />
          <p className="text-arc-error text-sm">{error}</p>
          <button onClick={load} className="btn-gold mt-4 text-xs">Retry</button>
        </div>
      </div>
    );
  }

  const bugs = (report?.bugs ?? []).map(b => ({
    ...b,
    status: overrides[b.id] ?? b.status,
  }));

  // Summary counts (before filters, excluding ignored from error tallies)
  const openBugs = bugs.filter(b => b.status === 'open');
  const criticalCount  = openBugs.filter(b => b.severity === 'critical').length;
  const apiCount       = openBugs.filter(b => b.area === 'backend' && b.type === 'api-health').length;
  const frontendCount  = openBugs.filter(b => b.area === 'frontend').length;
  const dbCount        = openBugs.filter(b => b.area === 'database').length;
  const stripeCount    = openBugs.filter(b => b.area === 'stripe').length;

  // Filtered list for table
  const visible = bugs
    .filter(b => showIgnored || b.status !== 'ignored')
    .filter(b => areaFilter === 'all'     || b.area === areaFilter)
    .filter(b => severityFilter === 'all' || b.severity === severityFilter)
    .sort((a, b) => {
      // open > ignored > fixed; within open sort by severity
      const statusOrder: Record<BugStatus, number> = { open: 0, ignored: 1, fixed: 2 };
      if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
      return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    });

  const checks = report?.checks ?? [];

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Link to="/admin/control-center" className="text-arc-muted hover:text-white transition-colors">
              <LayoutDashboard className="w-4 h-4" />
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-arc-muted" />
            <div>
              <p className="section-eyebrow mb-0.5">Admin</p>
              <h1 className="font-serif text-xl text-white flex items-center gap-2">
                <Bug className="w-5 h-5 text-gold" />
                Bug Control Center
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {report?.timestamp && (
              <span className="text-xs text-arc-muted hidden sm:block">
                Last scan: {timeAgo(report.timestamp)}
                {report.git_sha !== 'unknown' && ` · ${report.git_sha}`}
              </span>
            )}
            <button
              onClick={load}
              className="flex items-center gap-1.5 text-xs text-arc-secondary hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
        </div>

        {/* Check status strip */}
        {checks.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {checks.map(c => <CheckBadge key={c.name} check={c} />)}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
          <SummaryCard
            label="Critical"
            count={criticalCount}
            icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
            color="border-red-400/40"
            active={severityFilter === 'critical'}
            onClick={() => setSeverityFilter(f => f === 'critical' ? 'all' : 'critical')}
          />
          <SummaryCard
            label="API Failures"
            count={apiCount}
            icon={<Globe className="w-4 h-4 text-orange-400" />}
            color="border-orange-400/40"
            active={areaFilter === 'backend' && severityFilter === 'all'}
            onClick={() => setAreaFilter(f => f === 'backend' ? 'all' : 'backend')}
          />
          <SummaryCard
            label="Frontend Errors"
            count={frontendCount}
            icon={<Globe className="w-4 h-4 text-blue-400" />}
            color="border-blue-400/40"
            active={areaFilter === 'frontend'}
            onClick={() => setAreaFilter(f => f === 'frontend' ? 'all' : 'frontend')}
          />
          <SummaryCard
            label="Database / Schema"
            count={dbCount}
            icon={<Database className="w-4 h-4 text-emerald-400" />}
            color="border-emerald-400/40"
            active={areaFilter === 'database'}
            onClick={() => setAreaFilter(f => f === 'database' ? 'all' : 'database')}
          />
          <SummaryCard
            label="Payment Errors"
            count={stripeCount}
            icon={<CreditCard className="w-4 h-4 text-indigo-400" />}
            color="border-indigo-400/40"
            active={areaFilter === 'stripe'}
            onClick={() => setAreaFilter(f => f === 'stripe' ? 'all' : 'stripe')}
          />
        </div>

        {/* Filters + table */}
        <div className="card-surface rounded-xl overflow-hidden">
          {/* Table toolbar */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-arc-muted" />
              <select
                value={severityFilter}
                onChange={e => setSeverityFilter(e.target.value)}
                className="text-xs bg-bg-surface border border-white/10 rounded-lg px-2.5 py-1.5 text-arc-secondary focus:outline-none focus:border-gold/50"
              >
                <option value="all">All severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <select
                value={areaFilter}
                onChange={e => setAreaFilter(e.target.value)}
                className="text-xs bg-bg-surface border border-white/10 rounded-lg px-2.5 py-1.5 text-arc-secondary focus:outline-none focus:border-gold/50"
              >
                <option value="all">All areas</option>
                <option value="frontend">Frontend</option>
                <option value="backend">Backend</option>
                <option value="database">Database</option>
                <option value="stripe">Stripe</option>
                <option value="auth">Auth</option>
              </select>
            </div>
            <button
              onClick={() => setShowIgnored(v => !v)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                showIgnored
                  ? 'border-gold/40 text-gold'
                  : 'border-white/10 text-arc-muted hover:text-arc-secondary'
              }`}
            >
              {showIgnored ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              Ignored
            </button>
          </div>

          {/* Table */}
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <CheckCircle className="w-10 h-10 text-arc-success/60" />
              <p className="text-arc-muted text-sm">No active bugs detected.</p>
              {(areaFilter !== 'all' || severityFilter !== 'all') && (
                <button
                  onClick={() => { setAreaFilter('all'); setSeverityFilter('all'); }}
                  className="text-xs text-gold hover:text-gold/80"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {visible.map(bug => (
                <BugRow
                  key={bug.id}
                  bug={bug}
                  expanded={expandedId === bug.id}
                  onToggle={() => setExpandedId(id => id === bug.id ? null : bug.id)}
                  onMarkFixed={() => applyOverride(bug.id, 'fixed')}
                  onIgnore={() => applyOverride(bug.id, 'ignored')}
                  onReopen={() => applyOverride(bug.id, 'open')}
                />
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <p className="text-xs text-arc-muted mt-4 text-center">
          "Mark Fixed" and "Ignore" are local overrides — they persist in your browser.
          Re-run <code className="text-gold font-mono">npm run bug:report</code> to refresh the underlying data.
        </p>
      </div>
    </div>
  );
}

// ─── Bug row ──────────────────────────────────────────────────────────────────

function BugRow({
  bug, expanded, onToggle, onMarkFixed, onIgnore, onReopen,
}: {
  bug: Bug & { status: BugStatus };
  expanded: boolean;
  onToggle: () => void;
  onMarkFixed: () => void;
  onIgnore: () => void;
  onReopen: () => void;
}) {
  const loc = bug.file
    ? `${bug.file}${bug.line ? `:${bug.line}` : ''}`
    : bug.route ?? bug.type;

  return (
    <div className={`transition-colors ${bug.status !== 'open' ? 'opacity-50' : ''}`}>
      {/* Main row */}
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-white/[0.03] transition-colors"
      >
        {/* Status dot */}
        <div className="mt-1 flex-shrink-0">
          {bug.status === 'open'    && <div className="w-2 h-2 rounded-full bg-arc-error" />}
          {bug.status === 'fixed'   && <div className="w-2 h-2 rounded-full bg-arc-success" />}
          {bug.status === 'ignored' && <div className="w-2 h-2 rounded-full bg-arc-muted" />}
        </div>

        {/* Severity + area */}
        <div className="flex flex-col gap-1.5 flex-shrink-0 w-28">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border w-fit uppercase tracking-wide ${SEVERITY_STYLES[bug.severity]}`}>
            {bug.severity}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border w-fit flex items-center gap-1 ${AREA_STYLES[bug.area] ?? AREA_STYLES.backend}`}>
            {AREA_ICONS[bug.area]}
            {bug.area}
          </span>
        </div>

        {/* Message + location */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white truncate">{bug.message}</p>
          <p className="text-xs text-arc-muted mt-0.5 truncate font-mono">{loc}</p>
        </div>

        {/* Timestamps */}
        <div className="hidden sm:flex flex-col items-end gap-1 flex-shrink-0 text-right">
          {bug.last_seen && (
            <span className="text-[10px] text-arc-muted">
              <Clock className="w-2.5 h-2.5 inline mr-0.5" />
              {timeAgo(bug.last_seen)}
            </span>
          )}
          {bug.code && (
            <span className="text-[10px] text-arc-muted font-mono">{bug.code}</span>
          )}
        </div>

        <ChevronRight className={`w-3.5 h-3.5 text-arc-muted flex-shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-5 border-l border-white/10 ml-[2.25rem]">
          {bug.suggestion && (
            <div className="mb-3 p-3 rounded-lg bg-gold/5 border border-gold/15">
              <p className="text-[10px] text-gold uppercase tracking-wider mb-1">Suggested Fix</p>
              <p className="text-xs text-arc-secondary">{bug.suggestion}</p>
            </div>
          )}
          {bug.fix_category && (
            <p className="text-xs text-arc-muted mb-3">
              Fix category: <span className="text-white font-mono">{bug.fix_category}</span>
              {' · '}
              <code className="text-gold font-mono">npm run bug:fix</code> can auto-apply this.
            </p>
          )}
          <div className="flex gap-2 mt-3">
            {bug.status === 'open' && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); onMarkFixed(); }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-arc-success/10 border border-arc-success/30 text-arc-success hover:bg-arc-success/20 transition-colors"
                >
                  <CheckCircle className="w-3 h-3" /> Mark Fixed
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onIgnore(); }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-arc-muted hover:text-arc-secondary transition-colors"
                >
                  <EyeOff className="w-3 h-3" /> Ignore
                </button>
              </>
            )}
            {bug.status !== 'open' && (
              <button
                onClick={e => { e.stopPropagation(); onReopen(); }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-arc-muted hover:text-arc-secondary transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Reopen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
