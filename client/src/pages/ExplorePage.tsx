import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, SlidersHorizontal, Lock, TrendingUp, Sparkles, Crown, ChevronRight, ChevronLeft } from 'lucide-react';
import CreatorCard from '../components/creators/CreatorCard';
import FeedCard from '../components/content/FeedCard';
import LiveActivity from '../components/explore/LiveActivity';
import type { CreatorProfile, Content } from '../types';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const FEED_PAGE_SIZE = 12;

const ALL_TAGS = ['All', 'Lifestyle', 'Art', 'Fashion', 'Photography', 'Editorial', 'Cinematic', 'Dark Aesthetic', 'Visual Art', 'Wellness', 'Beauty', 'Fine Art', 'Music', 'Audio'];

// Section header used in multiple places
function SectionHeader({ icon, title, sub, count }: { icon: React.ReactNode; title: string; sub: string; count?: number }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gold-muted border border-gold-border flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div>
          <h2 className="font-serif text-xl text-white">{title}</h2>
          <p className="text-xs text-arc-muted">{sub}</p>
        </div>
      </div>
      {count != null && (
        <span className="text-xs text-arc-muted border border-gold-border/40 px-3 py-1 rounded-full flex-shrink-0">
          {count} drop{count !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

// Horizontal scroll strip of FeedCards
function FeedStrip({ items }: { items: Content[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) =>
    ref.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });

  return (
    <div className="relative group/strip">
      {/* Left arrow — desktop only, visible on hover */}
      <button
        onClick={() => scroll(-1)}
        aria-label="Scroll left"
        className="hidden lg:flex absolute left-1 top-1/2 -translate-y-1/2 z-10
                   w-9 h-9 items-center justify-center rounded-full
                   bg-bg-surface/90 backdrop-blur-sm border border-white/10 text-white shadow-lg
                   opacity-0 group-hover/strip:opacity-100 transition-opacity duration-200"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Scroll container */}
      <div
        ref={ref}
        className="flex gap-4 overflow-x-auto overflow-y-hidden snap-x snap-mandatory no-scrollbar pb-2"
        style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        {items.map((item) => (
          <div key={item.id} className="flex-none w-[260px] snap-start">
            <FeedCard content={item} />
          </div>
        ))}
      </div>

      {/* Right arrow — desktop only, visible on hover */}
      <button
        onClick={() => scroll(1)}
        aria-label="Scroll right"
        className="hidden lg:flex absolute right-1 top-1/2 -translate-y-1/2 z-10
                   w-9 h-9 items-center justify-center rounded-full
                   bg-bg-surface/90 backdrop-blur-sm border border-white/10 text-white shadow-lg
                   opacity-0 group-hover/strip:opacity-100 transition-opacity duration-200"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function ExplorePage() {
  // ── Trending + New & Rising strips ────────────────────────────────────────
  const [trendingContent, setTrendingContent] = useState<Content[]>([]);
  const [risingContent, setRisingContent] = useState<Content[]>([]);

  // ── Infinite-scroll feed ──────────────────────────────────────────────────
  const [feedItems, setFeedItems] = useState<Content[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedHasMore, setFeedHasMore] = useState(true);
  const feedOffsetRef = useRef(0);
  const feedHasMoreRef = useRef(true);
  const feedLoadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // ── You might like ────────────────────────────────────────────────────────
  const [suggestedContent, setSuggestedContent] = useState<Content[]>([]);
  const [suggestedCreatorName, setSuggestedCreatorName] = useState('');

  // ── Creator directory ─────────────────────────────────────────────────────
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [creatorLoading, setCreatorLoading] = useState(true);
  const [creatorError, setCreatorError] = useState('');
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState('All');
  const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'price-low' | 'price-high'>('popular');
  const [showCreators, setShowCreators] = useState(false);

  // ── Load trending + rising on mount ───────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/api/content?sort=trending&limit=12`)
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        setTrendingContent(data);
        // "You might like" = more from the top trending creator
        const top = data[0];
        if (top?.creator_id && top?.creator_name) {
          setSuggestedCreatorName(top.creator_name);
          fetch(`${API_BASE}/api/content?creator_id=${top.creator_id}&limit=8`)
            .then((r) => r.json())
            .then((d) => { if (Array.isArray(d)) setSuggestedContent(d); })
            .catch(() => {});
        }
      })
      .catch(() => {});

    fetch(`${API_BASE}/api/content?sort=rising&limit=12`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setRisingContent(data); })
      .catch(() => {});
  }, []);

  // ── Infinite-scroll feed loader ───────────────────────────────────────────
  const loadFeed = useCallback(async () => {
    if (feedLoadingRef.current || !feedHasMoreRef.current) return;
    feedLoadingRef.current = true;
    setFeedLoading(true);
    const offset = feedOffsetRef.current;
    try {
      const res = await fetch(`${API_BASE}/api/content?sort=newest&limit=${FEED_PAGE_SIZE}&offset=${offset}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setFeedItems((prev) => {
          const ids = new Set(prev.map((c) => c.id));
          return [...prev, ...data.filter((c) => !ids.has(c.id))];
        });
        const newOffset = offset + data.length;
        feedOffsetRef.current = newOffset;
        const hasMore = data.length === FEED_PAGE_SIZE;
        feedHasMoreRef.current = hasMore;
        setFeedHasMore(hasMore);
      }
    } catch (err) {
      console.error('[feed] load error:', err);
    } finally {
      feedLoadingRef.current = false;
      setFeedLoading(false);
    }
  }, []);

  // Initial feed load
  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  // IntersectionObserver sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadFeed();
      },
      { rootMargin: '400px' }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [loadFeed]);

  // ── Creator directory fetch ───────────────────────────────────────────────
  const fetchCreators = useCallback(() => {
    if (!showCreators) return;
    setCreatorLoading(true);
    setCreatorError('');
    const params = new URLSearchParams({ sort: sortBy });
    if (query) params.set('q', query);
    if (activeTag !== 'All') params.set('tag', activeTag);
    fetch(`${API_BASE}/api/creators?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) { setCreatorError(data.error || 'Failed to load.'); return; }
        setCreators(data);
      })
      .catch(() => setCreatorError('Unable to reach the server.'))
      .finally(() => setCreatorLoading(false));
  }, [query, activeTag, sortBy, showCreators]);

  useEffect(() => {
    const t = setTimeout(fetchCreators, query ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchCreators, query]);

  const lockedDrops = trendingContent.filter((c) => c.access_type === 'locked');

  return (
    <div className="min-h-screen bg-bg-primary">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="py-16 bg-bg-surface border-b border-gold-border/40 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[280px] bg-gold/4 blur-3xl rounded-full" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 members-pill mb-4">
            <Lock className="w-3 h-3" />
            Private · Verified · Exclusive
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl text-white mb-3">Explore</h1>
          <p className="text-arc-secondary max-w-md mx-auto mb-7 text-sm">
            Every creator is hand-selected. Every drop is gated. Unlock and own exclusive content instantly.
          </p>
          <div className="flex items-center justify-center gap-8 text-xs text-arc-muted">
            {[
              `${trendingContent.length + risingContent.length > 0 ? (trendingContent.length + risingContent.length) + '+' : '…'} drops`,
              'Age-verified creators',
              'Instant access',
            ].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-gold" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trending Now strip ────────────────────────────────────────────── */}
      {trendingContent.length > 0 && (
        <section className="py-10 border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHeader
              icon={<TrendingUp className="w-4 h-4 text-gold" />}
              title="Trending Now"
              sub="Most unlocked content this week"
            />
            <FeedStrip items={trendingContent} />
          </div>
        </section>
      )}

      {/* ── Locked Drops strip ───────────────────────────────────────────── */}
      {lockedDrops.length > 0 && (
        <section className="py-10 border-b border-white/5 bg-bg-surface/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHeader
              icon={<Lock className="w-4 h-4 text-gold" />}
              title="Locked Drops"
              sub="Exclusive paid content — unlock instantly"
              count={lockedDrops.length}
            />
            <FeedStrip items={lockedDrops} />
          </div>
        </section>
      )}

      {/* ── New & Rising strip ───────────────────────────────────────────── */}
      {risingContent.length > 0 && (
        <section className="py-10 border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHeader
              icon={<Sparkles className="w-4 h-4 text-gold" />}
              title="New & Rising"
              sub="Fresh drops from the last 24 hours"
            />
            <FeedStrip items={risingContent} />
          </div>
        </section>
      )}

      {/* ── Infinite-scroll feed ─────────────────────────────────────────── */}
      <section className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-7">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gold-muted border border-gold-border flex items-center justify-center">
              <svg className="w-4 h-4 text-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <div>
              <h2 className="font-serif text-xl text-white">All Drops</h2>
              <p className="text-xs text-arc-muted">Scroll to discover · New content added daily</p>
            </div>
          </div>
          {feedItems.length > 0 && (
            <span className="text-xs text-arc-muted">{feedItems.length} loaded</span>
          )}
        </div>

        {feedItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {feedItems.map((item) => (
              <FeedCard key={item.id} content={item} />
            ))}
          </div>
        ) : !feedLoading ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-full bg-gold-muted border border-gold-border flex items-center justify-center mx-auto mb-5">
              <Crown className="w-6 h-6 text-gold" />
            </div>
            <h3 className="font-serif text-xl text-white mb-2">No drops yet</h3>
            <p className="text-arc-secondary text-sm mb-6 max-w-xs mx-auto">
              Creators publish exclusively here. Applications reviewed weekly — be first when they launch.
            </p>
            <Link to="/apply-creator" className="btn-gold text-sm">Apply to Create</Link>
          </div>
        ) : null}

        {/* Infinite scroll sentinel + loading indicator */}
        <div ref={sentinelRef} className="h-4" />
        {feedLoading && (
          <div className="flex justify-center py-10">
            <div className="w-7 h-7 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
          </div>
        )}
        {!feedHasMore && feedItems.length > 0 && (
          <p className="text-center text-xs text-arc-muted py-8">
            You've seen all {feedItems.length} drops · Check back tomorrow for new content
          </p>
        )}
      </section>

      {/* ── You might like ───────────────────────────────────────────────── */}
      {suggestedContent.length > 0 && (
        <section className="py-10 border-t border-white/5 bg-bg-surface/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHeader
              icon={<Crown className="w-4 h-4 text-gold" />}
              title="You Might Like"
              sub={`More from ${suggestedCreatorName || 'top creators'}`}
            />
            <FeedStrip items={suggestedContent} />
          </div>
        </section>
      )}

      {/* ── Creator directory (collapsible) ──────────────────────────────── */}
      <section className="py-10 border-t border-white/5 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => { setShowCreators((v) => !v); }}
          className="flex items-center gap-3 w-full text-left group"
        >
          <div className="w-9 h-9 rounded-full bg-gold-muted border border-gold-border flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-gold" />
          </div>
          <div className="flex-1">
            <h2 className="font-serif text-xl text-white">Browse Creators</h2>
            <p className="text-xs text-arc-muted">All verified creators on the network</p>
          </div>
          <ChevronRight className={`w-5 h-5 text-arc-muted transition-transform duration-200 ${showCreators ? 'rotate-90' : ''}`} />
        </button>

        {showCreators && (
          <div className="mt-8">
            {/* Search + sort */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-arc-muted" />
                <input
                  type="text"
                  placeholder="Search by name, bio, or tag…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="input-dark pl-11"
                />
              </div>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-arc-muted flex-shrink-0" />
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="input-dark w-auto">
                  <option value="popular">Most Popular</option>
                  <option value="newest">Newest</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                </select>
              </div>
            </div>

            {/* Tag filters */}
            <div className="flex flex-wrap gap-2 mb-8">
              {ALL_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(tag)}
                  className={`px-4 py-1.5 rounded-full text-xs font-sans font-medium transition-all duration-200 ${
                    activeTag === tag ? 'bg-gold text-bg-primary shadow-gold-sm' : 'tag-pill hover:border-gold/40 hover:text-arc-text'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            {creatorLoading && <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-gold/30 border-t-gold rounded-full animate-spin" /></div>}
            {!creatorLoading && creatorError && <p className="text-arc-error text-sm text-center py-10">{creatorError}</p>}

            {!creatorLoading && !creatorError && creators.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {creators.map((creator) => <CreatorCard key={creator.id} creator={creator} />)}
              </div>
            )}

            {!creatorLoading && !creatorError && creators.length === 0 && (
              <div className="text-center py-16 max-w-sm mx-auto">
                {query || activeTag !== 'All' ? (
                  <>
                    <h3 className="font-serif text-lg text-white mb-2">No creators match</h3>
                    <p className="text-arc-secondary text-sm mb-4">New creators are admitted weekly.</p>
                    <button onClick={() => { setQuery(''); setActiveTag('All'); }} className="btn-outline text-sm">Clear filters</button>
                  </>
                ) : (
                  <>
                    <h3 className="font-serif text-lg text-white mb-2">Creators coming soon</h3>
                    <p className="text-arc-secondary text-sm">Applications reviewed weekly.</p>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <LiveActivity content={[...trendingContent, ...risingContent, ...feedItems]} />
    </div>
  );
}
