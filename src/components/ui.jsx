import { useEffect, useState } from 'react';
import { ImageOff, X } from 'lucide-react';
import { cx, stockLabel } from '../lib/utils.js';

function useLockScroll(open) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);
}

function useEscape(open, onClose) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
}

export function Modal({ open, onClose, title, children, size = 'md', hideClose = false }) {
  useLockScroll(open);
  useEscape(open && !hideClose, onClose);
  if (!open) return null;
  const width = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-3xl', xl: 'sm:max-w-5xl' }[size];
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={hideClose ? undefined : onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'relative w-full max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-card border border-line shadow-2xl',
          'animate-slide-up sm:animate-pop-in',
          width
        )}
      >
        {(title || !hideClose) && (
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 bg-card/95 backdrop-blur border-b border-line">
            <h2 className="font-display text-lg font-semibold truncate">{title}</h2>
            {!hideClose && (
              <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-bgsoft transition" aria-label="Close">
                <X className="size-5" />
              </button>
            )}
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children, footer }) {
  useLockScroll(open);
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[65]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full sm:max-w-md bg-card border-l border-line shadow-2xl flex flex-col animate-slide-in-right">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-bgsoft transition" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="border-t border-line p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </aside>
    </div>
  );
}

const TONES = {
  emerald: 'bg-emerald-500/15 text-emerald-500 ring-emerald-500/30',
  amber: 'bg-amber-500/15 text-amber-500 ring-amber-500/30',
  red: 'bg-red-500/15 text-red-500 ring-red-500/30',
  sky: 'bg-sky-500/15 text-sky-500 ring-sky-500/30',
  violet: 'bg-violet-500/15 text-violet-400 ring-violet-500/30',
  slate: 'bg-slate-500/15 text-muted ring-slate-500/30',
};

export function Badge({ tone = 'slate', children, className }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset whitespace-nowrap', TONES[tone], className)}>
      {children}
    </span>
  );
}

export function StockBadge({ stock }) {
  const s = stockLabel(stock);
  return <Badge tone={s.tone}>{s.text}</Badge>;
}

export function ConditionBadge({ condition }) {
  const tone = condition === 'Brand New' ? 'sky' : condition === 'Pre-Order / Import' ? 'violet' : 'amber';
  return <Badge tone={tone}>{condition}</Badge>;
}

export function SafeImage({ src, alt, className }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return (
      <div className={cx('flex items-center justify-center bg-bgsoft text-muted', className)}>
        <ImageOff className="size-8 opacity-60" />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={cx('object-cover', className)} />;
}

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-500">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Button({ variant = 'primary', className, children, ...props }) {
  const styles = {
    primary: 'bg-gold text-slate-950 hover:brightness-110 shadow-lg shadow-amber-500/25',
    mpesa: 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/25',
    ghost: 'bg-bgsoft text-fg hover:bg-line border border-line',
    danger: 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30',
  }[variant];
  return (
    <button
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none',
        styles,
        className
      )}
    >
      {children}
    </button>
  );
}

export function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="fixed left-1/2 -translate-x-1/2 top-4 z-[90] w-max max-w-[calc(100vw-2rem)] animate-pop-in" key={toast.id}>
      <div className="glass rounded-full px-4 py-2.5 text-sm font-medium shadow-xl flex items-center gap-2">
        <span className="size-2 rounded-full bg-emerald-500" />
        {toast.text}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
