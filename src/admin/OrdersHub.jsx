import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Copy, Loader2, MapPin, MessageCircle, Phone, Save, Search, Truck, XCircle } from 'lucide-react';
import { useStore } from '../store/StoreContext.jsx';
import { PageHeader } from '../components/ui.jsx';
import { BRAND, ORDER_STATUSES } from '../data/seed.js';
import { cx, fmtDate, kes, waLinkTo } from '../lib/utils.js';
import { PaymentBadge, StatusBadge } from './Financials.jsx';

export default function OrdersHub({ notify }) {
  const { orders } = useStore();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    const m = { all: orders.length, check: 0, cancelled: 0 };
    for (const s of ORDER_STATUSES) m[s.key] = 0;
    for (const o of orders) {
      m[o.status] = (m[o.status] || 0) + 1;
      if (o.paymentStatus === 'unverified') m.check += 1;
    }
    return m;
  }, [orders]);

  const list = orders.filter((o) => {
    if (filter === 'check' ? o.paymentStatus !== 'unverified' : filter !== 'all' && o.status !== filter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [o.id, o.mpesaCode, o.customerName, o.phone, o.location].some((v) => String(v).toLowerCase().includes(q));
  });

  return (
    <div className="animate-fade-in">
      <PageHeader title="Orders & Delivery" subtitle="Confirm M-Pesa payments, set delivery fees, update status and send quotes over WhatsApp." />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
          <input className="input pl-9" placeholder="Search by order, M-Pesa code, name, phone or area" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>
      <div className="mb-5 flex gap-2 overflow-x-auto no-scrollbar">
        {[{ key: 'all', admin: 'All' }, { key: 'check', admin: 'Check payment' }, ...ORDER_STATUSES, { key: 'cancelled', admin: 'Cancelled' }].map((s) => (
          <button key={s.key} onClick={() => setFilter(s.key)} className={cx('shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition', filter === s.key ? 'bg-amber-500 border-amber-500 text-slate-950' : 'border-line text-muted hover:text-fg')}>
            {s.admin} <span className="opacity-60">{counts[s.key]}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="glass rounded-3xl py-16 text-center text-muted">
          <Truck className="mx-auto size-10" />
          <p className="mt-3">No orders here yet.</p>
        </div>
      ) : (
        <div className="grid xl:grid-cols-2 gap-4">
          {list.map((o) => <OrderCard key={o.id} order={o} notify={notify} />)}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order: o, notify }) {
  const { updateOrder, reviewPayment } = useStore();
  const [reviewing, setReviewing] = useState(null);
  const cancelled = o.status === 'cancelled';
  const [fee, setFee] = useState(o.deliveryFee ?? '');
  useEffect(() => setFee(o.deliveryFee ?? ''), [o.deliveryFee]);
  const feeNum = fee === '' ? null : Math.max(0, Number(fee) || 0);
  const dirty = feeNum !== o.deliveryFee;

  const saveFee = async () => {
    if (feeNum == null) return;
    const res = await updateOrder(o.id, { deliveryFee: feeNum, status: o.status === 'pending' ? 'confirmed' : o.status });
    notify(res.error || `Delivery fee for ${o.id} set to ${kes(feeNum)}`);
  };

  const setStatus = async (status) => {
    const res = await updateOrder(o.id, { status });
    notify(res.error || `${o.id} → ${ORDER_STATUSES.find((s) => s.key === status).admin}`);
  };

  const review = async (received) => {
    const warning = `Mark ${o.mpesaCode} as NOT received? Order ${o.id} will be cancelled and its items put back in stock.`;
    if (!received && !window.confirm(warning)) return;
    setReviewing(received ? 'yes' : 'no');
    const res = await reviewPayment(o.id, received);
    setReviewing(null);
    notify(res.error || (received ? `Payment ${o.mpesaCode} confirmed ✓` : `${o.id} cancelled and restocked`));
  };

  const quote = [
    `Hello ${o.customerName.split(' ')[0]} 👋, thank you for shopping with *${BRAND.name}*!`,
    '',
    `🧾 *Order:* ${o.id}`,
    `💳 *M-Pesa Ref:* ${o.mpesaCode}`,
    ...o.items.map((i) => `• ${i.qty} × ${i.title} — ${kes(i.price * i.qty)}`),
    '',
    `✅ *Items ${o.paymentStatus === 'verified' ? 'paid' : 'total'}:* ${kes(o.total)}`,
    `🚚 *Delivery to ${o.location}:* ${feeNum != null ? kes(feeNum) : 'TBC'}`,
    feeNum != null ? `💰 *Delivery fee payable:* ${kes(feeNum)}` : '',
    '',
    'Kindly confirm so we can dispatch your order. 📦',
  ].filter((l, idx, arr) => l !== '' || arr[idx - 1] !== '').join('\n');

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(o.mpesaCode);
      notify('M-Pesa code copied');
    } catch {
      notify(o.mpesaCode);
    }
  };

  return (
    <div className="glass rounded-3xl p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-mono font-bold">{o.id}</p>
            <StatusBadge status={o.status} />
            <PaymentBadge status={o.paymentStatus} />
          </div>
          <p className="text-xs text-muted mt-1">{fmtDate(o.createdAt)}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-bold text-amber-500">{kes(o.total)}</p>
          <button onClick={copyCode} className="inline-flex items-center gap-1 font-mono text-xs text-emerald-500 hover:underline"><Copy className="size-3" />{o.mpesaCode}</button>
        </div>
      </div>

      {o.paymentStatus === 'unverified' && (
        <div className="mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <p className="text-sm font-semibold">Check your M-Pesa messages on {BRAND.mpesaDisplay}</p>
          <p className="mt-1 text-xs text-muted">
            Look for code <b className="font-mono text-fg">{o.mpesaCode}</b>: <b className="text-fg">{kes(o.total)}</b> received from {o.phone} ({o.customerName}).
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => review(true)} disabled={!!reviewing} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50">
              {reviewing === 'yes' ? <Loader2 className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />} Payment received
            </button>
            <button onClick={() => review(false)} disabled={!!reviewing} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-500/40 px-3 py-2.5 text-sm font-semibold text-red-500 transition hover:bg-red-500/10 disabled:opacity-50">
              {reviewing === 'no' ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />} Not received
            </button>
          </div>
        </div>
      )}
      {cancelled && (
        <p className="mt-4 rounded-2xl bg-red-500/10 p-3 text-xs text-red-500">Cancelled: payment {o.mpesaCode} was not received. Items were returned to stock.</p>
      )}

      <div className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-bgsoft p-3">
          <p className="font-semibold">{o.customerName}</p>
          <a href={`tel:${o.phone}`} className="mt-1 flex items-center gap-1.5 text-muted hover:text-amber-500"><Phone className="size-3.5" />{o.phone}</a>
        </div>
        <div className="rounded-2xl bg-bgsoft p-3">
          <p className="flex items-center gap-1.5 font-semibold"><MapPin className="size-3.5 text-amber-500" />{o.location}</p>
          {o.notes ? <p className="mt-1 text-xs text-muted line-clamp-2">{o.notes}</p> : <p className="mt-1 text-xs text-muted">No directions provided</p>}
        </div>
      </div>

      <ul className="mt-3 text-sm space-y-1">
        {o.items.map((i) => (
          <li key={i.productId} className="flex justify-between gap-2"><span className="text-muted truncate">{i.qty} × {i.title}</span><span className="whitespace-nowrap">{kes(i.price * i.qty)}</span></li>
        ))}
      </ul>

      {!cancelled && (<>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">Delivery fee (KES)</span>
          <div className="flex gap-1.5">
            <input className="input" type="number" min="0" inputMode="numeric" placeholder="e.g. 350" value={fee} onChange={(e) => setFee(e.target.value)} />
            <button onClick={saveFee} disabled={!dirty || feeNum == null} className="grid shrink-0 w-11 place-items-center rounded-xl bg-amber-500 text-slate-950 disabled:opacity-30 hover:bg-amber-400" aria-label="Save delivery fee"><Save className="size-4" /></button>
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">Status</span>
          <select className="input" value={o.status} onChange={(e) => setStatus(e.target.value)}>
            {ORDER_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.admin}</option>)}
          </select>
        </label>
      </div>

      <a
        href={waLinkTo(o.phone, quote)}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 active:scale-[0.97]"
      >
        <MessageCircle className="size-4" /> Send Delivery Quote via WhatsApp
      </a>
      </>)}
    </div>
  );
}
