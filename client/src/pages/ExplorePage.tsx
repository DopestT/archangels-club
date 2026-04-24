import React, { useState } from 'react';
import { Search, SlidersHorizontal, Lock } from 'lucide-react';
import { sampleCreators } from '../data/seed';
import CreatorCard from '../components/creators/CreatorCard';

const ALL_TAGS = ['All', 'Lifestyle', 'Art', 'Fashion', 'Photography', 'Editorial', 'Cinematic', 'Dark Aesthetic', 'Visual Art', 'Wellness', 'Beauty', 'Fine Art', 'Music', 'Audio'];

export default function ExplorePage() {
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState('All');
  const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'price-low' | 'price-high'>('popular');

  let filtered = sampleCreators.filter((c) => c.is_approved);

  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.display_name?.toLowerCase().includes(q) ||
        c.bio.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  if (activeTag !== 'All') {
    filtered = filtered.filter((c) => c.tags.includes(activeTag));
  }

  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortBy === 'price-low') return a.subscription_price - b.subscription_price;
    if (sortBy === 'price-high') return b.subscription_price - a.subscription_price;
    return (b.subscriber_count ?? 0) - (a.subscriber_count ?? 0);
  });

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

      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-arc-secondary">
            <span className="text-gold">{filtered.length}</span> creators
          </p>
        </div>

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((creator) => (
              <CreatorCard key={creator.id} creator={creator} />
            ))}
          </div>
        ) : (
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
