import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Plus, RefreshCw, Play, Download, ChevronRight,
  Clock, CheckCircle, AlertTriangle, XCircle, Loader2,
  BarChart2, Search, FileText, Calendar, Zap, Archive,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useToast } from '../components/ui/Toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Book {
  id: string;
  title: string;
  subtitle: string;
  genre: string;
  status: string;
  pipeline_stage: string;
  pipeline_progress: number;
  pipeline_error: string | null;
  word_count_actual: number;
  word_count_target: number;
  price_usd: string;
  niche_score: string | null;
  created_at: string;
  updated_at: string;
  chapter_count: number;
  completed_chapters: number;
  epub_base64: string | null;
}

interface QueueEntry {
  id: string;
  book_id: string;
  title: string;
  genre: string;
  scheduled_date: string;
  slot: number;
  status: string;
  book_status: string;
  price_usd: string;
}

interface Stats {
  total_books: number;
  epub_ready: number;
  published: number;
  queued: number;
  generating: number;
  total_words: number;
  scheduled: number;
  next_open: string | null;
}

interface NicheResearch {
  id: string;
  query: string;
  genre: string;
  profitability_score: number;
  competition_score: number;
  demand_score: number;
  recommended_price: number;
  keyword_suggestions: string;
  title_hooks: string;
  notes: string;
  created_at: string;
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  idea: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/25',
  blueprinting: 'text-blue-400 bg-blue-400/10 border-blue-400/25',
  generating: 'text-violet-400 bg-violet-400/10 border-violet-400/25',
  review: 'text-amber-400 bg-amber-400/10 border-amber-400/25',
  epub_ready: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
  queued: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/25',
  published: 'text-green-400 bg-green-400/10 border-green-400/25',
  cancelled: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/25',
  failed: 'text-red-400 bg-red-400/10 border-red-400/25',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? STATUS_COLORS.idea;
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide ${cls}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function PipelineProgress({ book }: { book: Book }) {
  const isRunning = ['blueprint', 'generating_chapters', 'assembling', 'metadata', 'quality_check'].includes(book.pipeline_stage);
  if (!isRunning && book.pipeline_stage !== 'complete') return null;

  const stageLabel: Record<string, string> = {
    blueprint: 'Blueprinting…',
    generating_chapters: `Writing chapters (${book.completed_chapters}/${book.chapter_count})…`,
    assembling: 'Assembling EPUB…',
    metadata: 'Optimizing metadata…',
    quality_check: 'Quality check…',
    complete: 'Complete',
  };

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1">
        <span className="flex items-center gap-1">
          {isRunning && <Loader2 className="w-3 h-3 animate-spin" />}
          {stageLabel[book.pipeline_stage] ?? book.pipeline_stage}
        </span>
        <span>{book.pipeline_progress}%</span>
      </div>
      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${book.pipeline_progress}%` }}
        />
      </div>
    </div>
  );
}

// ── Create book modal ─────────────────────────────────────────────────────────

const GENRES = [
  'Self-Help', 'Business & Entrepreneurship', 'Health & Wellness', 'Personal Finance',
  'Productivity', 'Relationships & Dating', 'Parenting', 'Spirituality & Mindfulness',
  'History', 'Science & Technology', 'Fiction - Romance', 'Fiction - Thriller',
  'Fiction - Fantasy', 'Children\'s', 'Cookbook', 'Travel',
];

function CreateBookModal({ onClose, onCreated }: { onClose: () => void; onCreated: (book: Book) => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    genre: '',
    subgenre: '',
    title: '',
    word_count_target: 25000,
    author_name: 'Legacy Works Publishing',
    series_name: '',
    series_number: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.genre) { toast.error('Select a genre'); return; }
    setLoading(true);
    try {
      const res = await apiFetch('/api/legacy-works/books', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          series_number: form.series_number ? parseInt(form.series_number) : null,
        }),
      });
      if (res.error) throw new Error(res.error);
      toast.success('Book created');
      onCreated(res.book as Book);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create book');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-violet-400" />
            New Book Project
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Genre *</label>
            <select
              value={form.genre}
              onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
              required
            >
              <option value="">Select genre…</option>
              {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Subgenre / Focus Topic</label>
            <input
              value={form.subgenre}
              onChange={e => setForm(f => ({ ...f, subgenre: e.target.value }))}
              placeholder="e.g. Morning routines for entrepreneurs"
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Working Title (optional)</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="AI will generate if left blank"
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Target Word Count</label>
              <select
                value={form.word_count_target}
                onChange={e => setForm(f => ({ ...f, word_count_target: parseInt(e.target.value) }))}
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
              >
                <option value={10000}>10,000 (Short)</option>
                <option value={20000}>20,000 (Standard)</option>
                <option value={25000}>25,000 (Full)</option>
                <option value={40000}>40,000 (Long)</option>
                <option value={60000}>60,000 (Extended)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Author Name</label>
              <input
                value={form.author_name}
                onChange={e => setForm(f => ({ ...f, author_name: e.target.value }))}
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Series Name (optional)</label>
              <input
                value={form.series_name}
                onChange={e => setForm(f => ({ ...f, series_name: e.target.value }))}
                placeholder="Leave blank if standalone"
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Series #</label>
              <input
                type="number"
                min="1"
                value={form.series_number}
                onChange={e => setForm(f => ({ ...f, series_number: e.target.value }))}
                placeholder="1"
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-white/10 text-zinc-400 hover:text-white text-sm transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating…</> : 'Create Book'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Niche research modal ──────────────────────────────────────────────────────

function NicheResearchModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [genre, setGenre] = useState('');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NicheResearch | null>(null);

  const run = async () => {
    if (!genre || !topic) { toast.error('Fill in genre and topic'); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await apiFetch('/api/legacy-works/niche-research', {
        method: 'POST',
        body: JSON.stringify({ genre, topic }),
      });
      if (res.error) throw new Error(res.error);
      setResult(res.research as NicheResearch);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Research failed');
    } finally {
      setLoading(false);
    }
  };

  const parseArr = (s: string): string[] => { try { return JSON.parse(s) as string[]; } catch { return []; } };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/10 sticky top-0 bg-zinc-900 z-10">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-400" />
            Niche Research
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Genre</label>
              <select
                value={genre}
                onChange={e => setGenre(e.target.value)}
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
              >
                <option value="">Select…</option>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Topic / Niche</label>
              <input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g. stoic morning routine"
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>
          <button
            onClick={run}
            disabled={loading}
            className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Researching…</> : <><Search className="w-3.5 h-3.5" /> Analyze Niche</>}
          </button>

          {result && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Profitability', value: result.profitability_score, color: 'text-emerald-400' },
                  { label: 'Demand', value: result.demand_score, color: 'text-blue-400' },
                  { label: 'Competition', value: result.competition_score, color: 'text-amber-400' },
                ].map(m => (
                  <div key={m.label} className="bg-zinc-800 rounded-xl p-3 text-center">
                    <div className={`text-2xl font-bold ${m.color}`}>{Math.round(m.value)}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{m.label}</div>
                  </div>
                ))}
              </div>
              <div className="bg-zinc-800 rounded-xl p-3">
                <div className="text-xs text-zinc-400 mb-1">Recommended Price</div>
                <div className="text-lg font-bold text-white">${result.recommended_price}</div>
              </div>
              <div className="bg-zinc-800 rounded-xl p-3">
                <div className="text-xs text-zinc-400 mb-2 font-medium">Keywords</div>
                <div className="flex flex-wrap gap-1.5">
                  {parseArr(result.keyword_suggestions).map((kw, i) => (
                    <span key={i} className="text-[11px] bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded px-2 py-0.5">{kw}</span>
                  ))}
                </div>
              </div>
              <div className="bg-zinc-800 rounded-xl p-3">
                <div className="text-xs text-zinc-400 mb-2 font-medium">Title Angles</div>
                <ul className="space-y-1">
                  {parseArr(result.title_hooks).map((h, i) => (
                    <li key={i} className="text-sm text-white flex gap-2"><span className="text-zinc-600">·</span>{h}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-zinc-800 rounded-xl p-3 text-sm text-zinc-300 leading-relaxed">
                {result.notes}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Book detail panel ─────────────────────────────────────────────────────────

function BookDetailPanel({
  book,
  onClose,
  onRefresh,
}: {
  book: Book;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const toast = useToast();
  const [running, setRunning] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const [chapters, setChapters] = useState<{ chapter_number: number; title: string; word_count: number; status: string }[]>([]);
  const [metadata, setMetadata] = useState<{
    keywords: string[]; bisac_primary: string; bisac_secondary: string;
    description: string; price_usd: number; kdp_checklist: { item: string; done: boolean }[];
  } | null>(null);
  const [tab, setTab] = useState<'overview' | 'chapters' | 'metadata'>('overview');

  useEffect(() => {
    apiFetch(`/api/legacy-works/books/${book.id}`).then(r => {
      if (r.chapters) setChapters(r.chapters as typeof chapters);
    });
    if (['epub_ready', 'queued', 'published', 'review'].includes(book.status)) {
      apiFetch(`/api/legacy-works/books/${book.id}/export/metadata`).then(r => {
        if (!r.error) setMetadata(r as typeof metadata);
      });
    }
  }, [book.id, book.status]);

  const runPipeline = async () => {
    setRunning(true);
    try {
      const res = await apiFetch(`/api/legacy-works/books/${book.id}/pipeline/run`, { method: 'POST' });
      if (res.error) throw new Error(res.error);
      toast.success('Pipeline started — check progress below');
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start pipeline');
    } finally {
      setRunning(false);
    }
  };

  const addToQueue = async () => {
    setQueueing(true);
    try {
      const res = await apiFetch(`/api/legacy-works/books/${book.id}/queue`, { method: 'POST' });
      if (res.error) throw new Error(res.error);
      toast.success(`Scheduled for ${res.scheduled_date} (slot ${res.slot})`);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to schedule');
    } finally {
      setQueueing(false);
    }
  };

  const downloadEpub = () => {
    window.location.href = `/api/legacy-works/books/${book.id}/export/epub`;
  };

  const isRunning = ['blueprint', 'generating_chapters', 'assembling', 'metadata', 'quality_check'].includes(book.pipeline_stage);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-950 border-l border-white/10 w-full max-w-lg h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-white font-semibold text-base leading-tight truncate">
                {book.title || <span className="text-zinc-500 italic">Untitled</span>}
              </h2>
              {book.subtitle && <p className="text-zinc-400 text-xs mt-0.5 truncate">{book.subtitle}</p>}
              <div className="flex items-center gap-2 mt-2">
                <StatusBadge status={book.status} />
                <span className="text-[10px] text-zinc-600">{book.genre}</span>
              </div>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors text-xl leading-none flex-shrink-0">×</button>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-b border-white/10 flex gap-2 flex-shrink-0">
          {!isRunning && (
            <button
              onClick={runPipeline}
              disabled={running}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {book.pipeline_stage === 'complete' || book.status === 'epub_ready' ? 'Re-run Pipeline' : 'Run Pipeline'}
            </button>
          )}
          {book.epub_base64 !== null && ['epub_ready', 'queued', 'published'].includes(book.status) && (
            <button
              onClick={downloadEpub}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-sm border border-emerald-600/20 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              EPUB
            </button>
          )}
          {book.status === 'epub_ready' && (
            <button
              onClick={addToQueue}
              disabled={queueing}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 text-sm border border-cyan-600/20 transition-colors disabled:opacity-50"
            >
              {queueing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
              Queue
            </button>
          )}
        </div>

        {/* Pipeline progress */}
        {(isRunning || book.pipeline_error) && (
          <div className="px-4 py-3 border-b border-white/10 flex-shrink-0">
            <PipelineProgress book={book} />
            {book.pipeline_error && (
              <p className="text-[11px] text-red-400 mt-2 flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                {book.pipeline_error}
              </p>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-white/10 flex-shrink-0">
          {(['overview', 'chapters', 'metadata'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors ${tab === t ? 'text-white border-b-2 border-violet-500' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === 'overview' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Words Written', value: book.word_count_actual.toLocaleString(), sub: `/ ${book.word_count_target.toLocaleString()} target` },
                  { label: 'Chapters', value: `${book.completed_chapters}/${book.chapter_count}`, sub: 'complete' },
                  { label: 'Price', value: `$${parseFloat(book.price_usd).toFixed(2)}`, sub: 'USD' },
                ].map(s => (
                  <div key={s.label} className="bg-zinc-900 rounded-xl p-3">
                    <div className="text-base font-bold text-white">{s.value}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{s.label}</div>
                    <div className="text-[10px] text-zinc-600">{s.sub}</div>
                  </div>
                ))}
              </div>
              <div className="bg-zinc-900 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-zinc-500">Genre</span><span className="text-white">{book.genre}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Pipeline stage</span><span className="text-zinc-300">{book.pipeline_stage}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Last updated</span><span className="text-zinc-300">{new Date(book.updated_at).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Created</span><span className="text-zinc-300">{new Date(book.created_at).toLocaleDateString()}</span></div>
              </div>
            </>
          )}

          {tab === 'chapters' && (
            <div className="space-y-2">
              {chapters.length === 0 && (
                <div className="text-center py-8 text-zinc-600 text-sm">
                  Run the pipeline to generate chapters
                </div>
              )}
              {chapters.map(ch => (
                <div key={ch.chapter_number} className="flex items-center gap-3 bg-zinc-900 rounded-xl p-3">
                  <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-500 font-medium flex-shrink-0">
                    {ch.chapter_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{ch.title}</div>
                    <div className="text-[11px] text-zinc-600">{ch.word_count > 0 ? `${ch.word_count.toLocaleString()} words` : '—'}</div>
                  </div>
                  <div className="flex-shrink-0">
                    {ch.status === 'complete' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                    {ch.status === 'generating' && <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />}
                    {ch.status === 'failed' && <XCircle className="w-4 h-4 text-red-500" />}
                    {ch.status === 'pending' && <Clock className="w-4 h-4 text-zinc-600" />}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'metadata' && metadata && (
            <div className="space-y-4">
              <div className="bg-zinc-900 rounded-xl p-3 space-y-2">
                <h3 className="text-xs font-medium text-zinc-400">KDP Upload Checklist</h3>
                {metadata.kdp_checklist.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {item.done ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />}
                    <span className={item.done ? 'text-zinc-300' : 'text-zinc-600'}>{item.item}</span>
                  </div>
                ))}
              </div>
              <div className="bg-zinc-900 rounded-xl p-3">
                <div className="text-xs text-zinc-400 mb-2 font-medium">BISAC Categories</div>
                <div className="text-sm text-white">{metadata.bisac_primary}</div>
                <div className="text-sm text-zinc-400">{metadata.bisac_secondary}</div>
              </div>
              <div className="bg-zinc-900 rounded-xl p-3">
                <div className="text-xs text-zinc-400 mb-2 font-medium">Keywords (7)</div>
                <div className="flex flex-wrap gap-1.5">
                  {metadata.keywords.map((kw, i) => (
                    <span key={i} className="text-[11px] bg-violet-500/10 text-violet-300 border border-violet-500/20 rounded px-2 py-0.5">{kw}</span>
                  ))}
                </div>
              </div>
              {metadata.description && (
                <div className="bg-zinc-900 rounded-xl p-3">
                  <div className="text-xs text-zinc-400 mb-2 font-medium">Description</div>
                  <div className="text-sm text-zinc-300 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: metadata.description.substring(0, 500) + (metadata.description.length > 500 ? '…' : '') }}
                  />
                </div>
              )}
            </div>
          )}

          {tab === 'metadata' && !metadata && (
            <div className="text-center py-8 text-zinc-600 text-sm">
              Complete the pipeline to generate metadata
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LegacyWorksPublishing() {
  const [books, setBooks] = useState<Book[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showNiche, setShowNiche] = useState(false);
  const [tab, setTab] = useState<'books' | 'queue'>('books');

  const loadAll = useCallback(async () => {
    try {
      const [booksRes, queueRes, statsRes] = await Promise.all([
        apiFetch('/api/legacy-works/books'),
        apiFetch('/api/legacy-works/queue'),
        apiFetch('/api/legacy-works/stats'),
      ]);
      if (booksRes.books) setBooks(booksRes.books as Book[]);
      if (queueRes.queue) setQueue(queueRes.queue as QueueEntry[]);
      if (statsRes.total_books !== undefined) setStats(statsRes as Stats);
    } catch (err) {
      console.error('[lw] loadAll error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    // Poll for pipeline updates every 8s when any book is generating
    const interval = setInterval(() => {
      const hasRunning = books.some(b =>
        ['blueprint', 'generating_chapters', 'assembling', 'metadata', 'quality_check'].includes(b.pipeline_stage)
      );
      if (hasRunning) loadAll();
    }, 8000);
    return () => clearInterval(interval);
  }, [loadAll, books]);

  const handleBookCreated = (book: Book) => {
    setBooks(prev => [book, ...prev]);
    setShowCreate(false);
    setSelectedBook(book);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white flex items-center gap-2">
              <Archive className="w-5 h-5 text-violet-400" />
              Legacy Works Publishing
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">Amazon KDP Automation Pipeline</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNiche(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-blue-500/40 text-zinc-400 hover:text-blue-400 text-sm transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              Niche Research
            </button>
            <button
              onClick={loadAll}
              className="p-1.5 rounded-lg border border-white/10 hover:border-white/20 text-zinc-500 hover:text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Book
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total Books', value: stats.total_books, icon: BookOpen, color: 'text-zinc-300' },
              { label: 'EPUB Ready', value: stats.epub_ready, icon: CheckCircle, color: 'text-emerald-400' },
              { label: 'Queued', value: stats.queued, icon: Calendar, color: 'text-cyan-400' },
              { label: 'Generating', value: stats.generating, icon: Zap, color: 'text-violet-400' },
              { label: 'Published', value: stats.published, icon: BarChart2, color: 'text-green-400' },
              { label: 'Total Words', value: stats.total_words >= 1000 ? `${(stats.total_words / 1000).toFixed(0)}k` : stats.total_words, icon: FileText, color: 'text-blue-400' },
            ].map(s => (
              <div key={s.label} className="bg-zinc-900 border border-white/5 rounded-xl p-3">
                <s.icon className={`w-4 h-4 ${s.color} mb-1.5`} />
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-zinc-600 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 border-b border-white/10">
          {(['books', 'queue'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-2.5 text-sm font-medium capitalize transition-colors border-b-2 ${tab === t ? 'text-white border-violet-500' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}
            >
              {t === 'queue' ? `Publishing Queue (${queue.length})` : `Books (${books.length})`}
            </button>
          ))}
        </div>

        {/* Books tab */}
        {tab === 'books' && (
          <div>
            {books.length === 0 ? (
              <div className="text-center py-16">
                <BookOpen className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-500 text-sm">No books yet</p>
                <button onClick={() => setShowCreate(true)} className="mt-3 text-violet-400 hover:text-violet-300 text-sm transition-colors">
                  Create your first book →
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {books.map(book => (
                  <div
                    key={book.id}
                    onClick={() => setSelectedBook(book)}
                    className="bg-zinc-900 border border-white/5 hover:border-violet-500/30 rounded-xl p-4 cursor-pointer transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="text-sm font-medium text-white group-hover:text-violet-200 transition-colors leading-tight line-clamp-2">
                        {book.title || <span className="text-zinc-500 italic">Untitled — {book.genre}</span>}
                      </h3>
                      <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 flex-shrink-0 mt-0.5 transition-colors" />
                    </div>
                    {book.subtitle && (
                      <p className="text-[11px] text-zinc-500 mb-2 line-clamp-1">{book.subtitle}</p>
                    )}
                    <div className="flex items-center gap-2 mb-3">
                      <StatusBadge status={book.status} />
                      <span className="text-[10px] text-zinc-600">{book.genre}</span>
                    </div>
                    <PipelineProgress book={book} />
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 text-[11px] text-zinc-600">
                      <span>{book.word_count_actual > 0 ? `${book.word_count_actual.toLocaleString()} words` : `Target: ${book.word_count_target.toLocaleString()}`}</span>
                      <span>${parseFloat(book.price_usd).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Queue tab */}
        {tab === 'queue' && (
          <div>
            {queue.length === 0 ? (
              <div className="text-center py-16">
                <Calendar className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-500 text-sm">Publishing queue is empty</p>
                <p className="text-zinc-600 text-xs mt-1">Finish a book and queue it for Amazon KDP upload</p>
              </div>
            ) : (
              <div className="space-y-2">
                {queue.map(entry => (
                  <div key={entry.id} className="flex items-center gap-4 bg-zinc-900 border border-white/5 rounded-xl p-4">
                    <div className="text-center bg-zinc-800 rounded-lg p-2 min-w-[52px]">
                      <div className="text-[10px] text-zinc-500 uppercase">{new Date(entry.scheduled_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' })}</div>
                      <div className="text-lg font-bold text-white">{new Date(entry.scheduled_date + 'T12:00:00').getDate()}</div>
                      <div className="text-[10px] text-zinc-600">Slot {entry.slot}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-white truncate">{entry.title}</h3>
                      <p className="text-[11px] text-zinc-500">{entry.genre} · ${parseFloat(entry.price_usd).toFixed(2)}</p>
                    </div>
                    <StatusBadge status={entry.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && <CreateBookModal onClose={() => setShowCreate(false)} onCreated={handleBookCreated} />}
      {showNiche && <NicheResearchModal onClose={() => setShowNiche(false)} />}
      {selectedBook && (
        <BookDetailPanel
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onRefresh={() => {
            loadAll().then(() => {
              setSelectedBook(prev => prev ? (books.find(b => b.id === prev.id) ?? null) : null);
            });
          }}
        />
      )}
    </div>
  );
}
