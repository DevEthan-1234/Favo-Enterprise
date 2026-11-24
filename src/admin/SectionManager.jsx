import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, LayoutList, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useStore } from '../store/StoreContext.jsx';
import { Button, PageHeader } from '../components/ui.jsx';

const SUGGESTIONS = ['Smart Home', 'Solar & Power', 'Cameras & Drones', 'TVs & Displays', 'Networking'];

export default function SectionManager({ notify }) {
  const { sections, products, addSection, renameSection, moveSection, deleteSection } = useStore();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const add = async (value) => {
    const res = await addSection(value);
    if (res.error) return setError(res.error);
    setError('');
    setName('');
    notify(`“${value.trim()}” added to the storefront`);
  };

  const commitRename = async (id) => {
    setEditingId(null);
    if (!editName.trim()) return;
    const res = await renameSection(id, editName);
    notify(res.error || 'Section renamed');
  };

  const move = async (id, dir) => {
    const res = await moveSection(id, dir);
    if (res.error) notify(res.error);
  };

  const remove = (s) => {
    const count = products.filter((p) => p.sectionId === s.id).length;
    const target = sections.find((x) => x.id !== s.id);
    const msg = count
      ? `Delete “${s.name}”? Its ${count} product(s) will be moved to “${target.name}”.`
      : `Delete “${s.name}”?`;
    if (window.confirm(msg)) {
      deleteSection(s.id).then((res) => notify(res.error || 'Section deleted'));
    }
  };

  const unused = SUGGESTIONS.filter((s) => !sections.some((x) => x.name.toLowerCase() === s.toLowerCase()));

  return (
    <div className="animate-fade-in max-w-3xl">
      <PageHeader title="Storefront Sections" subtitle="Sections become filter tabs and product rows on the storefront, in this order." />

      <form onSubmit={(e) => { e.preventDefault(); add(name); }} className="glass rounded-3xl p-5">
        <p className="font-semibold mb-3">Create a new section</p>
        <div className="flex gap-2">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Smart Home" />
          <Button type="submit" disabled={!name.trim()}><Plus className="size-4" /> Add</Button>
        </div>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        {unused.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {unused.map((s) => (
              <button type="button" key={s} onClick={() => add(s)} className="rounded-full border border-dashed border-line px-3 py-1 text-xs text-muted hover:border-amber-500 hover:text-amber-500">+ {s}</button>
            ))}
          </div>
        )}
      </form>

      <ul className="mt-5 space-y-2">
        {sections.map((s, i) => {
          const count = products.filter((p) => p.sectionId === s.id).length;
          return (
            <li key={s.id} className="glass rounded-2xl p-3 sm:p-4 flex items-center gap-3 animate-fade-in">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-500 font-bold text-sm">{i + 1}</span>
              {editingId === s.id ? (
                <form onSubmit={(e) => { e.preventDefault(); commitRename(s.id); }} className="flex-1 flex gap-2">
                  <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                  <button type="submit" className="p-2 text-emerald-500" aria-label="Save name"><Check className="size-5" /></button>
                  <button type="button" onClick={() => setEditingId(null)} className="p-2 text-muted" aria-label="Cancel"><X className="size-5" /></button>
                </form>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{s.name}</p>
                    <p className="text-xs text-muted">{count} product{count === 1 ? '' : 's'}</p>
                  </div>
                  <div className="flex items-center">
                    <IconBtn label="Move up" onClick={() => move(s.id, -1)} disabled={i === 0}><ArrowUp className="size-4" /></IconBtn>
                    <IconBtn label="Move down" onClick={() => move(s.id, 1)} disabled={i === sections.length - 1}><ArrowDown className="size-4" /></IconBtn>
                    <IconBtn label="Rename" onClick={() => { setEditingId(s.id); setEditName(s.name); }}><Pencil className="size-4" /></IconBtn>
                    <IconBtn label="Delete" danger onClick={() => remove(s)} disabled={sections.length <= 1}><Trash2 className="size-4" /></IconBtn>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {sections.length <= 1 && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted"><LayoutList className="size-3.5" /> The store needs at least one section.</p>
      )}
    </div>
  );
}

function IconBtn({ children, label, danger, ...props }) {
  return (
    <button {...props} aria-label={label} title={label} className={`p-2 rounded-lg text-muted transition disabled:opacity-25 ${danger ? 'hover:text-red-500 hover:bg-red-500/10' : 'hover:text-amber-500 hover:bg-amber-500/10'}`}>
      {children}
    </button>
  );
}
