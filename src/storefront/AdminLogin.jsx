import { useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { Button, Field, Modal } from '../components/ui.jsx';
import { useStore } from '../store/StoreContext.jsx';

export default function AdminLogin({ open, onClose, onSuccess }) {
  const { login } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setUsername('');
    setPassword('');
    setError('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const res = await login(username, password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      setPassword('');
      return;
    }
    reset();
    onSuccess();
  };

  return (
    <Modal open={open} onClose={close} title="Admin Login" size="sm">
      <form onSubmit={submit}>
        <div className="mb-5 flex items-center gap-3 rounded-2xl bg-amber-500/10 p-3 text-sm text-amber-500">
          <ShieldCheck className="size-5 shrink-0" />
          Restricted area — Favo Enterprise staff only.
        </div>
        <Field label="Username" className="mb-4">
          <input className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </Field>
        <Field label="Password" className="mb-2">
          <div className="relative">
            <input
              className="input pr-11"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted hover:text-fg" aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        {error && <p className="mb-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500" role="alert">{error}</p>}
        <Button type="submit" className="mt-4 w-full" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />} {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </Modal>
  );
}
