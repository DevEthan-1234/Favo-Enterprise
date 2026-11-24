import { useMemo, useState } from 'react';
import { ArrowUpDown, RefreshCw, Search, SearchX, WifiOff, X } from 'lucide-react';
import { useStore } from '../store/StoreContext.jsx';
import { cx } from '../lib/utils.js';
import ProductCard from './ProductCard.jsx';

const SORTS = [
  { key: 'newest', label: 'Newest' },
  { key: 'price-asc', label: 'Price: Low to High' },
  { key: 'price-desc', label: 'Price: High to Low' },
];

export default function Catalog({ onQuickView, onAdd, onImport }) {
  const { sections, products, ready, loadError, reload } = useStore();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('all');
  const [sort, setSort] = useState('newest');

  const activeSection = sections.some((s) => s.id === active) ? active : 'all';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    const list = products.filter((p) => {
      if (activeSection !== 'all' && p.sectionId !== activeSection) return false;
      if (!terms.length) return true;
      const hay = `${p.title} ${p.brand} ${p.specs} ${p.description} ${p.condition}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
    const sorted = [...list];
    if (sort === 'price-asc') sorted.sort((a, b) => a.price - b.price);
    else if (sort === 'price-desc') sorted.sort((a, b) => b.price - a.price);
    else sorted.sort((a, b) => b.createdAt - a.createdAt);
    return sorted;
  }, [products, query, activeSection, sort]);

  const grouped = activeSection === 'all' && !query.trim();
  const counts = useMemo(() => {
    const m = {};
    for (const p of products) m[p.sectionId] = (m[p.sectionId] || 0) + 1;
    return m;
  }, [products]);

  return (
    <section id="shop" className="mx-auto max-w-7xl px-4 scroll-mt-20">
      <div className="sticky top-16 z-30 -mx-4 px-4 py-3 bg-bg/85 backdrop-blur-xl border-b border-line">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search phones, laptops, brands, specs…"
              className="input pl-10 pr-9 rounded-2xl"
              aria-label="Search products"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-fg" aria-label="Clear search">
                <X className="size-4" />
              </button>
            )}
          </div>
          <div className="relative">
            <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="input rounded-2xl pl-9 pr-3 w-[52px] sm:w-auto appearance-none cursor-pointer text-transparent sm:text-fg" aria-label="Sort products">
              {SORTS.map((s) => <option key={s.key} value={s.key} className="text-fg bg-card">{s.label}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
          {[{ id: 'all', name: 'All Products' }, ...sections].map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={cx(
                'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition active:scale-95 border',
                activeSection === s.id ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-lg shadow-amber-500/20' : 'border-line text-muted hover:text-fg hover:border-amber-500/40'
              )}
            >
              {s.name}
              <span className="ml-1.5 opacity-60 text-xs">{s.id === 'all' ? products.length : counts[s.id] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {!ready ? (
        loadError ? (
          <div className="py-20 text-center">
            <WifiOff className="mx-auto size-12 text-muted" />
            <p className="mt-4 font-semibold">Couldn’t load the store</p>
            <p className="text-sm text-muted mt-1">{loadError}</p>
            <button onClick={reload} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400"><RefreshCw className="size-4" /> Try again</button>
          </div>
        ) : (
          <div className="pt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5" aria-busy="true" aria-label="Loading products">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="glass rounded-2xl sm:rounded-3xl overflow-hidden animate-pulse">
                <div className="aspect-square bg-bgsoft" />
                <div className="p-4 space-y-2"><div className="h-3 w-1/3 rounded bg-bgsoft" /><div className="h-4 w-4/5 rounded bg-bgsoft" /><div className="h-5 w-1/2 rounded bg-bgsoft" /></div>
              </div>
            ))}
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center">
          <SearchX className="mx-auto size-12 text-muted" />
          <p className="mt-4 font-semibold">No products match “{query || 'this section'}”</p>
          <p className="text-sm text-muted mt-1">We can still get it for you from abroad.</p>
          <button onClick={onImport} className="mt-5 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400">Request Custom Import</button>
        </div>
      ) : grouped ? (
        sections.map((s) => {
          const items = filtered.filter((p) => p.sectionId === s.id);
          if (!items.length) return null;
          return (
            <div key={s.id} className="pt-8">
              <div className="flex items-end justify-between mb-4">
                <h2 className="font-display text-xl sm:text-2xl font-bold">{s.name}</h2>
                <button onClick={() => setActive(s.id)} className="text-sm text-amber-500 hover:underline">View all</button>
              </div>
              <Grid items={items} onQuickView={onQuickView} onAdd={onAdd} />
            </div>
          );
        })
      ) : (
        <div className="pt-6">
          <p className="mb-4 text-sm text-muted">{filtered.length} product{filtered.length === 1 ? '' : 's'} found</p>
          <Grid items={filtered} onQuickView={onQuickView} onAdd={onAdd} />
        </div>
      )}
    </section>
  );
}

function Grid({ items, onQuickView, onAdd }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
      {items.map((p) => <ProductCard key={p.id} product={p} onQuickView={onQuickView} onAdd={onAdd} />)}
    </div>
  );
}
