import { useEffect, useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, Copy, Download, Info, Loader2, MapPin, MessageCircle, PackageSearch, Smartphone } from 'lucide-react';
import { useStore } from '../store/StoreContext.jsx';
import { Button, Field, Modal } from '../components/ui.jsx';
import { BRAND, DELIVERY_AREAS } from '../data/seed.js';
import { cx, downloadReceipt, extractMpesaCode, fmtDate, kes, normalizeKePhone, waLink } from '../lib/utils.js';

const EMPTY = { name: '', phone: '', location: '', notes: '' };

export default function Checkout({ open, onClose, onTrack }) {
  const { cartLines, placeOrder, chatIdentity } = useStore();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState('form'); // form | pay | success
  const [codeInput, setCodeInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState(null);

  const subtotal = cartLines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const phone = normalizeKePhone(form.phone);
  const code = extractMpesaCode(codeInput);

  useEffect(() => {
    if (!open) return;
    setStep('form');
    setOrder(null);
    setErrors({});
    setCodeInput('');
    setForm((f) => ({ ...f, name: f.name || chatIdentity?.name || '', phone: f.phone || chatIdentity?.phone || '' }));
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

  const toPayment = (e) => {
    e.preventDefault();
    if (validate()) { setErrors({}); setStep('pay'); }
  };

  const submitCode = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!code) { setErrors({ code: 'Enter the 10-character code from your M-Pesa SMS, e.g. TKL7H2J9QX.' }); return; }
    setSubmitting(true);
    const res = await placeOrder({ customerName: form.name, phone: phone.local, location: form.location, notes: form.notes, mpesaCode: code });
    setSubmitting(false);
    if (res.error) { setErrors({ code: res.error }); return; }
    setOrder(res.order);
    setStep('success');
    setForm((f) => ({ ...f, notes: '' }));
  };

  const title = step === 'success' ? 'Order Placed' : step === 'pay' ? 'Pay with M-Pesa' : 'Checkout';

  return (
    <Modal open={open} onClose={onClose} title={title} size="md" hideClose={submitting}>
      {step === 'form' && (
        <form onSubmit={toPayment} noValidate>
          <Steps current={0} />
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
            <Field label="M-Pesa phone number" error={errors.phone} hint="The number you'll pay from, so we can match your payment.">
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

          <div className="mt-4 flex gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            <Info className="size-4 shrink-0" />
            Delivery fee is calculated based on your location and confirmed via call/WhatsApp after you order.
          </div>
          {errors.cart && <p className="mt-3 text-sm text-red-500">{errors.cart}</p>}
          <Button type="submit" variant="mpesa" className="mt-5 w-full py-3.5 text-base">
            <Smartphone className="size-5" /> Continue to M-Pesa payment
          </Button>
        </form>
      )}

      {step === 'pay' && (
        <form onSubmit={submitCode} noValidate className="animate-fade-in">
          <Steps current={1} />
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Send exactly</p>
            <p className="font-display text-3xl font-bold">{kes(subtotal)}</p>
            <p className="mt-1 text-sm text-muted">to {BRAND.name}{BRAND.mpesaName ? ` (${BRAND.mpesaName})` : ''}</p>
          </div>

          <ol className="mt-5 space-y-3 text-sm">
            <PayStep n={1}>Open <b>M-PESA</b> on your phone and choose <b>Send Money</b>.</PayStep>
            <PayStep n={2} row>
              <span>Enter phone number</span>
              <CopyChip value={BRAND.mpesaNumber} label={BRAND.mpesaDisplay} />
            </PayStep>
            <PayStep n={3} row>
              <span>Enter amount</span>
              <CopyChip value={String(subtotal)} label={kes(subtotal)} />
            </PayStep>
            <PayStep n={4}>
              {BRAND.mpesaName
                ? <>Check the name shows as <b>{BRAND.mpesaName}</b>, then enter your PIN and send.</>
                : <>Enter your M-Pesa PIN and send.</>}
            </PayStep>
            <PayStep n={5}>You'll get an SMS from M-PESA. Enter the code from that SMS below.</PayStep>
          </ol>

          <Field
            className="mt-5"
            label="M-Pesa confirmation code"
            error={errors.code}
            hint={code && codeInput.trim().toUpperCase() !== code ? `Found code: ${code}` : 'You can paste the whole M-Pesa SMS. We\'ll find the code.'}
          >
            <input
              className="input font-mono uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal"
              value={codeInput}
              onChange={(e) => { setCodeInput(e.target.value); if (errors.code) setErrors({}); }}
              placeholder="e.g. TKL7H2J9QX"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-label="M-Pesa confirmation code"
            />
          </Field>

          <div className="mt-5 grid grid-cols-[auto_1fr] gap-3">
            <Button type="button" variant="ghost" onClick={() => setStep('form')} disabled={submitting} aria-label="Back to details"><ArrowLeft className="size-4" /></Button>
            <Button type="submit" variant="mpesa" className="py-3.5 text-base" disabled={submitting}>
              {submitting ? <><Loader2 className="size-5 animate-spin" /> Placing order…</> : <><Check className="size-5" /> I've paid, place my order</>}
            </Button>
          </div>
          <p className="mt-3 text-center text-[11px] text-muted">
            Haven't paid yet? Your cart is saved. Pay first, then come back and enter the code.
          </p>
        </form>
      )}

      {step === 'success' && order && (
        <div className="animate-pop-in">
          <div className="text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-500/15 animate-pulse-ring"><CheckCircle2 className="size-9 text-emerald-500" /></span>
            <p className="mt-3 font-display text-2xl font-bold">Order received!</p>
            <p className="text-sm text-muted">Thank you, {order.customerName.split(' ')[0]}. We're confirming your M-Pesa payment now.</p>
          </div>
          <div className="mt-5 rounded-2xl border border-dashed border-line p-4 text-sm space-y-2">
            <Row label="Order number"><span className="font-mono font-bold">{order.id}</span></Row>
            <Row label="M-Pesa code"><span className="font-mono font-bold text-emerald-500 tracking-wider">{order.mpesaCode}</span></Row>
            <Row label="Payment"><span className="font-semibold text-amber-600 dark:text-amber-400">Being confirmed</span></Row>
            <Row label="Date">{fmtDate(order.createdAt)}</Row>
            <Row label="Deliver to">{order.location}</Row>
            <div className="pt-2 border-t border-line">
              {order.items.map((i) => (
                <Row key={i.productId} label={`${i.qty} × ${i.title}`}>{kes(i.price * i.qty)}</Row>
              ))}
              <Row label={<b className="text-fg">Total</b>}><b>{kes(order.total)}</b></Row>
            </div>
          </div>

          <a
            href={waLink([
              `Hi ${BRAND.name} 👋 I've paid for my order.`,
              `🧾 Order: ${order.id}`,
              `💳 M-Pesa code: ${order.mpesaCode}`,
              `💰 Amount: ${kes(order.total)}`,
              `📍 Deliver to: ${order.location}`,
            ].join('\n'))}
            target="_blank"
            rel="noreferrer"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 active:scale-[0.97]"
          >
            <MessageCircle className="size-4" /> Send payment details on WhatsApp
          </a>
          <p className="mt-2 text-xs text-muted text-center">Optional, but it helps us confirm faster. We'll then call or WhatsApp {order.phone} with the delivery fee.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button variant="ghost" onClick={() => downloadReceipt(order)}><Download className="size-4" /> Receipt</Button>
            <Button onClick={onTrack}><PackageSearch className="size-4" /> Track order</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Steps({ current }) {
  const labels = ['Your details', 'Pay & confirm'];
  return (
    <div className="mb-5 flex items-center gap-2 text-xs font-semibold">
      {labels.map((l, i) => (
        <div key={l} className="flex flex-1 items-center gap-2">
          <span className={cx('grid size-6 shrink-0 place-items-center rounded-full', i <= current ? 'bg-emerald-500 text-white' : 'bg-bgsoft text-muted')}>
            {i < current ? <Check className="size-3.5" /> : i + 1}
          </span>
          <span className={i <= current ? 'text-fg' : 'text-muted'}>{l}</span>
          {i < labels.length - 1 && <span className={cx('h-px flex-1', i < current ? 'bg-emerald-500' : 'bg-line')} />}
        </div>
      ))}
    </div>
  );
}

function PayStep({ n, row = false, children }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-bgsoft text-xs font-bold">{n}</span>
      <div className={cx('flex-1 pt-0.5', row && 'flex flex-wrap items-center justify-between gap-2')}>{children}</div>
    </li>
  );
}

function CopyChip({ value, label }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked: the value is still visible */ }
  };
  return (
    <button type="button" onClick={copy} className="inline-flex items-center gap-2 rounded-lg border border-line bg-bgsoft px-3 py-1.5 font-mono text-sm font-bold transition hover:border-emerald-500/60" aria-label={`Copy ${label}`}>
      {label}
      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5 text-muted" />}
    </button>
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
