import { BRAND } from '../data/seed.js';

const kesFmt = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 });
export const kes = (n) => `KES ${kesFmt.format(Math.round(Number(n) || 0))}`;

export const uid = (prefix = 'id') =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const cx = (...c) => c.filter(Boolean).join(' ');

/** Valid Kenyan mobile: 07XXXXXXXX or 01XXXXXXXX (also accepts +254/254 prefixes). */
export function normalizeKePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  let local = null;
  if (/^0[17]\d{8}$/.test(digits)) local = digits;
  else if (/^254[17]\d{8}$/.test(digits)) local = '0' + digits.slice(3);
  else if (/^[17]\d{8}$/.test(digits)) local = '0' + digits;
  if (!local) return null;
  return { local, intl: '254' + local.slice(1) };
}

const MPESA_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
export function mpesaCode() {
  const year = 'S'; // Safaricom codes begin with a letter tied to the period
  const month = 'ABCDEFGHIJKL'[new Date().getMonth()];
  let rest = '';
  for (let i = 0; i < 8; i++) rest += MPESA_CHARS[Math.floor(Math.random() * MPESA_CHARS.length)];
  return year + month + rest;
}

export function orderId(existing = []) {
  let id;
  do id = `FAVO-${Math.floor(10000 + Math.random() * 89999)}`;
  while (existing.some((o) => o.id === id));
  return id;
}

export const waLink = (text) =>
  `https://wa.me/${BRAND.whatsappNumber}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export const waLinkTo = (phone, text) => {
  const p = normalizeKePhone(phone);
  return `https://wa.me/${p ? p.intl : BRAND.whatsappNumber}?text=${encodeURIComponent(text)}`;
};

export const fmtDate = (ts) =>
  new Date(ts).toLocaleString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const fmtTime = (ts) =>
  new Date(ts).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function downloadReceipt(order) {
  const rows = order.items
    .map((i) => `<tr><td>${esc(i.title)}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">${kes(i.price * i.qty)}</td></tr>`)
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${esc(order.id)}</title>
<style>body{font-family:Inter,Arial,sans-serif;max-width:560px;margin:32px auto;padding:24px;color:#0f172a;border:1px solid #e2e8f0;border-radius:16px}
h1{margin:0;font-size:22px}.muted{color:#64748b;font-size:13px}table{width:100%;border-collapse:collapse;margin:16px 0}
td,th{padding:8px 4px;border-bottom:1px solid #e2e8f0;font-size:14px}th{text-align:left;color:#64748b;font-weight:600}
.total{font-size:18px;font-weight:700}.code{background:#ecfdf5;color:#047857;padding:10px 14px;border-radius:10px;font-weight:700;letter-spacing:1px}
.row{display:flex;justify-content:space-between;margin:6px 0;font-size:14px}</style></head><body>
<h1>${esc(BRAND.name)}</h1><div class="muted">Electronics at prices you dream of · WhatsApp ${esc(BRAND.whatsappDisplay)}</div>
<hr style="border:none;border-top:1px dashed #cbd5e1;margin:18px 0">
<div class="code">M-PESA Ref: ${esc(order.mpesaCode)}</div>
<div class="row"><span>Order No.</span><b>${esc(order.id)}</b></div>
<div class="row"><span>Date</span><span>${esc(fmtDate(order.createdAt))}</span></div>
<div class="row"><span>Customer</span><span>${esc(order.customerName)}</span></div>
<div class="row"><span>Phone</span><span>${esc(order.phone)}</span></div>
<div class="row"><span>Delivery to</span><span>${esc(order.location)}</span></div>
<table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="row total"><span>Total Paid</span><span>${kes(order.total)}</span></div>
<p class="muted">Delivery fee is calculated based on your location and confirmed via call/WhatsApp. Track your order on our website using your order number.</p>
<p class="muted">Thank you for shopping with ${esc(BRAND.name)} 💛</p></body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Favo-Receipt-${order.id}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function stockLabel(stock) {
  if (stock <= 0) return { text: 'Out of Stock', tone: 'red' };
  if (stock <= 3) return { text: `Only ${stock} Left`, tone: 'amber' };
  return { text: 'In Stock', tone: 'emerald' };
}

/**
 * Resizes a photo in the browser (longest side ≤ maxSide) and re-encodes it,
 * so phone photos of 5–10MB upload as ~150–400KB. Falls back to JPEG where WebP encoding is unavailable.
 */
export async function shrinkImage(file, maxSide = 1400, quality = 0.85) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const encode = (type) => new Promise((res) => canvas.toBlob(res, type, quality));
  let blob = await encode('image/webp');
  if (!blob || blob.type !== 'image/webp') blob = await encode('image/jpeg');
  if (!blob) throw new Error('encode failed');
  return blob;
}
