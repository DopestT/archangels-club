import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark } from 'lucide-react';
import ContentCard from '../components/content/ContentCard';
import { apiFetch } from '../lib/api';
import { useT } from '../context/LanguageContext';
import type { Content } from '../types';

export default function VaultPage() {
  const t = useT();
  const [items, setItems] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Vault — Archangels Club';
    apiFetch('/api/content/saved')
      .then((data: unknown) => {
        if (Array.isArray(data)) setItems(data as Content[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary">
      <section className="py-10 xl:py-14">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">

          <div className="mb-10">
            <span className="section-eyebrow mb-3 block">Private Collection</span>
            <div className="flex items-center gap-3 mb-2">
              <Bookmark className="w-7 h-7 text-gold" />
              <h1 className="font-serif text-4xl text-white">{t('member.vault')}</h1>
            </div>
            <p className="text-arc-secondary text-sm">
              {!loading && items.length > 0
                ? `${items.length} saved item${items.length !== 1 ? 's' : ''}`
                : 'Saved content appears here'}
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="card-surface h-72 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-full bg-gold-muted border border-gold-border flex items-center justify-center mb-4">
                <Bookmark className="w-7 h-7 text-gold" />
              </div>
              <h2 className="font-serif text-xl text-white mb-2">Nothing saved yet</h2>
              <p className="text-arc-secondary text-sm max-w-xs leading-relaxed">
                Tap the bookmark icon on any content card to save it here for later.
              </p>
              <Link to="/explore" className="btn-gold mt-6 text-sm px-6 py-2.5 inline-block">
                Browse Content
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {items.map(item => (
                <ContentCard key={item.id} content={item} />
              ))}
            </div>
          )}

        </div>
      </section>
    </div>
  );
}
