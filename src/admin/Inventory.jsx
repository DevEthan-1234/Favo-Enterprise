import { useMemo, useState } from 'react';
import { AlertTriangle, Minus, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useStore } from '../store/StoreContext.jsx';
import { Button, ConditionBadge, PageHeader, SafeImage, StockBadge } from '../components/ui.jsx';
import { cx, kes } from '../lib/utils.js';
import ProductForm from './ProductForm.jsx';

export default function Inventory({ notify }) {
  const { products, sections, adjustStock, deleteProduct } = useStore();
  const [editing, setEditing] = useState(null); // null | 'new' | product
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('all');
  const [onlyLow, setOnlyLow] = useState(false);

  const low = products.filter((p) => p.stock <= 3);
  const out = low.filter((p) => p.stock === 0);

  const stockValue = useMemo(() => products.reduce((s, p) => s + p.costPrice * p.stock, 0), [products]);

  const list = products.filter((p) => {
    if (section !== 'all' && p.sectionId !== section) return false;
    if (onlyLow && p.stock > 3) return false;
    const q = query.trim().toLowerCase();
    return !q || `${p.title} ${p.brand}`.toLowerCase().includes(q);
  });

  const adjust = async (id, delta) => {
    const res = await adjustStock(id, delta);
    if (res.error) notify(res.error);
  };

  const remove = (p) => {
    if (window.confirm(`Delete “${p.title}”? It will be removed from the storefront immediately.`)) {
      deleteProduct(p.id).then((res) => notify(res.error || 'Product deleted'));
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Products & Inventory"
        subtitle={`${products.length} products · stock value at cost ${kes(stockValue)}`}
        action={<Button onClick={() => setEditing('new')}><Plus className="size-4" /> Add Product</Button>}
      />

      {low.length > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-red-500/10 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <AlertTriangle className="size-6 text-amber-500 shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">Low Stock Alert</p>
            <p className="text-muted">{low.length} item{low.length > 1 ? 's are' : ' is'} at 3 units or fewer{out.length ? `, ${out.length} out of stock` : ''}: {low.map((p) => p.title).join(', ')}.</p>
          </div>
          <Button variant="ghost" className="shrink-0" onClick={() => setOnlyLow((v) => !v)}>{onlyLow ? 'Show all' : 'Show low stock only'}</Button>
        </div>
      )}

      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
          <input className="input pl-9" placeholder="Search products…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="input sm:w-60" value={section} onChange={(e) => setSection(e.target.value)}>
          <option value="all">All sections</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="glass rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-line bg-bgsoft/50">
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-3 py-3 font-semibold">Section</th>
                <th className="px-3 py-3 font-semibold text-right">Price</th>
                <th className="px-3 py-3 font-semibold text-right">Cost</th>
                <th className="px-3 py-3 font-semibold text-center">Stock</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const isLow = p.stock <= 3;
                return (
                  <tr key={p.id} className={cx('border-b border-line last:border-0 transition', p.stock === 0 ? 'bg-red-500/[0.07]' : isLow ? 'bg-amber-500/[0.07]' : 'hover:bg-bgsoft/40')}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <SafeImage src={p.image} alt="" className="size-12 rounded-xl shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold truncate max-w-[220px]">{p.title}</p>
                          <div className="mt-1"><ConditionBadge condition={p.condition} /></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted">{sections.find((s) => s.id === p.sectionId)?.name || '—'}</td>
                    <td className="px-3 py-3 text-right font-semibold whitespace-nowrap">{kes(p.price)}</td>
                    <td className="px-3 py-3 text-right text-muted whitespace-nowrap">{kes(p.costPrice)}<span className="block text-[11px] text-emerald-500">+{kes(p.price - p.costPrice)}</span></td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex items-center rounded-xl border border-line bg-bgsoft">
                          <button onClick={() => adjust(p.id, -1)} disabled={p.stock === 0} className="p-2 hover:text-red-500 disabled:opacity-30" aria-label={`Decrease stock of ${p.title}`}><Minus className="size-3.5" /></button>
                          <span className={cx('w-9 text-center font-bold tabular-nums', p.stock === 0 ? 'text-red-500' : isLow ? 'text-amber-500' : '')}>{p.stock}</span>
                          <button onClick={() => adjust(p.id, 1)} className="p-2 hover:text-emerald-500" aria-label={`Increase stock of ${p.title}`}><Plus className="size-3.5" /></button>
                        </div>
                        <StockBadge stock={p.stock} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setEditing(p)} className="p-2 rounded-lg text-muted hover:text-amber-500 hover:bg-amber-500/10" aria-label={`Edit ${p.title}`}><Pencil className="size-4" /></button>
                        <button onClick={() => remove(p)} className="p-2 rounded-lg text-muted hover:text-red-500 hover:bg-red-500/10" aria-label={`Delete ${p.title}`}><Trash2 className="size-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted">No products match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProductForm
        open={editing !== null}
        product={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={(isNew) => { setEditing(null); notify(isNew ? 'Product added to storefront' : 'Product updated'); }}
      />
    </div>
  );
}
