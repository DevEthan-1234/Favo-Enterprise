import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, MessageCircle, Minus, Plus, ShieldCheck, ShoppingCart } from 'lucide-react';
import { useStore } from '../store/StoreContext.jsx';
import { Button, ConditionBadge, Modal, SafeImage, StockBadge } from '../components/ui.jsx';
import { cx, kes, waLink } from '../lib/utils.js';

/** Swipeable photo gallery: scroll-snap on touch, arrows + thumbnails on desktop. */
function Gallery({ images, title, condition }) {
  const list = images?.length ? images : [''];
  const track = useRef(null);
  const [index, setIndex] = useState(0);
  const many = list.length > 1;

  const go = (i) => {
    const el = track.current;
    if (!el) return;
    const next = (i + list.length) % list.length;
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    setIndex(next);
  };
  const onScroll = () => {
    const el = track.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  useEffect(() => {
    if (!many) return;
    const h = (e) => {
      if (e.key === 'ArrowRight') go(index + 1);
      if (e.key === 'ArrowLeft') go(index - 1);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }); // re-binds each render so `index` is current

  const arrow = 'absolute top-1/2 -translate-y-1/2 grid size-9 place-items-center rounded-full glass text-fg shadow-lg transition hover:text-amber-500 active:scale-90';

  return (
    <div className="min-w-0">
      <div className="relative">
        <div
          ref={track}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-roledescription="carousel"
          aria-label={`${title} photos`}
        >
          {list.map((src, i) => (
            <div key={`${src}-${i}`} className="w-full shrink-0 snap-center" aria-label={`Photo ${i + 1} of ${list.length}`}>
              <SafeImage src={src} alt={i === 0 ? title : `${title}, photo ${i + 1}`} className="aspect-square w-full" />
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute left-3 top-3"><ConditionBadge condition={condition} /></div>
        {many && (
          <>
            <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
              {index + 1} / {list.length}
            </span>
            <button type="button" onClick={() => go(index - 1)} className={cx(arrow, 'left-2')} aria-label="Previous photo"><ChevronLeft className="size-5" /></button>
            <button type="button" onClick={() => go(index + 1)} className={cx(arrow, 'right-2')} aria-label="Next photo"><ChevronRight className="size-5" /></button>
          </>
        )}
      </div>
      {many && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {list.map((src, i) => (
            <button
              type="button"
              key={`t-${src}-${i}`}
              onClick={() => go(i)}
              className={cx('size-16 shrink-0 overflow-hidden rounded-xl border-2 transition', i === index ? 'border-amber-500' : 'border-transparent opacity-60 hover:opacity-100')}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === index}
            >
              <SafeImage src={src} alt="" className="size-full" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function QuickView({ productId, onClose, onAdd }) {
  const { products, sections } = useStore();
  const p = products.find((x) => x.id === productId);
  const [qty, setQty] = useState(1);

  useEffect(() => setQty(1), [productId]);

  if (!p) return <Modal open={false} onClose={onClose} />;

  const section = sections.find((s) => s.id === p.sectionId);
  const specs = (p.specs || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const out = p.stock <= 0;
  const inquiry = `Hi Favo Enterprise 👋 I'm interested in the *${p.title}* (${kes(p.price)}, ${p.condition}). Is it available?`;

  return (
    <Modal open={!!productId} onClose={onClose} title={p.title} size="lg">
      <div className="grid md:grid-cols-2 gap-6">
        <Gallery key={p.id} images={p.images} title={p.title} condition={p.condition} />
        <div className="flex flex-col">
          <p className="text-xs uppercase tracking-wider text-muted">{p.brand}{section ? ` · ${section.name}` : ''}</p>
          <p className="mt-2 font-display text-3xl font-bold text-amber-500">{kes(p.price)}</p>
          <div className="mt-2"><StockBadge stock={p.stock} /></div>
          {p.description && <p className="mt-4 text-sm text-muted leading-relaxed">{p.description}</p>}

          {specs.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Key specs</p>
              <ul className="space-y-1.5">
                {specs.map((s) => (
                  <li key={s} className="flex gap-2 text-sm"><CheckCircle2 className="size-4 mt-0.5 shrink-0 text-emerald-500" />{s}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-500">
            <ShieldCheck className="size-4 shrink-0" />
            {p.warranty || 'Warranty details available on request'}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <div className="flex items-center rounded-xl border border-line">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={out} className="p-2.5 hover:text-amber-500 disabled:opacity-40" aria-label="Decrease quantity"><Minus className="size-4" /></button>
              <span className="w-8 text-center font-semibold">{out ? 0 : qty}</span>
              <button onClick={() => setQty((q) => Math.min(p.stock, q + 1))} disabled={out || qty >= p.stock} className="p-2.5 hover:text-amber-500 disabled:opacity-40" aria-label="Increase quantity"><Plus className="size-4" /></button>
            </div>
            <Button className="flex-1" disabled={out} onClick={() => { onAdd(p.id, qty); onClose(); }}>
              <ShoppingCart className="size-4" /> {out ? 'Out of Stock' : 'Add to Cart'}
            </Button>
          </div>
          <a href={waLink(inquiry)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 px-4 py-2.5 text-sm font-semibold text-emerald-500 transition hover:bg-emerald-500/10">
            <MessageCircle className="size-4" /> {out ? 'Reserve via WhatsApp' : 'Inquire on WhatsApp'}
          </a>
        </div>
      </div>
    </Modal>
  );
}
