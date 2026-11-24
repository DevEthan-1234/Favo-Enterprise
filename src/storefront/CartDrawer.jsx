import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useStore } from '../store/StoreContext.jsx';
import { Button, Drawer, SafeImage } from '../components/ui.jsx';
import { kes } from '../lib/utils.js';

export default function CartDrawer({ open, onClose, onCheckout }) {
  const { cartLines, setCartQty, clearCart } = useStore();
  const subtotal = cartLines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const count = cartLines.reduce((s, l) => s + l.qty, 0);
  const hasIssue = cartLines.some((l) => l.product.stock < l.qty || l.product.stock <= 0);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Your Cart (${count})`}
      footer={
        cartLines.length > 0 && (
          <div>
            <div className="flex justify-between text-sm text-muted"><span>Subtotal</span><span>{kes(subtotal)}</span></div>
            <div className="flex justify-between text-sm text-muted mt-1"><span>Delivery</span><span>Confirmed after order</span></div>
            <div className="flex justify-between mt-3 font-display text-xl font-bold"><span>Total</span><span className="text-amber-500">{kes(subtotal)}</span></div>
            {hasIssue && <p className="mt-2 text-xs text-red-500">Some items exceed available stock. Please adjust quantities.</p>}
            <Button variant="mpesa" className="mt-4 w-full py-3.5 text-base" disabled={hasIssue} onClick={onCheckout}>
              Checkout · Pay via M-Pesa
            </Button>
            <button onClick={clearCart} className="mt-3 w-full text-xs text-muted hover:text-red-500">Clear cart</button>
          </div>
        )
      }
    >
      {cartLines.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center py-16">
          <span className="grid size-16 place-items-center rounded-full bg-bgsoft"><ShoppingBag className="size-7 text-muted" /></span>
          <p className="mt-4 font-semibold">Your cart is empty</p>
          <p className="text-sm text-muted mt-1">Discover great deals on electronics.</p>
          <Button className="mt-5" onClick={onClose}>Start Shopping</Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {cartLines.map(({ product: p, qty }) => (
            <li key={p.id} className="flex gap-3 rounded-2xl border border-line p-3 animate-fade-in">
              <SafeImage src={p.image} alt={p.title} className="size-20 rounded-xl shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold line-clamp-2">{p.title}</p>
                <p className="text-sm font-bold text-amber-500 mt-1">{kes(p.price)}</p>
                {p.stock < qty && <p className="text-xs text-red-500">Only {p.stock} available</p>}
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center rounded-lg border border-line">
                    <button onClick={() => setCartQty(p.id, qty - 1)} className="p-1.5 hover:text-amber-500" aria-label="Decrease"><Minus className="size-3.5" /></button>
                    <span className="w-7 text-center text-sm font-semibold">{qty}</span>
                    <button onClick={() => setCartQty(p.id, qty + 1)} disabled={qty >= p.stock} className="p-1.5 hover:text-amber-500 disabled:opacity-40" aria-label="Increase"><Plus className="size-3.5" /></button>
                  </div>
                  <button onClick={() => setCartQty(p.id, 0)} className="p-1.5 text-muted hover:text-red-500" aria-label={`Remove ${p.title}`}><Trash2 className="size-4" /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
