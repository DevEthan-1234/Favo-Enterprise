import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, Link2, Loader2, Save, Star, X } from 'lucide-react';
import { useStore } from '../store/StoreContext.jsx';
import { Button, Field, Modal, SafeImage } from '../components/ui.jsx';
import { CONDITIONS, PRESET_IMAGES } from '../data/seed.js';
import { cx, kes } from '../lib/utils.js';

const MAX_PHOTOS = 8;

const CONDITION_LABELS = {
  'Brand New': 'Brand New',
  'Ex-UK / Refurbished': 'Refurbished (Ex-UK)',
  'Pre-Order / Import': 'Import on Order (Pre-Order)',
};

const blank = (sectionId) => ({
  title: '', brand: '', sectionId, price: '', costPrice: '', stock: '', condition: CONDITIONS[0],
  images: [], specs: '', description: '', warranty: '',
});

/** Ordered photo list: first photo is the cover. Upload from device, paste a link, or pick a preset. */
function PhotoManager({ images, onChange, error, onBusyChange }) {
  const { uploadProductImage } = useStore();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(0);
  useEffect(() => onBusyChange(uploading > 0), [uploading, onBusyChange]);
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState('');
  const room = MAX_PHOTOS - images.length - uploading;

  const add = (list) => onChange((prev) => [...prev, ...list.filter((u) => !prev.includes(u))].slice(0, MAX_PHOTOS));
  const remove = (i) => onChange((prev) => prev.filter((_, j) => j !== i));
  const move = (i, d) => onChange((prev) => {
    const next = [...prev];
    const j = i + d;
    if (j < 0 || j >= next.length) return prev;
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const makeCover = (i) => onChange((prev) => [prev[i], ...prev.filter((_, j) => j !== i)]);

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setMsg('');
    const take = files.slice(0, Math.max(0, room));
    if (take.length < files.length) setMsg(`Only ${MAX_PHOTOS} photos per product, so ${files.length - take.length} were skipped.`);
    setUploading((n) => n + take.length);
    await Promise.all(take.map(async (file) => {
      const res = await uploadProductImage(file);
      setUploading((n) => n - 1);
      if (res.error) setMsg(res.error);
      else add([res.data]);
    }));
  };

  const addUrl = () => {
    const u = url.trim();
    if (!/^https?:\/\/\S+$/i.test(u)) { setMsg('Paste a full image link starting with https://'); return; }
    if (room <= 0) { setMsg(`Maximum ${MAX_PHOTOS} photos.`); return; }
    add([u]);
    setUrl('');
    setMsg('');
  };

  const arrow = 'grid size-7 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80 disabled:opacity-30';

  return (
    <div className="grid gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Product photos</span>
        <span className="text-xs text-muted">{images.length}/{MAX_PHOTOS}</span>
      </div>

      {images.length > 0 ? (
        <div className="relative">
          <SafeImage src={images[0]} alt="Cover photo" className="aspect-square w-full rounded-2xl border border-line" />
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold text-slate-950">
            <Star className="size-3" /> Cover
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="grid aspect-square w-full place-items-center rounded-2xl border-2 border-dashed border-line text-muted transition hover:border-amber-500/60 hover:text-fg"
        >
          <span className="grid justify-items-center gap-2 px-6 text-center text-sm">
            <ImagePlus className="size-8 text-amber-500" />
            <span className="font-semibold">Add product photos</span>
            <span className="text-xs">Front, back, sides, box… up to {MAX_PHOTOS}. The first one is the cover.</span>
          </span>
        </button>
      )}

      <div className="grid grid-cols-4 gap-2">
        {images.map((src, i) => (
          <div key={src} className={cx('group relative overflow-hidden rounded-xl border', i === 0 ? 'border-amber-500' : 'border-line')}>
            <SafeImage src={src} alt={`Photo ${i + 1}`} className="aspect-square w-full" />
            <button type="button" onClick={() => remove(i)} className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/70 text-white hover:bg-red-500" aria-label={`Remove photo ${i + 1}`}>
              <X className="size-3.5" />
            </button>
            <div className="absolute inset-x-1 bottom-1 flex items-center justify-between">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className={arrow} aria-label={`Move photo ${i + 1} left`}><ChevronLeft className="size-4" /></button>
              {i > 0 && (
                <button type="button" onClick={() => makeCover(i)} className={arrow} aria-label={`Make photo ${i + 1} the cover`} title="Make cover"><Star className="size-3.5" /></button>
              )}
              <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1} className={arrow} aria-label={`Move photo ${i + 1} right`}><ChevronRight className="size-4" /></button>
            </div>
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <div key={`up-${i}`} className="grid aspect-square place-items-center rounded-xl border border-line bg-bgsoft">
            <Loader2 className="size-5 animate-spin text-amber-500" />
          </div>
        ))}
        {room > 0 && images.length > 0 && (
          <button type="button" onClick={() => fileRef.current?.click()} className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-line text-muted transition hover:border-amber-500/60 hover:text-amber-500" aria-label="Add more photos">
            <ImagePlus className="size-5" />
          </button>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={onFiles} aria-label="Upload product photos" />

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            className="input pl-9"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }}
            placeholder="…or paste an image link"
            aria-label="Image link"
          />
        </div>
        <Button type="button" variant="ghost" onClick={addUrl} disabled={!url.trim()}>Add</Button>
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer font-semibold uppercase tracking-wide text-muted hover:text-fg">Stock photo presets</summary>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRESET_IMAGES.map((p) => {
            const on = images.includes(p.url);
            return (
              <button
                type="button"
                key={p.label}
                onClick={() => (on ? onChange((prev) => prev.filter((u) => u !== p.url)) : room > 0 && add([p.url]))}
                className={cx('rounded-full border px-2.5 py-1 text-xs transition', on ? 'border-amber-500 bg-amber-500 text-slate-950' : 'border-line text-muted hover:text-fg hover:border-amber-500/50')}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </details>

      {(msg || error) && <p className="text-xs text-red-500" role="alert">{msg || error}</p>}
    </div>
  );
}

export default function ProductForm({ open, product, onClose, onSaved }) {
  const { sections, saveProduct } = useStore();
  const [form, setForm] = useState(() => blank(sections[0]?.id));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [photosBusy, setPhotosBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(product ? { ...blank(sections[0]?.id), ...product, images: [...(product.images || [])] } : blank(sections[0]?.id));
  }, [open, product]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setImages = (fn) => setForm((f) => ({ ...f, images: fn(f.images) }));

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const errs = {};
    if (form.title.trim().length < 2) errs.title = 'Title is required.';
    if (!sections.some((s) => s.id === form.sectionId)) errs.sectionId = 'Choose a section.';
    if (!(Number(form.price) > 0)) errs.price = 'Enter a selling price.';
    if (form.costPrice === '' || Number(form.costPrice) < 0) errs.costPrice = 'Enter the cost price.';
    if (form.stock === '' || Number(form.stock) < 0 || !Number.isInteger(Number(form.stock))) errs.stock = 'Whole number, 0 or more.';
    if (photosBusy) errs.images = 'Wait for the photos to finish uploading.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    const res = await saveProduct(form);
    setSaving(false);
    if (res.error) { setErrors({ submit: res.error }); return; }
    onSaved(!product);
  };

  const margin = Number(form.price) - Number(form.costPrice);

  return (
    <Modal open={open} onClose={onClose} title={product ? 'Edit Product' : 'Add New Product'} size="xl">
      <form onSubmit={submit} noValidate className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="grid gap-4 content-start">
          <div className="grid sm:grid-cols-[2fr_1fr] gap-4">
            <Field label="Product title" error={errors.title}><input className="input" value={form.title} onChange={set('title')} placeholder="e.g. Samsung Galaxy A55 256GB" /></Field>
            <Field label="Brand"><input className="input" value={form.brand} onChange={set('brand')} placeholder="Samsung" /></Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Section / category" error={errors.sectionId}>
              <select className="input" value={form.sectionId} onChange={set('sectionId')}>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Condition">
              <select className="input" value={form.condition} onChange={set('condition')}>
                {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Price (KES)" error={errors.price}><input className="input" type="number" min="0" inputMode="numeric" value={form.price} onChange={set('price')} /></Field>
            <Field label="Cost (KES)" error={errors.costPrice}><input className="input" type="number" min="0" inputMode="numeric" value={form.costPrice} onChange={set('costPrice')} /></Field>
            <Field label="Stock qty" error={errors.stock}><input className="input" type="number" min="0" step="1" inputMode="numeric" value={form.stock} onChange={set('stock')} /></Field>
          </div>
          {form.price !== '' && form.costPrice !== '' && (
            <p className={cx('-mt-2 text-xs', margin >= 0 ? 'text-emerald-500' : 'text-red-500')}>
              Profit per unit: {kes(margin)} {Number(form.price) > 0 && `(${((margin / Number(form.price)) * 100).toFixed(1)}% margin)`}
            </p>
          )}
          <Field label="Key specs" hint="One spec per line — shown as a checklist in Quick View.">
            <textarea className="input min-h-[110px]" value={form.specs} onChange={set('specs')} placeholder={'6.6" AMOLED 120Hz\n8GB RAM, 256GB storage\n50MP triple camera'} />
          </Field>
          <Field label="Description"><textarea className="input min-h-[70px]" value={form.description} onChange={set('description')} /></Field>
          <Field label="Warranty"><input className="input" value={form.warranty} onChange={set('warranty')} placeholder="e.g. 1-year manufacturer warranty" /></Field>
        </div>

        <div className="grid gap-3 content-start">
          <PhotoManager images={form.images} onChange={setImages} error={errors.images} onBusyChange={setPhotosBusy} />
          {errors.submit && <p className="text-sm text-red-500" role="alert">{errors.submit}</p>}
          <Button type="submit" className="mt-3 w-full py-3" disabled={saving}><Save className="size-4" /> {saving ? 'Saving…' : product ? 'Save changes' : 'Publish product'}</Button>
          <Button type="button" variant="ghost" className="w-full" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}
