import { Clock, Instagram, MessageCircle } from 'lucide-react';
import { BRAND } from '../data/seed.js';
import { waLink } from '../lib/utils.js';
import { Logo } from './Navbar.jsx';

export default function Footer({ onAdmin, onTrack, onImport }) {
  return (
    <footer className="mt-16 border-t border-line bg-bgsoft/50 pb-24 sm:pb-8">
      <div className="mx-auto max-w-7xl px-4 py-10 grid gap-8 sm:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-muted max-w-xs">{BRAND.tagline}<span className="block mt-1">{BRAND.taglineSub}</span></p>
        </div>
        <div className="text-sm space-y-2">
          <p className="font-semibold">Customer care</p>
          <button onClick={onTrack} className="block text-muted hover:text-fg">Track your order</button>
          <button onClick={onImport} className="block text-muted hover:text-fg">Request a custom import</button>
          <a href="#shop" className="block text-muted hover:text-fg">Shop all products</a>
        </div>
        <div className="text-sm space-y-2">
          <p className="font-semibold">Contact</p>
          <a href={waLink()} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-muted hover:text-emerald-500"><MessageCircle className="size-4" /> {BRAND.whatsappDisplay}</a>
          <a href={BRAND.instagram} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-muted hover:text-amber-500"><Instagram className="size-4" /> {BRAND.handle}</a>
          <p className="flex items-center gap-2 text-muted"><Clock className="size-4" /> {BRAND.hours}</p>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted">
        <p>© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</p>
        <button onClick={onAdmin} className="opacity-50 hover:opacity-100 transition">Admin Login</button>
      </div>
    </footer>
  );
}
