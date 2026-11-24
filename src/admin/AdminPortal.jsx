import { useState } from 'react';
import { BarChart3, Boxes, ExternalLink, Inbox as InboxIcon, LayoutList, LogOut, Moon, Sun, Truck } from 'lucide-react';
import { useStore } from '../store/StoreContext.jsx';
import { cx } from '../lib/utils.js';
import { Logo } from '../storefront/Navbar.jsx';
import Financials from './Financials.jsx';
import OrdersHub from './OrdersHub.jsx';
import Inventory from './Inventory.jsx';
import SectionManager from './SectionManager.jsx';
import Inbox from './Inbox.jsx';

export default function AdminPortal({ onLogout, theme, toggleTheme, notify }) {
  const { orders, products, conversations } = useStore();
  const [tab, setTab] = useState('overview');

  const pending = orders.filter((o) => o.status === 'pending').length;
  const lowStock = products.filter((p) => p.stock <= 3).length;
  const unread = conversations.reduce((s, c) => s + (c.unreadAdmin || 0), 0);

  const TABS = [
    { key: 'overview', label: 'Financials', icon: BarChart3 },
    { key: 'orders', label: 'Orders', icon: Truck, badge: pending },
    { key: 'inventory', label: 'Products', icon: Boxes, badge: lowStock, badgeTone: 'amber' },
    { key: 'sections', label: 'Sections', icon: LayoutList },
    { key: 'inbox', label: 'Inbox', icon: InboxIcon, badge: unread },
  ];

  return (
    <div className="min-h-dvh lg:flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-line bg-bgsoft/40 p-5 sticky top-0 h-dvh">
        <Logo />
        <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-amber-500 font-semibold">Admin Portal</p>
        <nav className="mt-8 space-y-1">
          {TABS.map((t) => <TabButton key={t.key} t={t} active={tab === t.key} onClick={() => setTab(t.key)} />)}
        </nav>
        <div className="mt-auto space-y-1">
          <a href="#/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted hover:bg-card hover:text-fg"><ExternalLink className="size-4" /> View storefront</a>
          <button onClick={toggleTheme} className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted hover:bg-card hover:text-fg">
            {theme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />} {theme === 'light' ? 'Dark mode' : 'Light mode'}
          </button>
          <button onClick={onLogout} className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-500/10"><LogOut className="size-4" /> Logout</button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {/* Top bar (mobile/tablet) */}
        <header className="lg:hidden sticky top-0 z-40 glass">
          <div className="flex items-center justify-between px-4 h-14">
            <Logo compact />
            <span className="text-xs uppercase tracking-[0.2em] text-amber-500 font-semibold">Admin</span>
            <div className="flex items-center gap-1">
              <a href="#/" className="p-2 text-muted hover:text-fg" aria-label="View storefront"><ExternalLink className="size-5" /></a>
              <button onClick={toggleTheme} className="p-2 text-muted hover:text-fg" aria-label="Toggle theme">{theme === 'light' ? <Moon className="size-5" /> : <Sun className="size-5" />}</button>
              <button onClick={onLogout} className="p-2 text-red-500" aria-label="Logout"><LogOut className="size-5" /></button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto no-scrollbar px-3 pb-2">
            {TABS.map((t) => <TabButton key={t.key} t={t} active={tab === t.key} onClick={() => setTab(t.key)} compact />)}
          </nav>
        </header>

        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 pb-16">
          {tab === 'overview' && <Financials onGoto={setTab} />}
          {tab === 'orders' && <OrdersHub notify={notify} />}
          {tab === 'inventory' && <Inventory notify={notify} />}
          {tab === 'sections' && <SectionManager notify={notify} />}
          {tab === 'inbox' && <Inbox />}
        </main>
      </div>
    </div>
  );
}

function TabButton({ t, active, onClick, compact }) {
  const Icon = t.icon;
  return (
    <button
      onClick={onClick}
      className={cx(
        'relative flex items-center gap-3 rounded-xl text-sm font-medium transition shrink-0',
        compact ? 'px-3 py-2' : 'w-full px-3 py-2.5',
        active ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' : 'text-muted hover:bg-card hover:text-fg'
      )}
    >
      <Icon className="size-4" />
      {t.label}
      {t.badge > 0 && (
        <span className={cx('ml-auto min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold grid place-items-center', active ? 'bg-slate-950 text-amber-400' : t.badgeTone === 'amber' ? 'bg-amber-500 text-slate-950' : 'bg-red-500 text-white')}>
          {t.badge}
        </span>
      )}
    </button>
  );
}
