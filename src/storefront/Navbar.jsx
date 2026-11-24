import { useEffect, useState } from 'react';
import { Lock, MessageCircle, Moon, PackageSearch, ShoppingBag, Sun } from 'lucide-react';
import { useStore } from '../store/StoreContext.jsx';
import { BRAND } from '../data/seed.js';
import { cx, waLink } from '../lib/utils.js';

export function Logo({ compact = false }) {
  return (
    <a href="#/" className="flex items-center gap-2.5 group" aria-label={BRAND.name}>
      <img
        src="/brand/logo-mark.png"
        alt=""
        width="40"
        height="40"
        className="size-10 rounded-xl object-cover ring-1 ring-amber-500/40 shadow-lg shadow-amber-500/20 transition group-hover:scale-105 group-hover:shadow-amber-500/40"
      />
      {!compact && (
        <span className="leading-tight">
          <span className="wordmark block text-[17px] sm:text-[19px]"><span className="text-fg">Favo</span><span className="text-gold">Enterprise</span></span>
          <span className="hidden sm:block text-[9px] uppercase tracking-[0.22em] text-muted">Gadgets &amp; Lifestyle Electronics</span>
        </span>
      )}
    </a>
  );
}

export default function Navbar({ theme, toggleTheme, onCart, onTrack, onAdmin, isAdmin }) {
  const { cart } = useStore();
  const count = cart.reduce((s, c) => s + c.qty, 0);
  const [scrolled, setScrolled] = useState(false);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 8);
    h();
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => {
    if (!count) return;
    setBump(true);
    const t = setTimeout(() => setBump(false), 300);
    return () => clearTimeout(t);
  }, [count]);

  const iconBtn = 'relative grid size-10 place-items-center rounded-xl text-muted hover:text-fg hover:bg-bgsoft transition active:scale-95';

  return (
    <header className={cx('sticky top-0 z-40 transition-all', scrolled ? 'glass shadow-lg shadow-black/10' : 'bg-transparent border-b border-transparent')}>
      <div className="hidden sm:block bg-gold text-slate-950 text-xs font-semibold">
        <div className="mx-auto max-w-7xl px-4 py-1.5 flex items-center justify-between">
          <span>🚚 Countrywide delivery · Pay securely via M-Pesa</span>
          <span>Open {BRAND.hours} · WhatsApp {BRAND.whatsappDisplay}</span>
        </div>
      </div>
      <nav className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between gap-2">
        <Logo />
        <div className="flex items-center gap-1">
          <button onClick={onTrack} className={cx(iconBtn, 'sm:w-auto sm:px-3 sm:gap-2 sm:flex')} aria-label="Track order">
            <PackageSearch className="size-5" />
            <span className="hidden sm:inline text-sm font-medium">Track Order</span>
          </button>
          <a href={waLink('Hi Favo Enterprise 👋')} target="_blank" rel="noreferrer" className={cx(iconBtn, 'hidden sm:grid text-emerald-500')} aria-label="WhatsApp">
            <MessageCircle className="size-5" />
          </a>
          <button onClick={toggleTheme} className={iconBtn} aria-label="Toggle theme">
            {theme === 'light' ? <Moon className="size-5" /> : <Sun className="size-5" />}
          </button>
          <button onClick={onAdmin} className={cx(iconBtn, isAdmin && 'text-amber-500')} aria-label="Admin login" title={isAdmin ? 'Open Admin Portal' : 'Admin Login'}>
            <Lock className="size-4" />
          </button>
          <button onClick={onCart} className={cx(iconBtn, 'bg-bgsoft text-fg ml-1', bump && 'scale-110')} aria-label={`Cart, ${count} items`}>
            <ShoppingBag className="size-5" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-amber-500 text-slate-950 text-[11px] font-bold grid place-items-center">
                {count}
              </span>
            )}
          </button>
        </div>
      </nav>
    </header>
  );
}
