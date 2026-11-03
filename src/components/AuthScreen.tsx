import { FormEvent, useState } from 'react';
import { CloudRain, Eye, EyeOff, Loader2, Mail, Lock, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Props = { onAuthenticated: () => void };

export function AuthScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(''); setError('');
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { full_name: name.trim() } },
        });
        if (authError) throw authError;
        if (data.session) onAuthenticated();
        else setMessage('Account created. Check your email to confirm your account, then sign in.');
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        onAuthenticated();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authentication failed. Please try again.');
    } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-rain-900/70 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-gradient-to-br from-rain-400 to-rain-700 grid place-items-center shadow-glow">
            <CloudRain className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">Rainfall Analysis</h1>
          <p className="mt-2 text-sm text-slate-300">Smarter weather insights for your fields</p>
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/[0.07] backdrop-blur-xl shadow-2xl p-6 sm:p-8">
          <div className="flex rounded-xl bg-black/20 p-1 mb-6">
            <button type="button" onClick={() => { setMode('login'); setError(''); setMessage(''); }} className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${mode === 'login' ? 'bg-rain-600 text-white' : 'text-slate-300 hover:text-white'}`}>Sign in</button>
            <button type="button" onClick={() => { setMode('signup'); setError(''); setMessage(''); }} className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${mode === 'signup' ? 'bg-rain-600 text-white' : 'text-slate-300 hover:text-white'}`}>Create account</button>
          </div>
          <h2 className="font-display text-xl font-bold">{mode === 'login' ? 'Welcome back' : 'Join the dashboard'}</h2>
          <p className="mt-1 mb-6 text-sm text-slate-300">{mode === 'login' ? 'Sign in to access your rainfall dashboard.' : 'Create an account to start using rainfall prediction.'}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && <label className="block"><span className="mb-1.5 block text-sm text-slate-200">Full name</span><span className="relative block"><UserRound className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" /><input required autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="w-full rounded-xl border border-white/10 bg-slate-950/50 py-3 pl-10 pr-3 text-sm outline-none focus:border-rain-400" /></span></label>}
            <label className="block"><span className="mb-1.5 block text-sm text-slate-200">Email address</span><span className="relative block"><Mail className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" /><input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-white/10 bg-slate-950/50 py-3 pl-10 pr-3 text-sm outline-none focus:border-rain-400" /></span></label>
            <label className="block"><span className="mb-1.5 block text-sm text-slate-200">Password</span><span className="relative block"><Lock className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" /><input required minLength={6} type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" className="w-full rounded-xl border border-white/10 bg-slate-950/50 py-3 pl-10 pr-11 text-sm outline-none focus:border-rain-400" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-slate-400 hover:text-white">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></span></label>
            {error && <p role="alert" className="rounded-lg bg-red-500/10 border border-red-400/20 p-3 text-sm text-red-200">{error}</p>}
            {message && <p role="status" className="rounded-lg bg-emerald-500/10 border border-emerald-400/20 p-3 text-sm text-emerald-200">{message}</p>}
            <button disabled={busy} type="submit" className="w-full rounded-xl bg-gradient-to-r from-rain-500 to-rain-700 py-3 font-semibold text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}{busy ? 'Please wait…' : mode === 'login' ? 'Sign in securely' : 'Create account'}
            </button>
          </form>
          <p className="mt-5 text-center text-xs leading-relaxed text-slate-400">Your account is managed securely by Supabase Authentication.</p>
        </section>
      </div>
    </main>
  );
}
