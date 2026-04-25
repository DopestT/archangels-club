import React, { useState, useEffect, useCallback } from 'react';
import { Search, SlidersHorizontal, Lock, TrendingUp, Sparkles } from 'lucide-react';
import CreatorCard from '../components/creators/CreatorCard';
import ContentCard from '../components/content/ContentCard';
import type { CreatorProfile, Content } from '../types';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || 'https://archangels-club-production.up.railway.app';

const ALL_TAGS = ['All', 'Lifestyle', 'Art', 'Fashion', 'Photography', 'Editorial', 'Cinematic', 'Dark Aesthetic', 'Visual Art', 'Wellness', 'Beauty', 'Fine Art', 'Music', 'Audio'];

export default function ExplorePage() {
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState('All');
  const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'price-low' | 'price-high'>('popular');

  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [trendingContent, setTrendingContent] = useState<Content[]>([]);
  const [newCreators, setNewCreators] = useState<CreatorProfile[]>([]);

  // Fetch trending content + newest creators once on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/content?sort=trending&limit=8`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setTrendingContent(data); })
      .catch(() => {});

    fetch(`${API_BASE}/api/creators?sort=newest&limit=6`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setNewCreators(data); })
      .catch(() => {});
  }, []);

  const fetchCreators = useCallback(() => {
    setLoading(true);
    setError('');

    const params = new URLSearchParams({ sort: sortBy });
    if (query) params.set('q', query);
    if (activeTag !== 'All') params.set('tag', activeTag);

    fetch(`${API_BASE}/api/creators?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) { setError(data.error || 'Failed to load creators.'); return; }
        setCreators(data);
      })
      .catch(() => setError('Unable to reach the server.'))
      .finally(() => setLoading(false));
  }, [query, activeTag, sortBy]);

  useEffect(() => {
    const t = setTimeout(fetchCreators, query ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchCreators, query]);

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Page hero */}
      <section className="py-20 bg-bg-surface border-b border-gold-border/40 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[200px] bg-gold/4 blur-3xl rounded-full" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 members-pill mb-5">
            <Lock className="w-3 h-3" />
            Private Creators
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl text-white mb-4">Explore Creators</h1>
          <p className="text-arc-secondary max-w-xl mx-auto">
            All creators are verified. All content is gated. Subscribe to unlock private access.
          </p>
        </div>
      </section>

      {/* Trending Content */}
      {trendingContent.length > 0 && (
        <section className="py-12 border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-7">
              <div className="w-8 h-8 rounded-full bg-gold-muted border border-gold-border flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-gold" />
              </div>
              <div>
                <h2 className="font-serif text-xl text-white">Trending Now</h2>
                <p className="text-xs text-arc-muted">Most unlocked content this week</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {trendingContent.map((item) => (
                <ContentCard key={item.id} content={item} showCreator />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* New Creators */}
      {newCreators.length > 0 && (
        <section className="py-12 border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-7">
              <div className="w-8 h-8 rounded-full bg-gold-muted border border-gold-border flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-gold" />
              </div>
              <div>
                <h2 className="font-serif text-xl text-white">New Creators</h2>
                <p className="text-xs text-arc-muted">Recently joined the network</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {newCreators.map((creator) => (
                <CreatorCard key={creator.id} creator={creator} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* All Creators */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="font-serif text-2xl text-white mb-8">All Creators</h2>

        {/* Search + sort */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-arc-muted" />
            <input
              type="text"
              placeholder="Search creators by name, bio, or tag…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input-dark pl-11"
            />
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-arc-muted flex-shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="input-dark w-auto"
            >
              <option value="popular">Most Popular</option>
              <option value="newest">Newest</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Tag filters */}
        <div className="flex flex-wrap gap-2 mb-10">
          {ALL_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`px-4 py-1.5 rounded-full text-xs font-sans font-medium transition-all duration-200 ${
                activeTag === tag
                  ? 'bg-gold text-bg-primary shadow-gold-sm'
                  : 'tag-pill hover:border-gold/40 hover:text-arc-text'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Results count */}
        {!loading && !error && (
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-arc-secondary">
              <span className="text-gold">{creators.length}</span> creator{creators.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="text-center py-24">
            <p className="text-arc-error text-sm mb-4">{error}</p>
            <button onClick={fetchCreators} className="btn-outline text-sm">Retry</button>
          </div>
        )}

        {/* Grid */}
        {!loading && !error && creators.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {creators.map((creator) => (
              <CreatorCard key={creator.id} creator={creator} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && creators.length === 0 && (
          <div className="text-center py-24">
            <Search className="w-10 h-10 text-arc-muted mx-auto mb-4" />
            <h3 className="font-serif text-xl text-white mb-2">No creators found</h3>
            <p className="text-arc-secondary text-sm">Try a different search or tag filter.</p>
          </div>
        )}
      </section>
    </div>
  );
}
