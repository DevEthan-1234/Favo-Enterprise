import { Eye, Images, ShoppingCart } from 'lucide-react';
import { ConditionBadge, SafeImage, StockBadge } from '../components/ui.jsx';
import { kes } from '../lib/utils.js';

export default function ProductCard({ product: p, onQuickView, onAdd }) {
  const out = p.stock <= 0;
  return (
    <article
      onClick={() => onQuickView(p.id)}
      className="group glass rounded-2xl sm:rounded-3xl overflow-hidden cursor-pointer flex flex-col transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-amber-500/10 hover:border-amber-500/40"
    >
      <div className="relative overflow-hidden">
        <SafeImage src={p.image} alt={p.title} className={`aspect-square w-full transition duration-500 group-hover:scale-110 ${out ? 'grayscale opacity-60' : ''}`} />
        {p.images?.length > 1 && (
          <>
            <img
              src={p.images[1]}
              alt=""
              loading="lazy"
              className={`absolute inset-0 hidden size-full object-cover opacity-0 transition duration-500 sm:block group-hover:opacity-100 group-hover:scale-110 ${out ? 'grayscale' : ''}`}
            />
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
              <Images className="size-3" /> {p.images.length}
            </span>
          </>
        )}
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          <ConditionBadge condition={p.condition} />
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onQuickView(p.id); }}
          className="absolute right-2 top-2 grid size-9 place-items-center rounded-full glass opacity-100 sm:opacity-0 sm:translate-y-1 transition group-hover:opacity-100 group-hover:translate-y-0 hover:text-amber-500"
          aria-label={`Quick view ${p.title}`}
        >
          <Eye className="size-4" />
        </button>
      </div>
      <div className="p-3 sm:p-4 flex flex-col flex-1">
        <p className="text-[11px] uppercase tracking-wider text-muted">{p.brand}</p>
        <h3 className="mt-0.5 text-sm sm:text-[15px] font-semibold leading-snug line-clamp-2">{p.title}</h3>
        <div className="mt-2"><StockBadge stock={p.stock} /></div>
        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
          <p className="font-display text-base sm:text-lg font-bold text-amber-500 whitespace-nowrap">{kes(p.price)}</p>
          <button
            disabled={out}
            onClick={(e) => { e.stopPropagation(); onAdd(p.id); }}
            className="grid size-9 sm:size-10 shrink-0 place-items-center rounded-xl bg-amber-500 text-slate-950 transition hover:bg-amber-400 hover:scale-110 active:scale-90 disabled:bg-bgsoft disabled:text-muted disabled:hover:scale-100"
            aria-label={out ? 'Out of stock' : `Add ${p.title} to cart`}
          >
            <ShoppingCart className="size-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
