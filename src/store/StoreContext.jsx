import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ADMIN_EMAIL, ADMIN_USERNAME, friendlyError, supabase } from '../lib/supabase.js';
import { normalizeKePhone, shrinkImage } from '../lib/utils.js';

const StoreContext = createContext(null);
const NS = 'favo:v2:';

/* ---------- per-device state (cart, chat identity, own order numbers) ---------- */
function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(NS + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function useLocal(key, initial) {
  const [value, setValue] = useState(() => readLocal(key, initial));
  useEffect(() => {
    try { localStorage.setItem(NS + key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  }, [key, value]);
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== NS + key) return;
      try { setValue(e.newValue == null ? initial : JSON.parse(e.newValue)); } catch { /* ignore */ }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [value, setValue];
}

/* ---------- row mappers (DB snake_case → app camelCase) ---------- */
const ts = (v) => (v ? Date.parse(v) : Date.now());
const toSection = (r) => ({ id: r.id, name: r.name, position: r.position });
const toProduct = (r) => ({
  id: r.id, title: r.title, brand: r.brand, sectionId: r.section_id, price: r.price, stock: r.stock,
  condition: r.condition, image: r.image,
  images: Array.isArray(r.images) && r.images.length ? r.images : r.image ? [r.image] : [],
  specs: r.specs, description: r.description, warranty: r.warranty,
  createdAt: ts(r.created_at),
});
const toOrder = (r) => ({
  id: r.id, mpesaCode: r.mpesa_code, customerName: r.customer_name, phone: r.phone, location: r.location,
  notes: r.notes, status: r.status, deliveryFee: r.delivery_fee, items: r.items || [], total: r.total,
  createdAt: ts(r.created_at),
});
const toConversation = (r) => ({
  id: r.id, name: r.name, phone: r.phone, unreadAdmin: r.unread_admin, unreadCustomer: r.unread_customer,
  updatedAt: ts(r.updated_at),
  messages: (r.messages || [])
    .map((m) => ({ id: m.id, from: m.sender, kind: m.kind, text: m.body, ts: ts(m.created_at) }))
    .sort((a, b) => a.ts - b.ts),
});

const ok = (data) => ({ data, error: null });
const fail = (error) => ({ data: null, error: friendlyError(error) });

/** Collapses bursts of realtime events into one refetch. */
function useDebounced(fn, wait = 250) {
  const t = useRef(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => () => clearTimeout(t.current), []);
  return useCallback(() => {
    clearTimeout(t.current);
    t.current = setTimeout(() => fnRef.current(), wait);
  }, [wait]);
}

export function StoreProvider({ children }) {
  // Shared (database) state
  const [sections, setSections] = useState([]);
  const [rawProducts, setRawProducts] = useState([]);
  const [costs, setCosts] = useState({});
  const [orders, setOrders] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Auth
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  // Device state
  const [cart, setCart] = useLocal('cart', []);
  const [chatIdentity, setChatIdentity] = useLocal('chatIdentity', null); // { name, phone, token }
  const [myOrders, setMyOrders] = useLocal('myOrders', []);
  const [customerConversation, setCustomerConversation] = useState(null);

  /* ---------------- Loading ---------------- */
  const loadCatalog = useCallback(async () => {
    const [s, p] = await Promise.all([
      supabase.from('sections').select('*').order('position').order('id'),
      supabase.from('products').select('*').order('created_at', { ascending: false }),
    ]);
    if (s.error || p.error) {
      setLoadError(friendlyError(s.error || p.error));
      return;
    }
    setSections(s.data.map(toSection));
    setRawProducts(p.data.map(toProduct));
    setLoadError(null);
    setReady(true);
  }, []);

  const loadAdmin = useCallback(async () => {
    const [c, o, conv] = await Promise.all([
      supabase.from('product_costs').select('*'),
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('conversations').select('*, messages(*)').order('updated_at', { ascending: false }),
    ]);
    if (!c.error) setCosts(Object.fromEntries(c.data.map((r) => [r.product_id, r.cost_price])));
    if (!o.error) setOrders(o.data.map(toOrder));
    if (!conv.error) setConversations(conv.data.map(toConversation));
  }, []);

  const refreshCatalog = useDebounced(loadCatalog);
  const refreshAdmin = useDebounced(loadAdmin);

  useEffect(() => {
    loadCatalog();
    const channel = supabase
      .channel('catalog')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sections' }, refreshCatalog)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, refreshCatalog)
      .subscribe();
    // Catch up after the tab was in the background or the device was offline.
    const onFocus = () => document.visibilityState === 'visible' && refreshCatalog();
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('online', refreshCatalog);
    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('online', refreshCatalog);
    };
  }, [loadCatalog, refreshCatalog]);

  /* ---------------- Auth ---------------- */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!session) {
        setIsAdmin(false);
        setAuthReady(true);
        return;
      }
      const { data, error } = await supabase.rpc('is_admin');
      if (cancelled) return;
      setIsAdmin(!error && data === true);
      setAuthReady(true);
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isAdmin) {
      setCosts({});
      setOrders([]);
      setConversations([]);
      return;
    }
    loadAdmin();
    const channel = supabase
      .channel('admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refreshAdmin)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_costs' }, refreshAdmin)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, refreshAdmin)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, refreshAdmin)
      .subscribe();
    const onFocus = () => document.visibilityState === 'visible' && refreshAdmin();
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [isAdmin, loadAdmin, refreshAdmin]);

  const login = useCallback(async (username, password) => {
    const u = username.trim();
    const email = u.toLowerCase() === ADMIN_USERNAME ? ADMIN_EMAIL : u.includes('@') ? u : null;
    if (!email || !password) return { error: 'Invalid username or password. Access denied.' };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: /invalid login/i.test(error.message) ? 'Invalid username or password. Access denied.' : friendlyError(error) };
    }
    const check = await supabase.rpc('is_admin');
    if (check.error || check.data !== true) {
      await supabase.auth.signOut();
      return { error: 'This account does not have admin access.' };
    }
    setSession(data.session);
    setIsAdmin(true);
    return { error: null };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
  }, []);

  /* ---------------- Derived ---------------- */
  const products = useMemo(
    () => rawProducts.map((p) => ({ ...p, costPrice: costs[p.id] ?? 0 })),
    [rawProducts, costs]
  );

  const cartLines = useMemo(
    () => cart.map((c) => ({ ...c, product: products.find((p) => p.id === c.productId) })).filter((c) => c.product),
    [cart, products]
  );

  /* ---------------- Sections (admin) ---------------- */
  const addSection = useCallback(async (name) => {
    const { error } = await supabase.rpc('admin_add_section', { p_name: name });
    if (error) return fail(error);
    await loadCatalog();
    return ok(null);
  }, [loadCatalog]);

  const renameSection = useCallback(async (id, name) => {
    const clean = name.trim();
    if (!clean) return fail({ message: 'Section name is required.' });
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, name: clean } : s)));
    const { error } = await supabase.from('sections').update({ name: clean }).eq('id', id);
    if (error) { await loadCatalog(); return fail(error); }
    return ok(null);
  }, [loadCatalog]);

  const moveSection = useCallback(async (id, dir) => {
    setSections((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    const { error } = await supabase.rpc('admin_move_section', { p_id: id, p_dir: dir });
    if (error) { await loadCatalog(); return fail(error); }
    return ok(null);
  }, [loadCatalog]);

  const deleteSection = useCallback(async (id) => {
    const { error } = await supabase.rpc('admin_delete_section', { p_id: id });
    await loadCatalog();
    return error ? fail(error) : ok(null);
  }, [loadCatalog]);

  /* ---------------- Products (admin) ---------------- */
  const saveProduct = useCallback(async (form) => {
    const payload = {
      id: form.id || null,
      title: form.title.trim(),
      brand: (form.brand || '').trim(),
      sectionId: form.sectionId,
      price: Math.max(0, Math.round(Number(form.price) || 0)),
      costPrice: Math.max(0, Math.round(Number(form.costPrice) || 0)),
      stock: Math.max(0, Math.floor(Number(form.stock) || 0)),
      condition: form.condition,
      images: (form.images || []).map((u) => u.trim()).filter(Boolean).slice(0, 8),
      specs: form.specs || '',
      description: form.description || '',
      warranty: form.warranty || '',
    };
    payload.image = payload.images[0] || '';
    const { error } = await supabase.rpc('admin_save_product', { p: payload });
    if (error) return fail(error);
    await Promise.all([loadCatalog(), loadAdmin()]);
    return ok(null);
  }, [loadCatalog, loadAdmin]);

  /** Compresses a photo in the browser and uploads it to the public product-images bucket. */
  const uploadProductImage = useCallback(async (file) => {
    if (!file || !/^image\//.test(file.type)) return { data: null, error: 'Please choose a photo (JPG, PNG or WebP).' };
    let blob;
    try { blob = await shrinkImage(file); } catch { return { data: null, error: 'Could not read that photo. Try another one.' }; }
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('product-images').upload(path, blob, { contentType: blob.type, cacheControl: '31536000' });
    if (error) {
      if (/bucket not found/i.test(error.message)) return { data: null, error: 'Photo storage is not set up yet. Run the 0004_product_gallery.sql step in Supabase.' };
      return fail(error);
    }
    return ok(supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl);
  }, []);

  const deleteProduct = useCallback(async (id) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) return fail(error);
    setRawProducts((prev) => prev.filter((p) => p.id !== id));
    setCart((prev) => prev.filter((c) => c.productId !== id));
    return ok(null);
  }, [setCart]);

  const adjustStock = useCallback(async (id, delta) => {
    setRawProducts((prev) => prev.map((p) => (p.id === id ? { ...p, stock: Math.max(0, p.stock + delta) } : p)));
    const { data, error } = await supabase.rpc('admin_adjust_stock', { p_id: id, p_delta: delta });
    if (error) { await loadCatalog(); return fail(error); }
    setRawProducts((prev) => prev.map((p) => (p.id === id ? { ...p, stock: data } : p)));
    return ok(data);
  }, [loadCatalog]);

  /* ---------------- Cart (device) ---------------- */
  const addToCart = useCallback((productId, qty = 1) => {
    const product = rawProducts.find((p) => p.id === productId);
    if (!product || product.stock <= 0) return false;
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === productId);
      if (existing) return prev.map((c) => (c.productId === productId ? { ...c, qty: Math.min(product.stock, c.qty + qty) } : c));
      return [...prev, { productId, qty: Math.min(product.stock, qty) }];
    });
    return true;
  }, [rawProducts, setCart]);

  const setCartQty = useCallback((productId, qty) => {
    const product = rawProducts.find((p) => p.id === productId);
    setCart((prev) =>
      qty <= 0
        ? prev.filter((c) => c.productId !== productId)
        : prev.map((c) => (c.productId === productId ? { ...c, qty: Math.min(product ? product.stock : qty, qty) } : c))
    );
  }, [rawProducts, setCart]);

  const clearCart = useCallback(() => setCart([]), [setCart]);

  /* ---------------- Orders ---------------- */
  const placeOrder = useCallback(async ({ customerName, phone, location, notes }) => {
    if (!cart.length) return { error: 'Your cart is empty.' };
    const { data, error } = await supabase.rpc('place_order', {
      p_name: customerName,
      p_phone: phone,
      p_location: location,
      p_notes: notes || '',
      p_items: cart.map((c) => ({ productId: c.productId, qty: c.qty })),
    });
    if (error) {
      loadCatalog();
      return { error: friendlyError(error) };
    }
    setCart([]);
    setMyOrders((prev) => [data.id, ...prev.filter((id) => id !== data.id)].slice(0, 20));
    loadCatalog();
    return { order: data };
  }, [cart, setCart, setMyOrders, loadCatalog]);

  const trackOrders = useCallback(async (refs) => {
    const clean = refs.map((r) => String(r).trim().toUpperCase()).filter(Boolean)
      .map((r) => (/^\d{5}$/.test(r) ? `FAVO-${r}` : r));
    if (!clean.length) return ok([]);
    const { data, error } = await supabase.rpc('track_orders', { p_refs: clean });
    return error ? fail(error) : ok(data || []);
  }, []);

  const updateOrder = useCallback(async (id, patch) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    const row = {};
    if ('status' in patch) row.status = patch.status;
    if ('deliveryFee' in patch) row.delivery_fee = patch.deliveryFee;
    const { error } = await supabase.from('orders').update(row).eq('id', id);
    if (error) { await loadAdmin(); return fail(error); }
    return ok(null);
  }, [loadAdmin]);

  /* ---------------- Customer chat ---------------- */
  const refreshCustomerConversation = useCallback(async () => {
    if (!chatIdentity?.token) { setCustomerConversation(null); return; }
    const { data, error } = await supabase.rpc('get_customer_conversation', { p_token: chatIdentity.token });
    if (!error) setCustomerConversation(data);
  }, [chatIdentity?.token]);

  useEffect(() => { refreshCustomerConversation(); }, [refreshCustomerConversation]);

  const sendCustomerMessage = useCallback(async ({ name, phone, text, kind = 'chat' }) => {
    const p = normalizeKePhone(phone);
    if (!p) return { error: 'Enter a valid phone number (07XX… or 01XX…).' };
    if (!text.trim()) return { error: 'Message cannot be empty.' };
    // Re-use this device's conversation only when it belongs to the same phone number.
    const token = chatIdentity?.token && chatIdentity.phone === p.local ? chatIdentity.token : null;
    const { data, error } = await supabase.rpc('send_customer_message', {
      p_token: token, p_name: name, p_phone: p.local, p_body: text, p_kind: kind,
    });
    if (error) return { error: friendlyError(error) };
    setChatIdentity({ name: name.trim(), phone: p.local, token: data });
    if (data === chatIdentity?.token) refreshCustomerConversation();
    return { error: null };
  }, [chatIdentity, setChatIdentity, refreshCustomerConversation]);

  const markCustomerRead = useCallback(async () => {
    if (!chatIdentity?.token) return;
    setCustomerConversation((c) => (c ? { ...c, unreadCustomer: 0 } : c));
    await supabase.rpc('mark_customer_read', { p_token: chatIdentity.token });
  }, [chatIdentity?.token]);

  /* ---------------- Admin inbox ---------------- */
  const sendAdminReply = useCallback(async (convId, text) => {
    const { error } = await supabase.rpc('admin_reply', { p_conv: convId, p_body: text });
    if (error) return fail(error);
    await loadAdmin();
    return ok(null);
  }, [loadAdmin]);

  const markAdminRead = useCallback(async (convId) => {
    setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, unreadAdmin: 0 } : c)));
    await supabase.from('conversations').update({ unread_admin: 0 }).eq('id', convId);
  }, []);

  const deleteConversation = useCallback(async (convId) => {
    const { error } = await supabase.from('conversations').delete().eq('id', convId);
    if (error) return fail(error);
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    return ok(null);
  }, []);

  const value = useMemo(() => ({
    ready, loadError, reload: loadCatalog,
    authReady, isAdmin, login, logout,
    sections, products, orders, conversations, cart, cartLines, chatIdentity, myOrders, customerConversation,
    addSection, renameSection, moveSection, deleteSection,
    saveProduct, uploadProductImage, deleteProduct, adjustStock,
    addToCart, setCartQty, clearCart,
    placeOrder, trackOrders, updateOrder,
    sendCustomerMessage, refreshCustomerConversation, markCustomerRead, setChatIdentity,
    sendAdminReply, markAdminRead, deleteConversation,
  }), [
    ready, loadError, loadCatalog, authReady, isAdmin, login, logout,
    sections, products, orders, conversations, cart, cartLines, chatIdentity, myOrders, customerConversation,
    addSection, renameSection, moveSection, deleteSection, saveProduct, uploadProductImage, deleteProduct, adjustStock,
    addToCart, setCartQty, clearCart, placeOrder, trackOrders, updateOrder,
    sendCustomerMessage, refreshCustomerConversation, markCustomerRead, setChatIdentity,
    sendAdminReply, markAdminRead, deleteConversation,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
