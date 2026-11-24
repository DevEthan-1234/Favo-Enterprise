import { Clock, Globe2, MessageCircle, PackageCheck, ShieldCheck, Smartphone, Truck } from 'lucide-react';
import { BRAND } from '../data/seed.js';
import { waLink } from '../lib/utils.js';

const PROPS = [
  { icon: ShieldCheck, title: 'Quality Checked', text: 'Every item checked before delivery' },
  { icon: Smartphone, title: 'Pay via M-Pesa', text: `Send Money to ${BRAND.mpesaDisplay}` },
  { icon: Truck, title: 'Countrywide Delivery', text: 'Nairobi same-day, upcountry 24–48h' },
  { icon: Globe2, title: 'Direct from China', text: 'We import what you need on order' },
];

/** Gold ribbon swooshes echoing the brand artwork. Purely decorative. */
function Swooshes() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="favo-gold" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#f6da9c" stopOpacity="0" />
          <stop offset="0.35" stopColor="#efc66a" stopOpacity="0.9" />
          <stop offset="0.7" stopColor="#c28a2b" stopOpacity="0.8" />
          <stop offset="1" stopColor="#f6da9c" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M-40 140 C 220 -40, 520 -10, 760 60" fill="none" stroke="url(#favo-gold)" strokeWidth="2.5" />
      <path d="M520 720 C 760 600, 1020 520, 1260 300" fill="none" stroke="url(#favo-gold)" strokeWidth="3" />
      <path d="M640 730 C 860 640, 1080 560, 1260 420" fill="none" stroke="url(#favo-gold)" strokeWidth="1.5" opacity="0.6" />
    </svg>
  );
}

export default function Hero({ onImport, onChat }) {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 size-[520px] rounded-full bg-amber-500/15 blur-3xl" />
        <div className="absolute top-40 -right-40 size-[480px] rounded-full bg-amber-600/10 blur-3xl" />
      </div>
      <Swooshes />

      <div className="relative mx-auto max-w-7xl px-4 pt-8 pb-10 sm:pt-14 lg:pt-16 grid lg:grid-cols-[1.05fr_1fr] gap-10 items-center">
        <div className="animate-pop-in">
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs font-medium">
            <span className="relative flex size-2"><span className="absolute inset-0 rounded-full bg-emerald-500 animate-pulse-ring" /><span className="relative size-2 rounded-full bg-emerald-500" /></span>
            {BRAND.handle} · Your trusted online tech store 📦
          </div>

          <p className="mt-6 flex items-center gap-3 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.3em] text-amber-700 dark:text-amber-400">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-amber-500" />
            Gadgets &amp; Lifestyle Electronics
          </p>
          <h1 className="mt-3 font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
            Electronics at prices <span className="wordmark text-gold pr-1">you dream of</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted max-w-xl">
            All our products come straight from China: brand new, quality checked and at great prices. {BRAND.services}
          </p>

          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <a href="#shop" className="bg-gold inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 font-semibold text-slate-950 shadow-xl shadow-amber-500/30 transition hover:brightness-110 hover:-translate-y-0.5 active:scale-[0.98]">
              <PackageCheck className="size-5" /> Shop Now
            </a>
            <a href={waLink('Hi Favo Enterprise 👋 I would like to make an inquiry.')} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3.5 font-semibold text-white shadow-xl shadow-emerald-500/25 transition hover:bg-emerald-400 hover:-translate-y-0.5 active:scale-[0.98]">
              <MessageCircle className="size-5" /> WhatsApp Us
            </a>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5"><Clock className="size-4 text-amber-500" /> Open {BRAND.hours}</span>
            <span className="inline-flex items-center gap-1.5"><MessageCircle className="size-4 text-emerald-500" /> {BRAND.whatsappDisplay}</span>
            <button onClick={onChat} className="underline underline-offset-4 hover:text-fg">Chat on site</button>
          </div>
        </div>

        {/* Brand artwork */}
        <div className="relative mx-auto w-full max-w-[520px] animate-pop-in" style={{ animationDelay: '80ms' }}>
          <div className="absolute -inset-6 rounded-[2.5rem] bg-amber-500/20 blur-3xl" aria-hidden="true" />
          <div className="relative rounded-[2rem] p-[1.5px] bg-gradient-to-br from-amber-300/80 via-amber-600/30 to-amber-400/70 shadow-2xl shadow-black/40">
            <img
              src="/brand/poster.jpg"
              alt="Favo Enterprise: gadgets and lifestyle electronics"
              width="1000"
              height="1000"
              className="block aspect-square w-full rounded-[calc(2rem-1.5px)] object-cover"
            />
          </div>
        </div>
      </div>

      {/* Import banner */}
      <div className="relative mx-auto max-w-7xl px-4">
        <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="bg-gold grid size-12 shrink-0 place-items-center rounded-2xl text-slate-950"><Globe2 className="size-6" /></span>
            <div>
              <h2 className="font-display text-xl font-bold">Can't find it? We'll import it ✈️</h2>
              <p className="text-sm text-muted mt-1">Tell us what you want from China. We source it, ship it and deliver it to your door.</p>
            </div>
          </div>
          <button onClick={onImport} className="bg-gold shrink-0 rounded-2xl px-5 py-3 font-semibold text-slate-950 transition hover:brightness-110 hover:scale-[1.03] active:scale-95">
            Request Custom Import
          </button>
        </div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {PROPS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="glass rounded-2xl p-4 transition hover:-translate-y-0.5 hover:border-amber-500/40">
            <span className="grid size-9 place-items-center rounded-xl bg-amber-500/15"><Icon className="size-5 text-amber-600 dark:text-amber-400" /></span>
            <p className="mt-3 text-sm font-semibold">{title}</p>
            <p className="text-xs text-muted mt-0.5">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
