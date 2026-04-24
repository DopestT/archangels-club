import React, { useState } from 'react';
import { Search, ChevronUp, ChevronDown } from 'lucide-react';

interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  width?: string;
}

interface AdminTableProps<T extends { id: string }> {
  columns: Column<T>[];
  data: T[];
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  emptyMessage?: string;
  loading?: boolean;
}

export default function AdminTable<T extends { id: string }>({
  columns, data, searchable, searchPlaceholder = 'Search…', searchKeys, emptyMessage = 'No results', loading,
}: AdminTableProps<T>) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const filtered = searchable && query.trim()
    ? data.filter(row =>
        (searchKeys ?? (Object.keys(row) as (keyof T)[])).some(k => {
          const v = row[k];
          return typeof v === 'string' && v.toLowerCase().includes(query.toLowerCase());
        })
      )
    : data;

  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        const av = (a as any)[sortKey];
        const bv = (b as any)[sortKey];
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : filtered;

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  return (
    <div className="card-surface rounded-xl overflow-hidden">
      {searchable && (
        <div className="px-4 py-3 border-b border-white/8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-arc-muted" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-bg-hover border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-arc-muted outline-none focus:border-gold/40 transition-all max-w-xs"
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8">
              {columns.map(col => (
                <th
                  key={String(col.key)}
                  className={`px-4 py-3 text-left text-xs font-medium text-arc-muted tracking-wide ${col.sortable ? 'cursor-pointer hover:text-white select-none' : ''}`}
                  style={col.width ? { width: col.width } : {}}
                  onClick={() => col.sortable && toggleSort(String(col.key))}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortKey === String(col.key) && (
                      sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-gold" /> : <ChevronDown className="w-3 h-3 text-gold" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {columns.map((col, j) => (
                    <td key={j} className="px-4 py-3.5">
                      <div className="h-3 rounded bg-white/6 animate-pulse" style={{ width: `${50 + Math.random() * 40}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-arc-muted">{emptyMessage}</td>
              </tr>
            ) : (
              sorted.map(row => (
                <tr key={row.id} className="border-b border-white/5 hover:bg-bg-hover transition-colors">
                  {columns.map(col => (
                    <td key={String(col.key)} className="px-4 py-3.5 text-arc-secondary">
                      {col.render ? col.render(row) : String((row as any)[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {sorted.length > 0 && (
        <div className="px-4 py-3 border-t border-white/8 text-xs text-arc-muted">
          {sorted.length} result{sorted.length !== 1 ? 's' : ''}
          {query && ` matching "${query}"`}
        </div>
      )}
    </div>
  );
}
