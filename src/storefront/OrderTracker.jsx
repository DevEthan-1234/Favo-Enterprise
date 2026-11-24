import { useEffect, useState } from 'react';
import { Check, Clock, Download, Loader2, MessageCircle, PackageSearch, Search, XCircle } from 'lucide-react';
import { useStore } from '../store/StoreContext.jsx';
import { Button, Modal } from '../components/ui.jsx';
import { ORDER_STATUSES } from '../data/seed.js';
import { cx, downloadReceipt, fmtDate, kes, waLink } from '../lib/utils.js';

export default function OrderTracker({ open, onClose }) {
  const { myOrders, trackOrders } = useStore();
  const [query, setQuery] = useState('');
  const [mine, setMine] = useState([]);
  const [results, setResults] = useState(null); // null = not searched yet
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load this device's recent orders whenever the tracker opens.
  useEffect(() => {
    if (!open) return;
    setResults(null);
    setError('');
    if (!myOrders.length) { setMine([]); return; }
    let cancelled = false;
    trackOrders(myOrders).then((res) => { if (!cancelled && !res.error) setMine(res.data); });
    return () => { cancelled = true; };
  }, [open, myOrders, trackOrders]);

  const search = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    const res = await trackOrders([query]);
    setLoading(false);
    if (res.error) { setError(res.error); setResults([]); }
    else { setError(''); setResults(res.data); }
  };

  const list = results ?? mine;

  return (
    <Modal open={open} onClose={onClose} title="Track Your Order" size="md">
      <form onSubmit={search} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
          <input className="input pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Order no. (FAVO-12345) or M-Pesa code" />
        </div>
        <Button type="submit" disabled={loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : 'Track'}</Button>
      </form>

      <div className="mt-5 space-y-4">
        {error && <p className="text-sm text-red-500">{error}</p>}
        {results && results.length === 0 && !error && (
          <div className="text-center py-8">
            <PackageSearch className="mx-auto size-10 text-muted" />
            <p className="mt-3 font-semibold">No order found</p>
            <p className="text-sm text-muted">Check the order number or M-Pesa code on your receipt, or contact us.</p>
          </div>
        )}
        {!results && mine.length > 0 && <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your recent orders</p>}
        {!results && mine.length === 0 && (
          <p className="text-sm text-muted text-center py-6">Enter your order number or M-Pesa code to see live status.</p>
        )}
        {list.map((o) => <OrderStatusCard key={o.id} order={o} />)}
      </div>
    </Modal>
  );
}

function OrderStatusCard({ order: o }) {
  const idx = ORDER_STATUSES.findIndex((s) => s.key === o.status);
  return (
    <div className="rounded-2xl border border-line p-4 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono font-bold">{o.id}</p>
          <p className="text-xs text-muted">{fmtDate(o.createdAt)} · {o.location}</p>
        </div>
        <p className="font-display font-bold text-amber-500">{kes(o.total)}</p>
      </div>

      {o.paymentStatus === 'unverified' && (
        <div className="mt-4 flex gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          <Clock className="size-4 shrink-0" />
          <span>We're confirming your M-Pesa payment <b className="font-mono">{o.mpesaCode}</b>. This is usually quick during business hours.</span>
        </div>
      )}
      {o.paymentStatus === 'rejected' ? (
        <div className="mt-4 flex gap-2 rounded-xl bg-red-500/10 p-3 text-xs text-red-500">
          <XCircle className="size-4 shrink-0" />
          <span>We couldn't find a payment for M-Pesa code <b className="font-mono">{o.mpesaCode}</b>, so this order was cancelled. If you did pay, message us on WhatsApp with your M-Pesa SMS.</span>
        </div>
      ) : (
      <ol className="mt-5 grid grid-cols-4 relative">
        <div className="absolute top-3.5 left-[12.5%] right-[12.5%] h-0.5 bg-line" />
        <div className="absolute top-3.5 left-[12.5%] h-0.5 bg-emerald-500 transition-all duration-700" style={{ width: `${(Math.max(0, idx) / 3) * 75}%` }} />
        {ORDER_STATUSES.map((s, i) => (
          <li key={s.key} className="relative flex flex-col items-center text-center">
            <span className={cx('grid size-7 place-items-center rounded-full border-2 text-xs font-bold transition', i <= idx ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-card border-line text-muted', i === idx && 'animate-pulse-ring')}>
              {i < idx ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={cx('mt-1.5 text-[10px] sm:text-xs leading-tight', i <= idx ? 'text-fg font-semibold' : 'text-muted')}>{s.customer}</span>
          </li>
        ))}
      </ol>
      )}

      <div className="mt-4 text-sm space-y-1">
        {o.items.map((i) => (
          <div key={i.productId} className="flex justify-between gap-2"><span className="text-muted truncate">{i.qty} × {i.title}</span><span>{kes(i.price * i.qty)}</span></div>
        ))}
        <div className="flex justify-between gap-2 pt-1 border-t border-line">
          <span className="text-muted">Delivery fee</span>
          <span className={o.deliveryFee == null ? 'text-amber-500' : ''}>{o.deliveryFee == null ? 'Awaiting confirmation' : kes(o.deliveryFee)}</span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="ghost" className="text-xs" onClick={() => downloadReceipt(o)}><Download className="size-3.5" /> Receipt</Button>
        <a href={waLink(`Hi Favo Enterprise 👋 I'm following up on order ${o.id} (M-Pesa ${o.mpesaCode}).`)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 text-xs font-semibold text-emerald-500 hover:bg-emerald-500/10">
          <MessageCircle className="size-3.5" /> Ask on WhatsApp
        </a>
      </div>
    </div>
  );
}
