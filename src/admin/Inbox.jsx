import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Inbox as InboxIcon, MessageCircle, Phone, Send, Trash2 } from 'lucide-react';
import { useStore } from '../store/StoreContext.jsx';
import { Badge, PageHeader } from '../components/ui.jsx';
import { cx, fmtDate, fmtTime, waLinkTo } from '../lib/utils.js';

export default function Inbox() {
  const { conversations, sendAdminReply, markAdminRead, deleteConversation } = useStore();
  const [activeId, setActiveId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  const active = conversations.find((c) => c.id === activeId) || null;
  const unreadTotal = conversations.reduce((s, c) => s + (c.unreadAdmin || 0), 0);
  const hasImport = (c) => c.messages.some((m) => m.kind === 'import');

  const list = conversations
    .filter((c) => filter === 'all' || (filter === 'unread' ? c.unreadAdmin > 0 : hasImport(c)))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  useEffect(() => {
    if (active?.unreadAdmin) markAdminRead(active.id);
  }, [active?.id, active?.unreadAdmin, markAdminRead]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [activeId, active?.messages.length]);

  const send = async (e) => {
    e.preventDefault();
    if (!active || !draft.trim() || sending) return;
    const text = draft;
    setSending(true);
    setDraft('');
    const res = await sendAdminReply(active.id, text);
    setSending(false);
    if (res.error) { setError(res.error); setDraft(text); }
    else setError('');
  };

  const remove = () => {
    if (active && window.confirm(`Delete the conversation with ${active.name}?`)) {
      deleteConversation(active.id).then((res) => { if (res.error) setError(res.error); });
      setActiveId(null);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Customer Inbox" subtitle={`${conversations.length} conversation${conversations.length === 1 ? '' : 's'} · ${unreadTotal} unread`} />

      <div className="glass rounded-3xl overflow-hidden grid md:grid-cols-[320px_1fr] h-[calc(100dvh-14rem)] min-h-[460px]">
        {/* List */}
        <div className={cx('border-r border-line flex flex-col min-h-0', active && 'hidden md:flex')}>
          <div className="flex gap-1 p-3 border-b border-line">
            {[['all', 'All'], ['unread', 'Unread'], ['import', 'Imports']].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={cx('flex-1 rounded-lg py-1.5 text-xs font-semibold', filter === k ? 'bg-amber-500 text-slate-950' : 'text-muted hover:bg-bgsoft')}>{l}</button>
            ))}
          </div>
          <ul className="flex-1 overflow-y-auto">
            {list.length === 0 && (
              <li className="p-8 text-center text-sm text-muted"><InboxIcon className="mx-auto size-8 mb-2" />No messages yet.</li>
            )}
            {list.map((c) => {
              const last = c.messages[c.messages.length - 1];
              return (
                <li key={c.id}>
                  <button onClick={() => setActiveId(c.id)} className={cx('w-full text-left px-4 py-3 border-b border-line flex gap-3 transition', activeId === c.id ? 'bg-amber-500/10' : 'hover:bg-bgsoft/60')}>
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-bold">{c.name.charAt(0).toUpperCase() || '?'}</span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center justify-between gap-2">
                        <span className={cx('truncate', c.unreadAdmin ? 'font-bold' : 'font-medium')}>{c.name}</span>
                        <span className="text-[10px] text-muted shrink-0">{last ? fmtTime(last.ts) : ''}</span>
                      </span>
                      <span className="flex items-center gap-2 mt-0.5">
                        <span className={cx('text-xs truncate flex-1', c.unreadAdmin ? 'text-fg' : 'text-muted')}>{last ? `${last.from === 'admin' ? 'You: ' : ''}${last.text.replace(/\n/g, ' ')}` : ''}</span>
                        {c.unreadAdmin > 0 && <span className="grid min-w-5 h-5 px-1 place-items-center rounded-full bg-red-500 text-white text-[10px] font-bold">{c.unreadAdmin}</span>}
                      </span>
                      {hasImport(c) && <Badge tone="violet" className="mt-1">Import request</Badge>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Thread */}
        <div className={cx('flex flex-col min-h-0', !active && 'hidden md:flex')}>
          {!active ? (
            <div className="flex-1 grid place-items-center text-muted text-sm p-8 text-center">
              <div><InboxIcon className="mx-auto size-10 mb-3" />Select a conversation to read and reply.</div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
                <button onClick={() => setActiveId(null)} className="md:hidden p-1.5 -ml-1.5" aria-label="Back"><ArrowLeft className="size-5" /></button>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{active.name}</p>
                  <a href={`tel:${active.phone}`} className="text-xs text-muted flex items-center gap-1 hover:text-amber-500"><Phone className="size-3" />{active.phone}</a>
                </div>
                <a href={waLinkTo(active.phone, `Hi ${active.name.split(' ')[0]} 👋, this is Favo Enterprise.`)} target="_blank" rel="noreferrer" className="p-2 rounded-lg text-emerald-500 hover:bg-emerald-500/10" title="Open WhatsApp" aria-label="Reply on WhatsApp"><MessageCircle className="size-5" /></a>
                <button onClick={remove} className="p-2 rounded-lg text-muted hover:text-red-500 hover:bg-red-500/10" aria-label="Delete conversation"><Trash2 className="size-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-bgsoft/30">
                {active.messages.map((m) => {
                  const mine = m.from === 'admin';
                  return (
                    <div key={m.id} className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
                      <div className={cx('max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words', mine ? 'bg-amber-500 text-slate-950 rounded-br-md' : 'bg-card border border-line rounded-bl-md', m.kind === 'import' && 'ring-2 ring-violet-500/40')}>
                        {m.text}
                        <span className={cx('block text-[10px] mt-1 text-right', mine ? 'text-slate-900/60' : 'text-muted')}>{fmtDate(m.ts)}</span>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>
              {error && <p className="px-4 pt-2 text-xs text-red-500" role="alert">{error}</p>}
              <form onSubmit={send} className="flex gap-2 p-3 border-t border-line">
                <input className="input rounded-full" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Reply to ${active.name}…`} aria-label="Reply" />
                <button type="submit" disabled={!draft.trim() || sending} className="grid size-11 shrink-0 place-items-center rounded-full bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-90 disabled:opacity-40" aria-label="Send reply"><Send className="size-4" /></button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
