import { useEffect, useMemo, useState } from 'react';
import { Banknote, Minus, Plus, Search, Smartphone, Store, Trash2 } from 'lucide-react';
import { useStore } from '../store/StoreContext.jsx';
import { Button, Field, Modal, SafeImage } from '../components/ui.jsx';
import { cx, extractMpesaCode, kes } from '../lib/utils.js';

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const EMPTY = () => ({ lines: [], method: 'cash', code: '', name: '', phone: '', date: todayStr(), notes: '' });

/** Admin form for a sale made in person. Saves a paid, delivered order and takes the items out of stock. */
export default function RecordSale({ open, onClose, notify }) {
  const { products, recordSale } = useStore();
  const [form, setForm] = useState(EMPTY);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setForm(EMPTY()); setQuery(''); setError(''); }
  }, [open]);

  const set = (k) => (e) => { setError(''); setForm((f) => ({ ...f, [k]: e.target.value })); };
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => !q || `${p.title} ${p.brand}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [products, query]);

  const addProduct = (p) => {
    setError('');
    setForm((f) => {
      const existing = f.lines.find((l) => l.productId === p.id);
      if (existing) {
        return { ...f, lines: f.lines.map((l) => (l.productId === p.id ? { ...l, qty: Math.min(p.stock, l.qty + 1) } : l)) };
      }
      return { ...f, lines: [...f.lines, { productId: p.id, qty: 1, price: String(p.price) }] };
    });
    setQuery('');
  };
  const updateLine = (id, patch) => setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.productId === id ? { ...l, ...patch } : l)) }));
  const removeLine = (id) => setForm((f) => ({ ...f, lines: f.lines.filter((l) => l.productId !== id) }));

  const total = form.lines.reduce((s, l) => s + (Number(l.price) || 0) * l.qty, 0);
  const code = extractMpesaCode(form.code);

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.lines.length) return setError('Add at least one product that was sold.');
    for (const l of form.lines) {
      const p = byId.get(l.productId);
      if (!p) return setError('A product in this sale no longer exists. Remove it and try again.');
      if (l.qty > p.stock) return setError(`Only ${p.stock} unit(s) of ${p.title} in stock. Update the stock first if this is wrong.`);
      if (l.price === '' || Number(l.price) < 0) return setError(`Enter the selling price for ${p.title}.`);
    }
    if (form.method === 'mpesa' && !code) return setError('Enter the M-Pesa code from your SMS, or choose Cash.');

    // A past date is saved at midday; today uses the current time.
    const soldAt = form.date && form.date !== todayStr() ? new Date(`${form.date}T12:00:00`).toISOString() : null;
    setSaving(true);
    const res = await recordSale({
      items: form.lines.map((l) => ({ productId: l.productId, qty: l.qty, price: Math.round(Number(l.price)) })),
      paymentMethod: form.method,
      mpesaCode: form.method === 'mpesa' ? code : null,
      customerName: form.name,
      phone: form.phone,
      notes: form.notes,
      soldAt,
    });
    setSaving(false);
    if (res.error) return setError(res.error);
    notify(`Shop sale ${res.data} recorded: ${kes(total)}`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Record a shop sale" size="lg" hideClose={saving}>
      <form onSubmit={submit} noValidate className="grid gap-5">
        <p className="-mt-1 flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          <Store className="size-4 shrink-0" />
          For customers who buy from you in person. The sale is added to Financials and the items are taken out of stock.
        </p>

        {/* Product picker */}
        <div>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">What was sold</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input className="input pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your products…" aria-label="Search products" />
          </div>
          <div className="mt-2 grid max-h-56 gap-1 overflow-y-auto rounded-2xl border border-line p-1">
            {matches.length === 0 && <p className="p-3 text-center text-sm text-muted">No product matches “{query}”.</p>}
            {matches.map((p) => {
              const out = p.stock <= 0;
              return (
                <button
                  type="button"
                  key={p.id}
                  disabled={out}
                  onClick={() => addProduct(p)}
                  className="flex items-center gap-3 rounded-xl p-2 text-left transition hover:bg-bgsoft disabled:opacity-40"
                  aria-label={`Add ${p.title}`}
                >
                  <SafeImage src={p.image} alt="" className="size-10 shrink-0 rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.title}</span>
                    <span className="block text-xs text-muted">{kes(p.price)} · {out ? 'Out of stock' : `${p.stock} in stock`}</span>
                  </span>
                  <Plus className="size-4 shrink-0 text-amber-500" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Lines */}
        {form.lines.length > 0 && (
          <div className="grid gap-2">
            {form.lines.map((l) => {
              const p = byId.get(l.productId);
              if (!p) return null;
              return (
                <div key={l.productId} className="flex flex-wrap items-center gap-3 rounded-2xl bg-bgsoft p-3">
                  <SafeImage src={p.image} alt="" className="size-12 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.title}</p>
                    <p className="text-xs text-muted">{p.stock} in stock · listed at {kes(p.price)}</p>
                  </div>
                  <div className="flex items-center rounded-xl border border-line bg-card">
                    <button type="button" onClick={() => updateLine(l.productId, { qty: Math.max(1, l.qty - 1) })} className="p-2 hover:text-amber-500" aria-label={`Fewer ${p.title}`}><Minus className="size-4" /></button>
                    <span className="w-7 text-center text-sm font-semibold">{l.qty}</span>
                    <button type="button" onClick={() => updateLine(l.productId, { qty: Math.min(p.stock, l.qty + 1) })} disabled={l.qty >= p.stock} className="p-2 hover:text-amber-500 disabled:opacity-30" aria-label={`More ${p.title}`}><Plus className="size-4" /></button>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-muted">
                    KES
                    <input
                      className="input w-28 py-2"
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={l.price}
                      onChange={(e) => updateLine(l.productId, { price: e.target.value })}
                      aria-label={`Selling price for ${p.title}`}
                      title="Price per item. Change it if you gave a discount."
                    />
                  </label>
                  <button type="button" onClick={() => removeLine(l.productId)} className="rounded-lg p-2 text-muted hover:bg-red-500/10 hover:text-red-500" aria-label={`Remove ${p.title}`}><Trash2 className="size-4" /></button>
                </div>
              );
            })}
            <div className="flex justify-between px-1 pt-1 font-bold">
              <span>Total received</span><span className="text-amber-500">{kes(total)}</span>
            </div>
          </div>
        )}

        {/* Payment */}
        <div>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">How did they pay?</span>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment method">
            {[
              { key: 'cash', label: 'Cash', icon: Banknote },
              { key: 'mpesa', label: 'M-Pesa', icon: Smartphone },
            ].map(({ key, label, icon: Icon }) => (
              <button
                type="button"
                key={key}
                role="radio"
                aria-checked={form.method === key}
                onClick={() => setForm((f) => ({ ...f, method: key }))}
                className={cx('flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition', form.method === key ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'border-line text-muted hover:text-fg')}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
          {form.method === 'mpesa' && (
            <Field
              className="mt-3"
              label="M-Pesa code"
              hint={code && form.code.trim().toUpperCase() !== code ? `Found code: ${code}` : 'From the M-Pesa SMS on your phone. You can paste the whole SMS.'}
            >
              <input className="input font-mono uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal" value={form.code} onChange={set('code')} placeholder="e.g. TKL7H2J9QX" autoComplete="off" spellCheck={false} />
            </Field>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Customer name (optional)"><input className="input" value={form.name} onChange={set('name')} placeholder="Walk-in customer" /></Field>
          <Field label="Phone (optional)"><input className="input" value={form.phone} onChange={set('phone')} inputMode="tel" placeholder="07XX XXX XXX" /></Field>
          <Field label="Date of sale"><input className="input" type="date" value={form.date} max={todayStr()} onChange={set('date')} /></Field>
        </div>
        <Field label="Note (optional)"><input className="input" value={form.notes} onChange={set('notes')} placeholder="e.g. Gave KES 200 discount" /></Field>

        {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
        <div className="grid grid-cols-[auto_1fr] gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" className="py-3" disabled={saving || !form.lines.length}>
            <Store className="size-4" /> {saving ? 'Saving…' : `Record sale${total ? ` · ${kes(total)}` : ''}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
