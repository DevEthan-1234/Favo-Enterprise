import { Database } from 'lucide-react';

export default function SetupScreen() {
  return (
    <div className="min-h-dvh grid place-items-center p-4">
      <div className="glass max-w-lg w-full rounded-3xl p-6 sm:p-8">
        <span className="grid size-12 place-items-center rounded-2xl bg-amber-500 text-slate-950"><Database className="size-6" /></span>
        <h1 className="mt-4 font-display text-2xl font-bold">Connect your Supabase database</h1>
        <p className="mt-2 text-sm text-muted">
          Favo Enterprise stores products, orders and messages in Supabase so every customer and the admin see the same live data.
        </p>
        <ol className="mt-5 space-y-2 text-sm list-decimal pl-5">
          <li>Copy <code className="text-amber-500">.env.example</code> to <code className="text-amber-500">.env</code> in the project folder.</li>
          <li>Fill in <code className="text-amber-500">VITE_SUPABASE_URL</code> and <code className="text-amber-500">VITE_SUPABASE_PUBLISHABLE_KEY</code> from Supabase → Project Settings → API.</li>
          <li>Restart <code className="text-amber-500">npm run dev</code>.</li>
        </ol>
        <p className="mt-5 text-xs text-muted">Full steps are in <b>SETUP.md</b>.</p>
      </div>
    </div>
  );
}
