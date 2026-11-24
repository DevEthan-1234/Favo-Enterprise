import { useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import Navbar from './Navbar.jsx';
import Hero from './Hero.jsx';
import Catalog from './Catalog.jsx';
import Footer from './Footer.jsx';
import QuickView from './QuickView.jsx';
import CartDrawer from './CartDrawer.jsx';
import Checkout from './Checkout.jsx';
import ImportModal from './ImportModal.jsx';
import OrderTracker from './OrderTracker.jsx';
import ChatWidget from './ChatWidget.jsx';

export default function Storefront({ theme, toggleTheme, notify, onAdminClick, isAdmin }) {
  const { addToCart, products } = useStore();
  const [quickViewId, setQuickViewId] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const handleAdd = (id, qty = 1) => {
    const p = products.find((x) => x.id === id);
    if (addToCart(id, qty)) notify(`${p?.title ?? 'Item'} added to cart`);
    else notify('Sorry, this item is out of stock');
  };

  return (
    <div className="min-h-dvh flex flex-col">
      <Navbar
        theme={theme}
        toggleTheme={toggleTheme}
        onCart={() => setCartOpen(true)}
        onTrack={() => setTrackerOpen(true)}
        onAdmin={onAdminClick}
        isAdmin={isAdmin}
      />
      <main className="flex-1">
        <Hero onImport={() => setImportOpen(true)} onChat={() => setChatOpen(true)} />
        <Catalog onQuickView={setQuickViewId} onAdd={handleAdd} onImport={() => setImportOpen(true)} />
      </main>
      <Footer onAdmin={onAdminClick} onTrack={() => setTrackerOpen(true)} onImport={() => setImportOpen(true)} />

      <QuickView productId={quickViewId} onClose={() => setQuickViewId(null)} onAdd={handleAdd} />
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }}
      />
      <Checkout open={checkoutOpen} onClose={() => setCheckoutOpen(false)} onTrack={() => { setCheckoutOpen(false); setTrackerOpen(true); }} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} notify={notify} onOpenChat={() => { setImportOpen(false); setChatOpen(true); }} />
      <OrderTracker open={trackerOpen} onClose={() => setTrackerOpen(false)} />
      <ChatWidget open={chatOpen} setOpen={setChatOpen} />
    </div>
  );
}
