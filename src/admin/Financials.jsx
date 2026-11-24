import { useMemo, useState } from 'react';
import { AlertTriangle, Banknote, BadgeCheck, CalendarDays, Download, Package, Receipt, ShoppingCart, TrendingDown, TrendingUp } from 'lucide-react';
import { useStore } from '../store/StoreContext.jsx';
import { Badge, PageHeader, SafeImage } from '../components/ui.jsx';
import { ORDER_STATUSES, PAYMENT_STATUSES } from '../data/seed.js';
import { cx, fmtDate, kes } from '../lib/utils.js';

const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n)));

/** "2026-11" for a timestamp, in the shop's local time. */
const monthKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const keyToDate = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1);
};
const monthLabel = (key, opts = { month: 'long', year: 'numeric' }) => keyToDate(key).toLocaleDateString('en-KE', opts);
const prevKey = (key) => {
  const d = keyToDate(key);
  d.setMonth(d.getMonth() - 1);
  return monthKey(d.getTime());
};

function summarize(list) {
  const revenue = list.reduce((s, o) => s + o.total, 0);
  const profit = list.reduce((s, o) => s + o.items.reduce((a, i) => a + (i.price - (i.costPrice || 0)) * i.qty, 0), 0);
  const deliveryFees = list.reduce((s, o) => s + (o.deliveryFee || 0), 0);
  const units = list.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0);
  return { revenue, profit, deliveryFees, units, count: list.length, aov: list.length ? revenue / list.length : 0, margin: revenue ? (profit / revenue) * 100 : 0 };
}

export default function Financials({ onGoto }) {
  const { orders: allOrders, sections, products } = useStore();
  const thisMonth = monthKey(Date.now());
  const [period, setPeriod] = useState(thisMonth); // 'all' or 'YYYY-MM'

  // Only payments the admin has confirmed count as sales.
  const paid = useMemo(() => allOrders.filter((o) => o.paymentStatus === 'verified'), [allOrders]);
  const toCheck = allOrders.filter((o) => o.paymentStatus === 'unverified');

  // Months to choose from: this month back to the month of the oldest order.
  const months = useMemo(() => {
    const oldest = allOrders.reduce((min, o) => Math.min(min, o.createdAt), Date.now());
    const list = [];
    for (let k = thisMonth; ; k = prevKey(k)) {
      list.push(k);
      if (k <= monthKey(oldest) || list.length >= 120) break;
    }
    return list;
  }, [allOrders, thisMonth]);

  const inPeriod = (o) => period === 'all' || monthKey(o.createdAt) === period;
  const orders = useMemo(() => paid.filter(inPeriod), [paid, period]); // eslint-disable-line react-hooks/exhaustive-deps
  const ledger = useMemo(() => allOrders.filter(inPeriod), [allOrders, period]); // eslint-disable-line react-hooks/exhaustive-deps
  const stats = useMemo(() => summarize(orders), [orders]);
  const prev = useMemo(
    () => (period === 'all' ? null : summarize(paid.filter((o) => monthKey(o.createdAt) === prevKey(period)))),
    [paid, period]
  );

  // Bars: one per day for a month, one per month for "All time".
  const bars = useMemo(() => {
    if (period === 'all') {
      const list = [...months].reverse().map((k) => ({ key: k, label: monthLabel(k, { month: 'short' }), full: monthLabel(k), value: 0 }));
      for (const o of orders) {
        const slot = list.find((b) => b.key === monthKey(o.createdAt));
        if (slot) slot.value += o.total;
      }
      return list;
    }
    const start = keyToDate(period);
    const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const list = Array.from({ length: days }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), i + 1);
      return { key: i + 1, label: String(i + 1), full: d.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' }), value: 0 };
    });
    for (const o of orders) list[new Date(o.createdAt).getDate() - 1].value += o.total;
    return list;
  }, [orders, period, months]);

  const byCategory = useMemo(() => {
    const m = new Map();
    for (const o of orders) for (const i of o.items) m.set(i.sectionId, (m.get(i.sectionId) || 0) + i.price * i.qty);
    return [...m.entries()]
      .map(([id, value]) => ({ id, name: sections.find((s) => s.id === id)?.name || 'Archived section', value }))
      .sort((a, b) => b.value - a.value);
  }, [orders, sections]);

  // What sold: one row per product.
  const sold = useMemo(() => {
    const m = new Map();
    for (const o of orders) {
      for (const i of o.items) {
        const row = m.get(i.productId) || { id: i.productId, title: i.title, image: i.image, qty: 0, revenue: 0, profit: 0 };
        row.qty += i.qty;
        row.revenue += i.price * i.qty;
        row.profit += (i.price - (i.costPrice || 0)) * i.qty;
        m.set(i.productId, row);
      }
    }
    return [...m.values()].sort((a, b) => b.revenue - a.revenue);
  }, [orders]);

  const maxBar = Math.max(1, ...bars.map((d) => d.value));
  const maxCat = Math.max(1, ...byCategory.map((c) => c.value));
  const bestBar = bars.reduce((best, b) => (b.value > (best?.value || 0) ? b : best), null);
  const todayIdx = period === thisMonth ? new Date().getDate() - 1 : -1;
  const lowStock = products.filter((p) => p.stock <= 3);
  const pendingFee = paid.filter((o) => o.deliveryFee == null && o.status !== 'cancelled').length;
  const periodName = period === 'all' ? 'all time' : monthLabel(period);

  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Date', 'Order', 'M-Pesa code', 'Payment', 'Customer', 'Phone', 'Location', 'Items', 'Amount (KES)', 'Profit (KES)', 'Delivery fee (KES)', 'Status']];
    for (const o of ledger) {
      rows.push([
        fmtDate(o.createdAt), o.id, o.mpesaCode, PAYMENT_STATUSES[o.paymentStatus]?.admin || 'Paid', o.customerName, o.phone, o.location,
        o.items.map((i) => `${i.qty} x ${i.title}`).join('; '), o.total,
        o.items.reduce((a, i) => a + (i.price - (i.costPrice || 0)) * i.qty, 0), o.deliveryFee ?? '', o.status,
      ]);
    }
    const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Favo-Sales-${period === 'all' ? 'All-Time' : period}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Financial Overview"
        subtitle="Sales from confirmed M-Pesa payments. Pick a month to see what was sold."
        action={
          <button onClick={exportCsv} disabled={!ledger.length} className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-muted transition hover:text-fg hover:border-amber-500/50 disabled:opacity-40">
            <Download className="size-4" /> Download {period === 'all' ? 'all sales' : monthLabel(period, { month: 'short', year: 'numeric' })} (Excel)
          </button>
        }
      />

      {(lowStock.length > 0 || pendingFee > 0 || toCheck.length > 0) && (
        <div className="mb-6 grid sm:grid-cols-2 gap-3">
          {toCheck.length > 0 && (
            <button onClick={() => onGoto('orders')} className="sm:col-span-2 flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-left text-sm hover:bg-emerald-500/15">
              <BadgeCheck className="size-5 text-emerald-500 shrink-0" />
              <span><b>{toCheck.length} M-Pesa payment{toCheck.length > 1 ? 's' : ''}</b> ({kes(toCheck.reduce((a, o) => a + o.total, 0))}) to check against your M-Pesa messages →</span>
            </button>
          )}
          {lowStock.length > 0 && (
            <button onClick={() => onGoto('inventory')} className="flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-left text-sm hover:bg-amber-500/15">
              <AlertTriangle className="size-5 text-amber-500 shrink-0" />
              <span><b>{lowStock.length} product{lowStock.length > 1 ? 's' : ''}</b> low or out of stock. Restock now →</span>
            </button>
          )}
          {pendingFee > 0 && (
            <button onClick={() => onGoto('orders')} className="flex items-center gap-3 rounded-2xl border border-sky-500/40 bg-sky-500/10 p-4 text-left text-sm hover:bg-sky-500/15">
              <Receipt className="size-5 text-sky-500 shrink-0" />
              <span><b>{pendingFee} order{pendingFee > 1 ? 's' : ''}</b> awaiting a delivery quote →</span>
            </button>
          )}
        </div>
      )}

      {/* Month picker */}
      <div className="mb-5 glass rounded-2xl p-2 flex items-center gap-2">
        <span className="hidden sm:grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/15"><CalendarDays className="size-4 text-amber-600 dark:text-amber-400" /></span>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar" role="tablist" aria-label="Choose a month">
          {months.map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={period === k}
              onClick={() => setPeriod(k)}
              className={cx('shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold transition', period === k ? 'bg-gold text-slate-950 shadow' : 'text-muted hover:text-fg hover:bg-bgsoft')}
            >
              {k === thisMonth ? `This month · ${monthLabel(k, { month: 'short' })}` : monthLabel(k, { month: 'short', year: 'numeric' })}
            </button>
          ))}
          <button
            role="tab"
            aria-selected={period === 'all'}
            onClick={() => setPeriod('all')}
            className={cx('shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold transition', period === 'all' ? 'bg-gold text-slate-950 shadow' : 'text-muted hover:text-fg hover:bg-bgsoft')}
          >
            All time
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <Kpi icon={Banknote} label={`Revenue · ${periodName}`} value={kes(stats.revenue)} sub={`+ ${kes(stats.deliveryFees)} delivery fees`} change={prev && pct(stats.revenue, prev.revenue)} tone="amber" />
        <Kpi icon={TrendingUp} label="Net Profit (est.)" value={kes(stats.profit)} sub={`${stats.margin.toFixed(1)}% margin`} change={prev && pct(stats.profit, prev.profit)} tone="emerald" />
        <Kpi icon={ShoppingCart} label="Orders paid" value={stats.count.toLocaleString()} sub={`${stats.units} item${stats.units === 1 ? '' : 's'} sold`} change={prev && pct(stats.count, prev.count)} tone="sky" />
        <Kpi icon={Receipt} label="Avg. Order Value" value={kes(stats.aov)} sub="per paid order" change={prev && pct(stats.aov, prev.aov)} tone="violet" />
      </div>
      {prev && <p className="mt-2 text-[11px] text-muted">Arrows compare with {monthLabel(prevKey(period))}.</p>}

      <div className="mt-6 grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 glass rounded-3xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{period === 'all' ? 'Revenue by month' : `Daily revenue · ${monthLabel(period)}`}</p>
              <p className="text-xs text-muted">
                {kes(stats.revenue)} total
                {bestBar && bestBar.value > 0 && ` · best ${period === 'all' ? 'month' : 'day'}: ${bestBar.full} (${kes(bestBar.value)})`}
              </p>
            </div>
          </div>
          <div className="mt-6 h-52 flex items-end gap-[3px] sm:gap-1" role="img" aria-label={`Revenue chart for ${periodName}`}>
            {bars.map((d, i) => (
              <div key={d.key} className="group relative flex-1 h-full flex flex-col justify-end items-center">
                <div className="pointer-events-none absolute bottom-full mb-1 hidden group-hover:block whitespace-nowrap rounded-lg bg-fg text-bg px-2 py-1 text-[11px] font-semibold z-10">
                  {d.full}: {kes(d.value)}
                </div>
                {bars.length <= 12 && d.value > 0 && <span className="text-[10px] text-muted mb-1">{compact(d.value)}</span>}
                <div
                  className={cx('w-full rounded-t-md transition-all duration-500', i === todayIdx ? 'bg-amber-500' : 'bg-amber-500/45 group-hover:bg-amber-500/80')}
                  style={{ height: `${Math.max(d.value ? 4 : 1, (d.value / maxBar) * 100)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-[3px] sm:gap-1">
            {bars.map((d, i) => (
              <span key={d.key} className="flex-1 text-center text-[10px] text-muted">
                {bars.length <= 12 || i % 5 === 0 || i === bars.length - 1 ? d.label : ''}
              </span>
            ))}
          </div>
          {stats.revenue === 0 && <p className="mt-3 text-center text-xs text-muted">No confirmed sales in {periodName} yet.</p>}
        </div>

        <div className="lg:col-span-2 glass rounded-3xl p-5">
          <p className="font-semibold">Revenue by category</p>
          <p className="text-xs text-muted">Sales split by storefront section · {periodName}</p>
          <div className="mt-5 space-y-4">
            {byCategory.length === 0 && <p className="text-sm text-muted py-10 text-center">No sales yet.</p>}
            {byCategory.map((c) => (
              <div key={c.id}>
                <div className="flex justify-between text-sm"><span className="truncate pr-2">{c.name}</span><span className="font-semibold whitespace-nowrap">{kes(c.value)}</span></div>
                <div className="mt-1.5 h-2.5 rounded-full bg-bgsoft overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${(c.value / maxCat) * 100}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-muted">{((c.value / (stats.revenue || 1)) * 100).toFixed(1)}% of revenue</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* What was sold */}
      <div className="mt-6 glass rounded-3xl overflow-hidden">
        <div className="p-5">
          <p className="font-semibold">What was sold · {periodName}</p>
          <p className="text-xs text-muted">{sold.length} product{sold.length === 1 ? '' : 's'} · {stats.units} item{stats.units === 1 ? '' : 's'} · best sellers first</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted border-y border-line bg-bgsoft/50">
                <th className="px-5 py-3 font-semibold">Product</th>
                <th className="px-3 py-3 font-semibold text-right">Qty sold</th>
                <th className="px-3 py-3 font-semibold text-right">Revenue</th>
                <th className="px-5 py-3 font-semibold text-right">Profit</th>
              </tr>
            </thead>
            <tbody>
              {sold.map((r, i) => (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-bgsoft/40">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-xs font-bold text-muted">{i + 1}</span>
                      <SafeImage src={r.image} alt="" className="size-10 shrink-0 rounded-lg" />
                      <span className="font-medium">{r.title}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold">{r.qty}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">{kes(r.revenue)}</td>
                  <td className={cx('px-5 py-3 text-right whitespace-nowrap font-semibold', r.profit >= 0 ? 'text-emerald-500' : 'text-red-500')}>{kes(r.profit)}</td>
                </tr>
              ))}
              {sold.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-muted"><Package className="mx-auto mb-2 size-8 opacity-60" />Nothing sold in {periodName} yet.</td></tr>
              )}
            </tbody>
            {sold.length > 0 && (
              <tfoot>
                <tr className="border-t border-line bg-bgsoft/50 font-bold">
                  <td className="px-5 py-3">Total</td>
                  <td className="px-3 py-3 text-right">{stats.units}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">{kes(stats.revenue)}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap text-emerald-500">{kes(stats.profit)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="mt-6 glass rounded-3xl overflow-hidden">
        <div className="p-5 flex items-center justify-between">
          <div>
            <p className="font-semibold">M-Pesa Transaction Ledger · {periodName}</p>
            <p className="text-xs text-muted">{ledger.length} transaction{ledger.length === 1 ? '' : 's'} (including unconfirmed and cancelled)</p>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-emerald-500"><span className="size-2 rounded-full bg-emerald-500 animate-pulse" /> Live</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted border-y border-line bg-bgsoft/50">
                <th className="px-5 py-3 font-semibold">Receipt code</th>
                <th className="px-3 py-3 font-semibold">Customer phone</th>
                <th className="px-3 py-3 font-semibold text-right">Amount</th>
                <th className="px-3 py-3 font-semibold">Payment</th>
                <th className="px-3 py-3 font-semibold">Delivery location</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((o) => (
                <tr key={o.id} className="border-b border-line last:border-0 hover:bg-bgsoft/40">
                  <td className="px-5 py-3 font-mono font-bold text-emerald-500 tracking-wide">{o.mpesaCode}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{o.phone}<span className="block text-xs text-muted">{o.customerName}</span></td>
                  <td className="px-3 py-3 text-right font-semibold whitespace-nowrap">{kes(o.total)}</td>
                  <td className="px-3 py-3"><PaymentBadge status={o.paymentStatus} /></td>
                  <td className="px-3 py-3">{o.location}</td>
                  <td className="px-3 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-5 py-3 text-muted whitespace-nowrap">{fmtDate(o.createdAt)}</td>
                </tr>
              ))}
              {ledger.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-muted">No transactions in {periodName}. Orders appear here as soon as a customer submits an M-Pesa code.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** % change vs previous month, or null when there is nothing to compare with. */
function pct(now, before) {
  if (!before) return null;
  return ((now - before) / before) * 100;
}

function Kpi({ icon: Icon, label, value, sub, tone, change }) {
  const tones = { amber: 'text-amber-500 bg-amber-500/15', emerald: 'text-emerald-500 bg-emerald-500/15', sky: 'text-sky-500 bg-sky-500/15', violet: 'text-violet-400 bg-violet-500/15' };
  const up = change != null && change >= 0;
  return (
    <div className="glass rounded-3xl p-4 sm:p-5 transition hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-2">
        <span className={cx('grid size-9 place-items-center rounded-xl', tones[tone])}><Icon className="size-4.5" /></span>
        {change != null && (
          <span className={cx('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold', up ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500')}>
            {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {Math.abs(change).toFixed(0)}%
          </span>
        )}
      </div>
      <p className="mt-3 text-xs text-muted truncate">{label}</p>
      <p className="font-display text-lg sm:text-2xl font-bold mt-0.5 break-words">{value}</p>
      <p className="text-[11px] text-muted mt-1">{sub}</p>
    </div>
  );
}

export function StatusBadge({ status }) {
  const s = ORDER_STATUSES.find((x) => x.key === status) || ORDER_STATUSES[0];
  if (status === 'cancelled') return <Badge tone="red">Cancelled</Badge>;
  const tone = { pending: 'amber', confirmed: 'sky', dispatched: 'violet', delivered: 'emerald' }[s.key];
  return <Badge tone={tone}>{s.admin}</Badge>;
}

export function PaymentBadge({ status }) {
  const p = PAYMENT_STATUSES[status] || PAYMENT_STATUSES.verified;
  return <Badge tone={p.tone}>{p.admin}</Badge>;
}
