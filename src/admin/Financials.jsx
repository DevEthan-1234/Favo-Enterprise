import { useMemo, useState } from 'react';
import { AlertTriangle, Banknote, Receipt, ShoppingCart, TrendingUp } from 'lucide-react';
import { useStore } from '../store/StoreContext.jsx';
import { Badge, PageHeader } from '../components/ui.jsx';
import { ORDER_STATUSES } from '../data/seed.js';
import { cx, fmtDate, kes } from '../lib/utils.js';

const DAY = 86400000;
const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n)));

export default function Financials({ onGoto }) {
  const { orders, sections, products } = useStore();
  const [range, setRange] = useState(7);

  const stats = useMemo(() => {
    const revenue = orders.reduce((s, o) => s + o.total, 0);
    const profit = orders.reduce((s, o) => s + o.items.reduce((a, i) => a + (i.price - (i.costPrice || 0)) * i.qty, 0), 0);
    const deliveryFees = orders.reduce((s, o) => s + (o.deliveryFee || 0), 0);
    return { revenue, profit, count: orders.length, aov: orders.length ? revenue / orders.length : 0, deliveryFees, margin: revenue ? (profit / revenue) * 100 : 0 };
  }, [orders]);

  const daily = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const days = Array.from({ length: range }, (_, i) => {
      const d = new Date(start.getTime() - (range - 1 - i) * DAY);
      return { ts: d.getTime(), label: d.toLocaleDateString('en-KE', range > 7 ? { day: 'numeric' } : { weekday: 'short' }), full: d.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' }), value: 0 };
    });
    for (const o of orders) {
      const d = new Date(o.createdAt);
      d.setHours(0, 0, 0, 0);
      const slot = days.find((x) => x.ts === d.getTime());
      if (slot) slot.value += o.total;
    }
    return days;
  }, [orders, range]);

  const byCategory = useMemo(() => {
    const m = new Map();
    for (const o of orders) for (const i of o.items) m.set(i.sectionId, (m.get(i.sectionId) || 0) + i.price * i.qty);
    return [...m.entries()]
      .map(([id, value]) => ({ id, name: sections.find((s) => s.id === id)?.name || 'Archived section', value }))
      .sort((a, b) => b.value - a.value);
  }, [orders, sections]);

  const maxDay = Math.max(1, ...daily.map((d) => d.value));
  const maxCat = Math.max(1, ...byCategory.map((c) => c.value));
  const rangeTotal = daily.reduce((s, d) => s + d.value, 0);
  const lowStock = products.filter((p) => p.stock <= 3);
  const pendingFee = orders.filter((o) => o.deliveryFee == null).length;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Financial Overview" subtitle="Live revenue from M-Pesa checkouts. Updates instantly on every sale." />

      {(lowStock.length > 0 || pendingFee > 0) && (
        <div className="mb-6 grid sm:grid-cols-2 gap-3">
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

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <Kpi icon={Banknote} label="Total Revenue" value={kes(stats.revenue)} sub={`+ ${kes(stats.deliveryFees)} delivery fees`} tone="amber" />
        <Kpi icon={TrendingUp} label="Net Profit (est.)" value={kes(stats.profit)} sub={`${stats.margin.toFixed(1)}% margin`} tone="emerald" />
        <Kpi icon={ShoppingCart} label="Total Orders" value={stats.count.toLocaleString()} sub={`${orders.filter((o) => o.status !== 'delivered').length} in progress`} tone="sky" />
        <Kpi icon={Receipt} label="Avg. Order Value" value={kes(stats.aov)} sub="per M-Pesa checkout" tone="violet" />
      </div>

      <div className="mt-6 grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 glass rounded-3xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Revenue by day</p>
              <p className="text-xs text-muted">{kes(rangeTotal)} in the last {range} days</p>
            </div>
            <div className="flex rounded-xl bg-bgsoft p-1 text-xs">
              {[7, 30].map((r) => (
                <button key={r} onClick={() => setRange(r)} className={cx('rounded-lg px-3 py-1.5 font-semibold', range === r ? 'bg-amber-500 text-slate-950' : 'text-muted')}>{r}D</button>
              ))}
            </div>
          </div>
          <div className="mt-6 h-52 flex items-end gap-1 sm:gap-2" role="img" aria-label={`Revenue for the last ${range} days`}>
            {daily.map((d, i) => (
              <div key={d.ts} className="group relative flex-1 h-full flex flex-col justify-end items-center">
                <div className="pointer-events-none absolute bottom-full mb-1 hidden group-hover:block whitespace-nowrap rounded-lg bg-fg text-bg px-2 py-1 text-[11px] font-semibold z-10">
                  {d.full}: {kes(d.value)}
                </div>
                {range === 7 && d.value > 0 && <span className="text-[10px] text-muted mb-1">{compact(d.value)}</span>}
                <div
                  className={cx('w-full rounded-t-md transition-all duration-500', i === daily.length - 1 ? 'bg-amber-500' : 'bg-amber-500/45 group-hover:bg-amber-500/80')}
                  style={{ height: `${Math.max(d.value ? 4 : 1, (d.value / maxDay) * 100)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-1 sm:gap-2">
            {daily.map((d, i) => (
              <span key={d.ts} className="flex-1 text-center text-[10px] text-muted">{range > 7 && i % 5 !== 4 && i !== daily.length - 1 ? '' : d.label}</span>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 glass rounded-3xl p-5">
          <p className="font-semibold">Revenue by category</p>
          <p className="text-xs text-muted">All-time sales split by storefront section</p>
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

      <div className="mt-6 glass rounded-3xl overflow-hidden">
        <div className="p-5 flex items-center justify-between">
          <div>
            <p className="font-semibold">M-Pesa Transaction Ledger</p>
            <p className="text-xs text-muted">{orders.length} transaction{orders.length === 1 ? '' : 's'}</p>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-emerald-500"><span className="size-2 rounded-full bg-emerald-500 animate-pulse" /> Live</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted border-y border-line bg-bgsoft/50">
                <th className="px-5 py-3 font-semibold">Receipt code</th>
                <th className="px-3 py-3 font-semibold">Customer phone</th>
                <th className="px-3 py-3 font-semibold text-right">Amount paid</th>
                <th className="px-3 py-3 font-semibold">Delivery location</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-line last:border-0 hover:bg-bgsoft/40">
                  <td className="px-5 py-3 font-mono font-bold text-emerald-500 tracking-wide">{o.mpesaCode}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{o.phone}<span className="block text-xs text-muted">{o.customerName}</span></td>
                  <td className="px-3 py-3 text-right font-semibold whitespace-nowrap">{kes(o.total)}</td>
                  <td className="px-3 py-3">{o.location}</td>
                  <td className="px-3 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-5 py-3 text-muted whitespace-nowrap">{fmtDate(o.createdAt)}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-muted">No transactions yet. Sales appear here the moment a customer pays.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }) {
  const tones = { amber: 'text-amber-500 bg-amber-500/15', emerald: 'text-emerald-500 bg-emerald-500/15', sky: 'text-sky-500 bg-sky-500/15', violet: 'text-violet-400 bg-violet-500/15' };
  return (
    <div className="glass rounded-3xl p-4 sm:p-5 transition hover:-translate-y-0.5">
      <span className={cx('grid size-9 place-items-center rounded-xl', tones[tone])}><Icon className="size-4.5" /></span>
      <p className="mt-3 text-xs text-muted">{label}</p>
      <p className="font-display text-lg sm:text-2xl font-bold mt-0.5 break-words">{value}</p>
      <p className="text-[11px] text-muted mt-1">{sub}</p>
    </div>
  );
}

export function StatusBadge({ status }) {
  const s = ORDER_STATUSES.find((x) => x.key === status) || ORDER_STATUSES[0];
  const tone = { pending: 'amber', confirmed: 'sky', dispatched: 'violet', delivered: 'emerald' }[s.key];
  return <Badge tone={tone}>{s.admin}</Badge>;
}
