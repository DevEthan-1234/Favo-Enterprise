export const BRAND = {
  name: 'Favo Enterprise',
  handle: '@favoenterprise',
  tagline: 'Electronics at prices you dream of 🛍 | Your trusted online tech store 📦',
  services: 'Buy | Order | Import Electronics 📲',
  whatsappDisplay: '+254 795 679 552',
  whatsappNumber: '254795679552',
  hours: 'Mon – Sat',
  // M-Pesa Send Money destination. mpesaName = the name M-Pesa shows when sending to this number.
  mpesaNumber: '0795679552',
  mpesaDisplay: '0795 679 552',
  mpesaName: '',
  instagram: 'https://instagram.com/favoenterprise',
};

export const CONDITIONS = ['Brand New', 'Ex-UK / Refurbished', 'Pre-Order / Import'];

export const ORDER_STATUSES = [
  { key: 'pending', admin: 'Pending', customer: 'Order Received' },
  { key: 'confirmed', admin: 'Confirmed', customer: 'Delivery Cost Confirmed' },
  { key: 'dispatched', admin: 'Out for Delivery', customer: 'Dispatched' },
  { key: 'delivered', admin: 'Delivered', customer: 'Delivered' },
];

export const PAYMENT_STATUSES = {
  unverified: { admin: 'Check payment', customer: 'Confirming payment', tone: 'amber' },
  verified: { admin: 'Paid', customer: 'Payment confirmed', tone: 'emerald' },
  rejected: { admin: 'Not received', customer: 'Payment not received', tone: 'red' },
};

export const DELIVERY_AREAS = [
  'Nairobi CBD', 'Westlands', 'Kilimani', 'Karen', 'Lavington', 'Kasarani', 'Embakasi', 'Rongai',
  'Kitengela', 'Ruaka', 'Thika', 'Kiambu', 'Machakos', 'Nakuru', 'Naivasha', 'Eldoret', 'Kisumu',
  'Mombasa', 'Malindi', 'Nyeri', 'Meru', 'Kakamega',
];

const u = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=75`;

export const PRESET_IMAGES = [
  { label: 'iPhone', url: u('photo-1592750475338-74b7b21085ab') },
  { label: 'Android', url: u('photo-1610945415295-d9bbf067e59c') },
  { label: 'iPad', url: u('photo-1544244015-0df4b3ffc6b0') },
  { label: 'MacBook', url: u('photo-1517336714731-489689fd1ca8') },
  { label: 'Laptop', url: u('photo-1496181133206-80ce9b88a853') },
  { label: 'Headphones', url: u('photo-1505740420928-5e560c06d30e') },
  { label: 'Earbuds', url: u('photo-1606220588913-b3aacb4d2f46') },
  { label: 'Watch', url: u('photo-1523275335684-37898b6baf30') },
  { label: 'Console', url: u('photo-1606813907291-d86efa9b94db') },
  { label: 'Controller', url: u('photo-1592840496694-26d035b52b48') },
];
