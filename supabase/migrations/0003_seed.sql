-- Favo Enterprise — starter catalog (4 sections, 8 products). Safe to skip if you'd rather start empty.

insert into public.sections (id, name, position) values
  ('sec-phones', 'Smartphones & Tablets', 0),
  ('sec-laptops', 'Laptops & Computing', 1),
  ('sec-audio', 'Audio & Wearables', 2),
  ('sec-gaming', 'Gaming & Accessories', 3)
on conflict (id) do nothing;

insert into public.products (id, title, brand, section_id, price, stock, condition, image, specs, description, warranty, created_at) values
  ('p-iphone15pro', 'iPhone 15 Pro 256GB', 'Apple', 'sec-phones', 142000, 6, 'Brand New',
   'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=800&q=75',
   '6.1" Super Retina XDR ProMotion
A17 Pro chip, 8GB RAM
48MP main + 5x telephoto
Titanium frame, USB-C
eSIM + physical SIM',
   'Titanium flagship with the A17 Pro chip and the most capable iPhone camera system yet.', '1-year Apple international warranty', now() - interval '0 hours'),
  ('p-s24ultra', 'Samsung Galaxy S24 Ultra 512GB', 'Samsung', 'sec-phones', 158500, 3, 'Brand New',
   'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=800&q=75',
   '6.8" QHD+ Dynamic AMOLED 120Hz
Snapdragon 8 Gen 3, 12GB RAM
200MP quad camera, 100x Space Zoom
Built-in S Pen
5000mAh, 45W charging',
   'Galaxy AI powerhouse with a titanium build, S Pen and a 200MP camera.', '1-year Samsung Kenya warranty', now() - interval '1 hours'),
  ('p-macbookairm2', 'MacBook Air M2 13" 8GB/256GB', 'Apple', 'sec-laptops', 118000, 4, 'Brand New',
   'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=75',
   '13.6" Liquid Retina display
Apple M2 8-core CPU, 8-core GPU
8GB unified memory, 256GB SSD
Up to 18hrs battery
MagSafe charging',
   'Fanless, featherlight and blazing fast — the everyday laptop for students and creators.', '1-year Apple warranty', now() - interval '2 hours'),
  ('p-sonyxm5', 'Sony WH-1000XM5 Headphones', 'Sony', 'sec-audio', 44500, 5, 'Brand New',
   'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=75',
   'Industry-leading noise cancelling
30hrs battery, 3-min quick charge = 3hrs
Multipoint Bluetooth 5.2
LDAC Hi-Res audio
Speak-to-chat',
   'Silence the matatu noise. World-class ANC with crystal clear calls.', '1-year Sony warranty', now() - interval '3 hours'),
  ('p-airpodspro2', 'AirPods Pro (2nd Gen) USB-C', 'Apple', 'sec-audio', 32500, 1, 'Brand New',
   'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?auto=format&fit=crop&w=800&q=75',
   'Active Noise Cancellation 2x stronger
Adaptive Audio & Transparency
H2 chip, Personalised Spatial Audio
MagSafe USB-C case with speaker
IP54 dust & water resistance',
   'Premium earbuds with adaptive audio and best-in-class Apple ecosystem integration.', '1-year Apple warranty', now() - interval '4 hours'),
  ('p-ipadair', 'iPad Air M2 11" 128GB Wi-Fi', 'Apple', 'sec-phones', 86500, 2, 'Pre-Order / Import',
   'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=800&q=75',
   '11" Liquid Retina display
Apple M2 chip
12MP landscape front camera
Apple Pencil Pro support
Touch ID, USB-C',
   'Imported on order — light, powerful and perfect for study, design and entertainment. 7–14 day lead time.', '1-year Apple warranty', now() - interval '5 hours'),
  ('p-ps5slim', 'PlayStation 5 Slim Disc Edition', 'Sony', 'sec-gaming', 78500, 0, 'Brand New',
   'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=800&q=75',
   '1TB SSD storage
4K gaming up to 120fps
Ray tracing, Tempest 3D Audio
DualSense wireless controller included
Ultra HD Blu-ray drive',
   'Next-gen gaming. Currently sold out — chat with us to reserve the next shipment.', '1-year Sony warranty', now() - interval '6 hours'),
  ('p-hpelitebook', 'HP EliteBook 840 G6 Core i7', 'HP', 'sec-laptops', 46500, 9, 'Ex-UK / Refurbished',
   'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=75',
   '14" Full HD IPS display
Intel Core i7 8th Gen
16GB DDR4 RAM, 512GB SSD
Backlit keyboard, fingerprint
Windows 11 Pro',
   'Business-grade Ex-UK laptop in excellent condition, tested and certified by our technicians.', '6-month Favo Enterprise warranty', now() - interval '7 hours')
on conflict (id) do nothing;

insert into public.product_costs (product_id, cost_price) values
  ('p-iphone15pro', 124000),
  ('p-s24ultra', 139000),
  ('p-ipadair', 74000),
  ('p-macbookairm2', 101000),
  ('p-hpelitebook', 36000),
  ('p-sonyxm5', 36500),
  ('p-airpodspro2', 26000),
  ('p-ps5slim', 67000)
on conflict (product_id) do nothing;
