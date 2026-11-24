import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, Info, Loader2, Lock, MapPin, PackageSearch, Smartphone, XCircle } from 'lucide-react';
import { useStore } from '../store/StoreContext.jsx';
import { Button, Field, Modal } from '../components/ui.jsx';
import { DELIVERY_AREAS } from '../data/seed.js';
import { downloadReceipt, fmtDate, kes, normalizeKePhone } from '../lib/utils.js';

const EMPTY = { name: '', phone: '', location: '', notes: '' };

export default function Checkout({ open, onClose, onTrack }) {
  const { cartLines, placeOrder, chatIdentity } = useStore();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState('form'); // form | sending | pin | processing | success | failed
  const [pin, setPin] = useState('');
  const [failReason, setFailReason] = useState('');
  const [order, setOrder] = useState(null);
  const timer = useRef(null);

  const subtotal = cartLines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const phone = normalizeKePhone(form.phone);

  useEffect(() => {
    if (open) {
      setStep('form');
      setPin('');
      setOrder(null);
      setErrors({});
      setForm((f) => ({ ...f, name: f.name || chatIdentity?.name || '', phone: f.phone || chatIdentity?.phone || '' }));
    }
    return () => clearTimeout(timer.current);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Please enter your full name.';
    if (!phone) e.phone = 'Use a valid Safaricom number e.g. 0712 345 678 or 0110 123 456.';
    if (form.location.trim().length < 2) e.location = 'Tell us where to deliver.';
    if (!cartLines.length) e.cart = 'Your cart is empty.';
    const short = cartLines.find((l) => l.product.stock < l.qty);
    if (short) e.cart = `Only ${short.product.stock} unit(s) of ${short.product.title} available.`;
    setErrors(e);
    return !Object.keys(e).length;
  };

  const startPayment = (e) => {
    e.preventDefault();
    if (!validate()) return;
    setStep('sending');
    timer.current = setTimeout(() => setStep('pin'), 1800);
  };

  const confirmPin = (e) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) return;
    setStep('processing');
    const minDelay = new Promise((r) => { timer.current = setTimeout(r, 1800); });
    Promise.all([
      placeOrder({ customerName: form.name, phone: phone.local, location: form.location, notes: form.notes }),
      minDelay,
    ]).then(([res]) => {
      if (res.error) {
        setFailReason(res.error);
        setStep('failed');
      } else {
        setOrder(res.order);
        setStep('success');
        setForm((f) => ({ ...f, notes: '' }));
      }
      setPin('');
    });
  };

  const cancelPin = () => {
    setPin('');
    setFailReason('Request cancelled by user. No money was deducted.');
    setStep('failed');
  };

  const busy = step === 'sending' || step === 'processing' || step === 'pin';

  return (
    <Modal open={open} onClose={onClose} title={step === 'success' ? 'Payment Successful' : 'Checkout'} size="md" hideClose={busy}>
      {step === 'form' && (
        <form onSubmit={startPayment} noValidate>
          <div className="rounded-2xl bg-bgsoft p-4 mb-5">
            {cartLines.map((l) => (
              <div key={l.productId} className="flex justify-between gap-3 text-sm py-1">
                <span className="text-muted truncate">{l.qty} × {l.product.title}</span>
                <span className="font-medium whitespace-nowrap">{kes(l.product.price * l.qty)}</span>
              </div>
            ))}
            <div className="flex justify-between mt-2 pt-2 border-t border-line font-bold">
              <span>Amount to pay</span><span className="text-amber-500">{kes(subtotal)}</span>
            </div>
          </div>

          <div className="grid gap-4">
            <Field label="Full name" error={errors.name}>
              <input className="input" value={form.name} onChange={set('name')} autoComplete="name" placeholder="e.g. Jane Wanjiku" />
            </Field>
            <Field label="M-Pesa phone number" error={errors.phone} hint={phone ? `STK push will be sent to ${phone.intl}` : 'Format: 07XX XXX XXX or 01XX XXX XXX'}>
              <input className="input" value={form.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" placeholder="07XX XXX XXX" />
            </Field>
            <Field label="Delivery location / area" error={errors.location}>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
                <input className="input pl-9" list="ke-areas" value={form.location} onChange={set('location')} placeholder="e.g. Westlands, Nairobi" />
                <datalist id="ke-areas">{DELIVERY_AREAS.map((a) => <option key={a} value={a} />)}</datalist>
              </div>
            </Field>
            <Field label="Directions / notes (optional)">
              <textarea className="input min-h-[70px]" value={form.notes} onChange={set('notes')} placeholder="Building, landmark, preferred delivery time…" />
            </Field>
          </div>

          <div className="mt-4 flex gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-500">
            <Info className="size-4 shrink-0" />
            Delivery fee is calculated based on your location and confirmed via call/WhatsApp upon order.
          </div>
          {errors.cart && <p className="mt-3 text-sm text-red-500">{errors.cart}</p>}
          <Button type="submit" variant="mpesa" className="mt-5 w-full py-3.5 text-base">
            <Smartphone className="size-5" /> Pay {kes(subtotal)} via M-Pesa
          </Button>
          <p className="mt-2 text-center text-[11px] text-muted flex items-center justify-center gap-1"><Lock className="size-3" /> Secured by Lipa na M-Pesa</p>
        </form>
      )}

      {(step === 'sending' || step === 'pin' || step === 'processing') && (
        <PhoneMock>
          {step === 'sending' && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 px-4">
              <Loader2 className="size-10 animate-spin text-emerald-400" />
              <p className="text-sm font-semibold">Sending STK push…</p>
              <p className="text-xs text-slate-400">Check your phone {phone?.intl}</p>
            </div>
          )}
          {step === 'pin' && (
            <form onSubmit={confirmPin} className="flex flex-col h-full animate-pop-in">
              <div className="rounded-2xl bg-slate-100 text-slate-900 p-4 shadow-xl mt-6">
                <p className="text-[11px] font-bold text-emerald-700 tracking-wide">M-PESA</p>
                <p className="mt-2 text-[13px] leading-snug">
                  Do you want to pay <b>{kes(subtotal)}</b> to <b>FAVO ENTERPRISE</b> Account no. <b>FAVO</b>?
                </p>
                <p className="mt-3 text-[12px] text-slate-600">Enter M-PESA PIN:</p>
                <input
                  autoFocus
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="mt-1 w-full border-b-2 border-emerald-600 bg-transparent py-1 text-center text-2xl tracking-[0.6em] outline-none"
                  aria-label="M-Pesa PIN"
                />
                <div className="mt-4 flex justify-between text-[13px] font-bold">
                  <button type="button" onClick={cancelPin} className="text-slate-500 px-2 py-1">CANCEL</button>
                  <button type="submit" disabled={pin.length !== 4} className="text-emerald-700 px-2 py-1 disabled:opacity-40">SEND</button>
                </div>
              </div>
              <p className="mt-auto mb-2 text-center text-[11px] text-slate-400">Simulation · enter any 4 digits</p>
            </form>
          )}
          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 px-4">
              <Loader2 className="size-10 animate-spin text-emerald-400" />
              <p className="text-sm font-semibold">Processing payment…</p>
              <p className="text-xs text-slate-400">Please wait, do not close this window</p>
            </div>
          )}
        </PhoneMock>
      )}

      {step === 'failed' && (
        <div className="text-center py-6">
          <XCircle className="mx-auto size-14 text-red-500" />
          <p className="mt-3 font-semibold">Payment not completed</p>
          <p className="text-sm text-muted mt-1">{failReason}</p>
          <div className="mt-6 flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={onClose}>Close</Button>
            <Button variant="mpesa" className="flex-1" onClick={() => setStep('form')}>Try again</Button>
          </div>
        </div>
      )}

      {step === 'success' && order && (
        <div className="animate-pop-in">
          <div className="text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-500/15 animate-pulse-ring"><CheckCircle2 className="size-9 text-emerald-500" /></span>
            <p className="mt-3 font-display text-2xl font-bold">{kes(order.total)} paid</p>
            <p className="text-sm text-muted">Thank you, {order.customerName.split(' ')[0]}! Your order has been received.</p>
          </div>
          <div className="mt-5 rounded-2xl border border-dashed border-line p-4 text-sm space-y-2">
            <Row label="M-Pesa code"><span className="font-mono font-bold text-emerald-500 tracking-wider">{order.mpesaCode}</span></Row>
            <Row label="Order number"><span className="font-mono font-bold">{order.id}</span></Row>
            <Row label="Date">{fmtDate(order.createdAt)}</Row>
            <Row label="Deliver to">{order.location}</Row>
            <div className="pt-2 border-t border-line">
              {order.items.map((i) => (
                <Row key={i.productId} label={`${i.qty} × ${i.title}`}>{kes(i.price * i.qty)}</Row>
              ))}
            </div>
          </div>
          <p className="mt-3 text-xs text-muted text-center">We'll call or WhatsApp you on {order.phone} to confirm the delivery fee for {order.location}.</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button variant="ghost" onClick={() => downloadReceipt(order)}><Download className="size-4" /> Receipt</Button>
            <Button onClick={onTrack}><PackageSearch className="size-4" /> Track order</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted truncate">{label}</span>
      <span className="text-right whitespace-nowrap">{children}</span>
    </div>
  );
}

function PhoneMock({ children }) {
  return (
    <div className="flex justify-center py-2">
      <div className="relative w-[250px] h-[440px] rounded-[2.4rem] border-[6px] border-slate-700 bg-slate-950 text-white shadow-2xl overflow-hidden">
        <div className="absolute top-2 left-1/2 -translate-x-1/2 h-5 w-24 rounded-full bg-black" />
        <div className="flex justify-between px-6 pt-2.5 text-[10px] text-slate-400"><span>Safaricom</span><span>100%</span></div>
        <div className="absolute inset-x-0 top-8 bottom-0 px-3 bg-gradient-to-b from-emerald-900/40 to-slate-950">{children}</div>
      </div>
    </div>
  );
}
