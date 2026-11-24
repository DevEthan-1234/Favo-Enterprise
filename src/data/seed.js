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
  mpesaName: 'WARREN ORAVO',
  instagram: 'https://instagram.com/favoenterprise',
};

export const CONDITIONS = ['Brand New', 'Pre-Order / Import'];

// What customers see for each stored condition value.
export const CONDITION_LABELS = {
  'Brand New': 'Brand New',
  'Ex-UK / Refurbished': 'Refurbished',
  'Pre-Order / Import': 'Import on Order',
};
export const conditionLabel = (c) => CONDITION_LABELS[c] || c;

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

