import { useEffect, useMemo, useState } from 'react';
import { Boxes, Building2, Megaphone, MoreHorizontal, Package, Pencil, Plus, Trash2, Truck, Users, Wallet, Zap } from 'lucide-react';
import { useStore } from '../store/StoreContext.jsx';
import { Button, Field, Modal } from '../components/ui.jsx';
import { cx, kes } from '../lib/utils.js';

export const EXPENSE_CATEGORIES = [
  { key: 'stock', label: 'Stock / products bought', icon: Boxes, hint: 'Not taken off profit again: product cost is counted when items sell.' },
  { key: 'transport', label: 'Transport & delivery', icon: Truck },
  { key: 'rent', label: 'Rent', icon: Building2 },
  { key: 'packaging', label: 'Packaging', icon: Package },
  { key: 'marketing', label: 'Marketing & ads', icon: Megaphone },
  { key: 'salaries', label: 'Salaries & wages', icon: Users },
  { key: 'utilities', label: 'Airtime, internet & bills', icon: Zap },
  { key: 'other', label: 'Other', icon: MoreHorizontal },
];
const catOf = (key) => EXPENSE_CATEGORIES.find((c) => c.key === key) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtDay = (s) => new Date(`${s}T12:00:00`).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });

/** Expenses for the month chosen on the Financials page: breakdown, list, add / edit / delete. */
export default function ExpensesPanel({ list, periodName, notify }) {
  const { expensesError, deleteExpense } = useStore();
  const [editing, setEditing] = useState(null); // null = closed, {} = new, expense = edit
  const total = list.reduce((s, e) => s + e.amount, 0);

  const byCat = useMemo(() => {
    const m = new Map();
    for (const e of list) m.set(e.category, (m.get(e.category) || 0) + e.amount);
    return [...m.entries()].map(([key, value]) => ({ ...catOf(key), value })).sort((a, b) => b.value - a.value);
  }, [list]);
  const maxCat = Math.max(1, ...byCat.map((c) => c.value));

  const remove = async (e) => {
    if (!window.confirm(`Delete this expense of ${kes(e.amount)}?`)) return;
    const res = await deleteExpense(e.id);
    notify?.(res.error || 'Expense deleted');
  };

  return (
    <>
    <div className="mt-6 glass rounded-3xl overflow-hidden">
      <div className="p-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Expenses · {periodName}</p>
          <p className="text-xs text-muted">Money spent on transport, rent, packaging and more is taken off your profit. Stock you buy is listed here too, but its cost is counted through the cost price of each product when it sells.</p>
        </div>
        <Button onClick={() => setEditing({})} disabled={!!expensesError}><Plus className="size-4" /> Add expense</Button>
      </div>

      {expensesError ? (
        <p className="mx-5 mb-5 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">{expensesError}</p>
      ) : (
        <div className="grid lg:grid-cols-5 border-t border-line">
          <div className="lg:col-span-2 p-5 lg:border-r border-line">
            <p className="text-xs text-muted">Total spent</p>
            <p className="font-display text-2xl font-bold text-red-500">{kes(total)}</p>
            <div className="mt-4 space-y-3">
              {byCat.length === 0 && <p className="text-sm text-muted">No expenses recorded for {periodName}.</p>}
              {byCat.map((c) => (
                <div key={c.key}>
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5 truncate"><c.icon className="size-3.5 text-muted" />{c.label}</span>
                    <span className="font-semibold whitespace-nowrap">{kes(c.value)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-bgsoft overflow-hidden">
                    <div className="h-full rounded-full bg-red-500/70" style={{ width: `${(c.value / maxCat) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3 overflow-x-auto border-t lg:border-t-0 border-line">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-line bg-bgsoft/50">
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-3 py-3 font-semibold">What for</th>
                  <th className="px-3 py-3 font-semibold text-right">Amount</th>
                  <th className="px-5 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {list.map((e) => {
                  const c = catOf(e.category);
                  return (
                    <tr key={e.id} className="border-b border-line last:border-0 hover:bg-bgsoft/40">
                      <td className="px-5 py-3 whitespace-nowrap text-muted">{fmtDay(e.spentOn)}</td>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-1.5 font-medium"><c.icon className="size-3.5 text-muted" />{c.label}</span>
                        {e.note && <span className="block text-xs text-muted">{e.note}</span>}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold whitespace-nowrap text-red-500">− {kes(e.amount)}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => setEditing(e)} className="rounded-lg p-2 text-muted hover:bg-bgsoft hover:text-fg" aria-label="Edit expense"><Pencil className="size-4" /></button>
                          <button onClick={() => remove(e)} className="rounded-lg p-2 text-muted hover:bg-red-500/10 hover:text-red-500" aria-label="Delete expense"><Trash2 className="size-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {list.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-muted"><Wallet className="mx-auto mb-2 size-8 opacity-60" />Tap “Add expense” to record money you spent.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    {/* Rendered outside the blurred card so the modal covers the whole screen. */}
    <ExpenseForm expense={editing} onClose={() => setEditing(null)} notify={notify} />
    </>
  );
}

function ExpenseForm({ expense, onClose, notify }) {
  const { saveExpense } = useStore();
  const open = !!expense;
  const [form, setForm] = useState({ amount: '', category: 'transport', spentOn: todayStr(), note: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!expense) return;
    setError('');
    setForm(expense.id
      ? { amount: String(expense.amount), category: expense.category, spentOn: expense.spentOn, note: expense.note }
      : { amount: '', category: 'transport', spentOn: todayStr(), note: '' });
  }, [expense]);

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const amount = Number(form.amount);
    if (!(amount > 0)) return setError('Enter how much you spent.');
    if (!form.spentOn) return setError('Choose the date.');
    setSaving(true);
    const res = await saveExpense({ id: expense.id, ...form, amount });
    setSaving(false);
    if (res.error) return setError(res.error);
    notify?.(expense.id ? 'Expense updated' : `Expense of ${kes(amount)} added`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={expense?.id ? 'Edit expense' : 'Add an expense'} size="md" hideClose={saving}>
      <form onSubmit={submit} noValidate className="grid gap-4">
        <Field label="Amount spent (KES)">
          <input className="input text-lg font-semibold" type="number" min="1" inputMode="numeric" value={form.amount} onChange={(e) => { setError(''); setForm((f) => ({ ...f, amount: e.target.value })); }} placeholder="e.g. 500" autoFocus />
        </Field>
        <div>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">What was it for?</span>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Expense category">
            {EXPENSE_CATEGORIES.map((c) => (
              <button
                type="button"
                key={c.key}
                role="radio"
                aria-checked={form.category === c.key}
                onClick={() => setForm((f) => ({ ...f, category: c.key }))}
                className={cx('flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition', form.category === c.key ? 'border-amber-500 bg-amber-500/15 text-fg' : 'border-line text-muted hover:text-fg')}
              >
                <c.icon className="size-4 shrink-0" /> <span className="truncate">{c.label}</span>
              </button>
            ))}
          </div>
          {catOf(form.category).hint && <p className="mt-2 text-xs text-muted">{catOf(form.category).hint}</p>}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Date"><input className="input" type="date" value={form.spentOn} max={todayStr()} onChange={(e) => setForm((f) => ({ ...f, spentOn: e.target.value }))} /></Field>
          <Field label="Note (optional)"><input className="input" value={form.note} maxLength={300} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="e.g. Boda to town" /></Field>
        </div>
        {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
        <div className="grid grid-cols-[auto_1fr] gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" className="py-3" disabled={saving}>{saving ? 'Saving…' : expense?.id ? 'Save changes' : 'Add expense'}</Button>
        </div>
      </form>
    </Modal>
  );
}
