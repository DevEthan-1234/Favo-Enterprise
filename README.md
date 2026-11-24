# Favo Enterprise — Storefront + Admin Portal

React 18 + Vite + Tailwind CSS v4 + Lucide icons, with Supabase for the database, admin login and live updates. A single app contains the customer storefront and the locked admin dashboard.

**First time?** Follow [SETUP.md](SETUP.md) to create the Supabase project and fill in `.env`. Until then the app shows a setup screen.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
```

- Storefront: `/#/`
- Admin: the lock icon in the navbar, or "Admin Login" in the footer (username `favoenterprise`)

## Structure

```
supabase/migrations/      database schema, server functions, starter catalog (run in order)
src/
  lib/supabase.js         Supabase client + friendly error messages
  store/StoreContext.jsx  all data + actions; Supabase reads/writes, realtime, admin auth
  data/seed.js            brand constants, order statuses, delivery areas, preset images
  lib/utils.js            KES formatting, KE phone validation, WhatsApp links, receipts
  components/ui.jsx       Modal, Drawer, Badge, Button, Field, SafeImage, Toast, PageHeader
  storefront/             Navbar, Hero, Catalog, ProductCard, QuickView, CartDrawer,
                          Checkout (M-Pesa Send Money + code), ImportModal, OrderTracker, ChatWidget, Footer
  admin/                  AdminPortal, Financials, OrdersHub, Inventory, ProductForm,
                          SectionManager, Inbox
```

Shared data (products, sections, orders, messages) lives in Supabase. Each device keeps only its own cart, chat key and list of its order numbers.

Payments use M-Pesa Send Money with admin confirmation. See the end of [SETUP.md](SETUP.md).
# Favo-Enterprise
