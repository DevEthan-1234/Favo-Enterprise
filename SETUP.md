# Connecting Favo Enterprise to Supabase

About 10 minutes. You only do this once.

## 1. Create the account and project

1. Go to <https://supabase.com> → **Start your project** and sign up with your email. Confirm the email Supabase sends you.
2. Click **New project**:
   - **Name:** `favo-enterprise`
   - **Database password:** click *Generate*, then save it in your password manager. The app doesn't need it.
   - **Region:** *Central EU (Frankfurt)*, one of the closest regions to Kenya.
   - **Plan:** Free.
3. Wait for the project to finish setting up (1–2 minutes).

## 2. Create the database

Open **SQL Editor** → **New query**. Paste in each file below, one at a time and in this order, and click **Run** after each:

| Order | File | What it does |
|---|---|---|
| 1 | `supabase/migrations/0001_schema.sql` | Tables, security rules, live updates |
| 2 | `supabase/migrations/0002_functions.sql` | Checkout, order tracking, chat, admin actions |
| 3 | `supabase/migrations/0003_seed.sql` | The 4 starter sections and 8 products (optional) |

Each one should finish with "Success. No rows returned".

## 3. Create the admin login

1. Go to **Authentication → Users → Add user → Create new user**:
   - **Email:** `favoenterprise0@gmail.com`
   - **Password:** your admin password
   - Tick **Auto Confirm User**
2. Back in **SQL Editor**, run this to give that user admin access:

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'favoenterprise0@gmail.com';
   ```

   It should say "1 row affected".
3. Go to **Authentication → Sign In / Providers** and turn **off** "Allow new users to sign up". Without this, strangers can create accounts. They still couldn't see admin data, but there's no reason to allow it.

On the website, the admin signs in with username `favoenterprise` and the password from step 1.

## 4. Connect the app

1. In Supabase, open **Project Settings → API Keys** (or use the **Connect** button at the top of the dashboard). Copy:
   - the **Project URL** (`https://xxxx.supabase.co`)
   - the **Publishable key** (`sb_publishable_…`). This key is safe to put in the website. **Never** use the `secret` / `service_role` key here.
2. In the project folder, copy `.env.example` to `.env` and fill it in:

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
   VITE_ADMIN_EMAIL=favoenterprise0@gmail.com
   ```
3. Restart: `npm run dev`.

## How the data is protected

- Anyone can read **sections and products**. Only the admin can change them.
- **Cost prices, orders and customer messages** are readable only by the admin account.
- Customers can only **place an order** (stock and prices are checked on the server), **track an order** by its number or M-Pesa code, and **chat**. Each customer can only read their own chat, using a private key stored on their device.
- Basic spam limits: 5 orders per phone number per hour, 5 new chats per number per hour, and 20 messages per chat every 5 minutes.

## M-Pesa payments (Send Money)

Customers pay with M-Pesa **Send Money** to 0795 679 552 and type in the confirmation code from their SMS. The code and number are set in `src/data/seed.js` (`BRAND.mpesaNumber`, `BRAND.mpesaName`). Requires `supabase/migrations/0005_send_money.sql`.

- Each new order shows **Check payment** in the admin Orders page. Match the code and amount against the M-Pesa SMS on your phone, then tap **Payment received** or **Not received**.
- **Not received** cancels the order and puts the items back in stock.
- Revenue and profit in Financials count only confirmed payments.
- Each M-Pesa code can be used for one order only.
- Stock is held from the moment the order is placed, so check pending payments regularly.
- An automatic "Enter PIN" prompt (Daraja STK push) needs a business Till or Paybill number, not a personal number.
