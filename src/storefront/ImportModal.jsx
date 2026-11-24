import { useEffect, useState } from 'react';
import { CheckCircle2, Globe2, MessageCircle, MessagesSquare, Send } from 'lucide-react';
import { useStore } from '../store/StoreContext.jsx';
import { Button, Field, Modal } from '../components/ui.jsx';
import { normalizeKePhone, waLink } from '../lib/utils.js';


export default function ImportModal({ open, onClose, notify, onOpenChat }) {
  const { sendCustomerMessage, chatIdentity } = useStore();
  const [form, setForm] = useState({ name: '', phone: '', item: '', link: '', budget: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [sentText, setSentText] = useState(null);

  useEffect(() => {
    if (open) {
      setSentText(null);
      setErrors({});
      setForm((f) => ({ ...f, name: f.name || chatIdentity?.name || '', phone: f.phone || chatIdentity?.phone || '' }));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const errs = {};
    if (form.name.trim().length < 2) errs.name = 'Enter your name.';
    if (!normalizeKePhone(form.phone)) errs.phone = 'Enter a valid number (07XX… / 01XX…).';
    if (form.item.trim().length < 2) errs.item = 'Tell us what you want imported.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const text = [
      '📦 IMPORT REQUEST',
      `Item: ${form.item.trim()}`,
      form.link.trim() && `Link: ${form.link.trim()}`,
      form.budget && `Budget: KES ${Number(form.budget).toLocaleString('en-KE')}`,
      form.notes.trim() && `Notes: ${form.notes.trim()}`,
    ].filter(Boolean).join('\n');

    setBusy(true);
    const res = await sendCustomerMessage({ name: form.name, phone: form.phone, text, kind: 'import' });
    setBusy(false);
    if (res.error) { setErrors({ submit: res.error }); return; }
    setSentText(text);
    setForm((f) => ({ ...f, item: '', link: '', budget: '', notes: '' }));
    notify('Import request sent to Favo Enterprise');
  };

  return (
    <Modal open={open} onClose={onClose} title="Request Custom Import" size="md">
      {sentText ? (
        <div className="text-center py-4 animate-pop-in">
          <CheckCircle2 className="mx-auto size-14 text-emerald-500" />
          <p className="mt-3 font-display text-xl font-bold">Request received!</p>
          <p className="text-sm text-muted mt-1">Our team will reply with a quote in the website chat. For a faster response, continue on WhatsApp.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Button variant="ghost" onClick={onOpenChat}><MessagesSquare className="size-4" /> Open chat</Button>
            <a href={waLink(`Hi Favo Enterprise 👋\n${sentText}`)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400">
              <MessageCircle className="size-4" /> Continue on WhatsApp
            </a>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="grid gap-4">
          <div className="flex gap-3 rounded-2xl bg-amber-500/10 p-3 text-sm">
            <Globe2 className="size-5 shrink-0 text-amber-500" />
            <p className="text-muted">We source quality products for you. Typical lead time: <b className="text-fg">7–21 days</b>. Get a full landed-cost quote — no commitment.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Your name" error={errors.name}><input className="input" value={form.name} onChange={set('name')} /></Field>
            <Field label="Phone / WhatsApp" error={errors.phone}><input className="input" inputMode="tel" placeholder="07XX XXX XXX" value={form.phone} onChange={set('phone')} /></Field>
          </div>
          <Field label="What do you want imported?" error={errors.item}>
            <input className="input" placeholder="e.g. Mini camera, black" value={form.item} onChange={set('item')} />
          </Field>
          <Field label="Product link (optional)"><input className="input" type="url" placeholder="https://…" value={form.link} onChange={set('link')} /></Field>
          <Field label="Budget (KES, optional)"><input className="input" type="number" min="0" inputMode="numeric" value={form.budget} onChange={set('budget')} /></Field>
          <Field label="Extra details (optional)"><textarea className="input min-h-[70px]" value={form.notes} onChange={set('notes')} placeholder="Colour, size, quantity, deadline…" /></Field>
          {errors.submit && <p className="text-sm text-red-500" role="alert">{errors.submit}</p>}
          <Button type="submit" className="w-full py-3" disabled={busy}><Send className="size-4" /> {busy ? 'Sending…' : 'Send import request'}</Button>
        </form>
      )}
    </Modal>
  );
}
