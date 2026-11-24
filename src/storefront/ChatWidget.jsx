import { useEffect, useRef, useState } from 'react';
import { LogOut, MessageCircle, MessagesSquare, Send, X } from 'lucide-react';
import { useStore } from '../store/StoreContext.jsx';
import { BRAND } from '../data/seed.js';
import { cx, fmtTime, normalizeKePhone, waLink } from '../lib/utils.js';
import { Button, Field } from '../components/ui.jsx';

export default function ChatWidget({ open, setOpen }) {
  const { customerConversation: conv, chatIdentity, setChatIdentity, sendCustomerMessage, refreshCustomerConversation, markCustomerRead } = useStore();
  const [draft, setDraft] = useState('');
  const [intro, setIntro] = useState({ name: '', phone: '' });
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  const unread = conv?.unreadCustomer || 0;

  // Admin replies arrive by polling: fast while the chat is open, slow for the unread badge.
  useEffect(() => {
    if (!chatIdentity?.token) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refreshCustomerConversation();
    }, open ? 4000 : 30000);
    return () => clearInterval(id);
  }, [open, chatIdentity?.token, refreshCustomerConversation]);

  useEffect(() => {
    if (open && unread) markCustomerRead();
  }, [open, unread, markCustomerRead]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [open, conv?.messages?.length]);

  const startChat = (e) => {
    e.preventDefault();
    const p = normalizeKePhone(intro.phone);
    if (intro.name.trim().length < 2) return setError('Please enter your name.');
    if (!p) return setError('Enter a valid phone number (07XX… / 01XX…).');
    setError('');
    setChatIdentity({ name: intro.name.trim(), phone: p.local, token: null });
  };

  const send = async (e) => {
    e.preventDefault();
    if (!draft.trim() || !chatIdentity || sending) return;
    const text = draft;
    setSending(true);
    setDraft('');
    const res = await sendCustomerMessage({ name: chatIdentity.name, phone: chatIdentity.phone, text });
    setSending(false);
    if (res.error) { setError(res.error); setDraft(text); }
    else setError('');
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-amber-500 pl-4 pr-5 py-3.5 font-semibold text-slate-950 shadow-2xl shadow-amber-500/30 transition hover:scale-105 active:scale-95 mb-[env(safe-area-inset-bottom)]"
          aria-label="Chat with Favo Admin"
        >
          <MessagesSquare className="size-5" />
          <span className="hidden sm:inline">Chat with Favo</span>
          {unread > 0 && <span className="absolute -top-1 -right-1 grid size-6 place-items-center rounded-full bg-red-500 text-xs font-bold text-white ring-2 ring-bg">{unread}</span>}
        </button>
      )}

      {open && (
        <div className="fixed z-[60] inset-0 sm:inset-auto sm:bottom-5 sm:right-5 sm:w-[380px] sm:h-[560px] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col bg-card sm:rounded-3xl border border-line shadow-2xl overflow-hidden animate-slide-up sm:animate-pop-in">
          <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950">
            <span className="relative grid size-10 place-items-center rounded-full bg-slate-950/15 font-display font-bold">F<span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-amber-500" /></span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold leading-tight">Chat with Favo Admin</p>
              <p className="text-xs opacity-75">Typically replies within the hour · {BRAND.hours}</p>
            </div>
            {chatIdentity && (
              <button onClick={() => setChatIdentity(null)} className="p-2 rounded-full hover:bg-slate-950/10" title="Switch account" aria-label="End chat session"><LogOut className="size-4" /></button>
            )}
            <button onClick={() => setOpen(false)} className="p-2 rounded-full hover:bg-slate-950/10" aria-label="Close chat"><X className="size-5" /></button>
          </div>

          {!chatIdentity ? (
            <form onSubmit={startChat} className="flex-1 p-5 flex flex-col gap-4 overflow-y-auto">
              <div className="rounded-2xl bg-bgsoft p-4 text-sm">
                👋 Hi! Welcome to <b>{BRAND.name}</b>. Ask about prices, availability, delivery or custom imports — we'll reply right here.
              </div>
              <Field label="Your name"><input className="input" value={intro.name} onChange={(e) => setIntro((i) => ({ ...i, name: e.target.value }))} /></Field>
              <Field label="Phone number"><input className="input" inputMode="tel" placeholder="07XX XXX XXX" value={intro.phone} onChange={(e) => setIntro((i) => ({ ...i, phone: e.target.value }))} /></Field>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full">Start chat</Button>
              <WhatsAppLink />
            </form>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-bgsoft/40">
                <Bubble from="admin" text={`Hi ${chatIdentity.name.split(' ')[0]} 👋 How can we help you today?`} />
                {conv?.messages?.map((m) => <Bubble key={m.id} from={m.from} text={m.text} ts={m.ts} kind={m.kind} />)}
                <div ref={endRef} />
              </div>
              <div className="border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
                <form onSubmit={send} className="flex gap-2">
                  <input className="input rounded-full" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type your message…" aria-label="Message" />
                  <button type="submit" disabled={!draft.trim() || sending} className="grid size-11 shrink-0 place-items-center rounded-full bg-amber-500 text-slate-950 transition hover:bg-amber-400 active:scale-90 disabled:opacity-40" aria-label="Send">
                    <Send className="size-4" />
                  </button>
                </form>
                <WhatsAppLink className="mt-2" />
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

function WhatsAppLink({ className }) {
  return (
    <a href={waLink('Hi Favo Enterprise 👋')} target="_blank" rel="noreferrer" className={cx('flex items-center justify-center gap-2 text-xs font-semibold text-emerald-500 hover:underline', className)}>
      <MessageCircle className="size-3.5" /> Continue on WhatsApp {BRAND.whatsappDisplay}
    </a>
  );
}

function Bubble({ from, text, ts, kind }) {
  const mine = from === 'customer';
  return (
    <div className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
      <div className={cx('max-w-[82%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words shadow-sm', mine ? 'bg-amber-500 text-slate-950 rounded-br-md' : 'bg-card border border-line rounded-bl-md', kind === 'import' && 'ring-2 ring-violet-500/40')}>
        {text}
        {ts && <span className={cx('block text-[10px] mt-1 text-right', mine ? 'text-slate-900/60' : 'text-muted')}>{fmtTime(ts)}</span>}
      </div>
    </div>
  );
}
