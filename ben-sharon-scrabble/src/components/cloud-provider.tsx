'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowRight, LoaderCircle, Mail, RefreshCw } from 'lucide-react';
import { CloudRepository } from '@/lib/cloud-repository';
import { localRepository, JournalRepository } from '@/lib/storage';
import { PlayerId } from '@/lib/model';
import { cloudConfigured, getSupabase } from '@/lib/supabase';
import { Tile } from './ui';
interface Connection { householdId: string; playerId: PlayerId; userId: string }
interface JournalConnection { cloud: boolean; repository: JournalRepository; playerId?: PlayerId; email?: string; signOut?: () => Promise<void> }
const Context = createContext<JournalConnection>({ cloud: false, repository: localRepository });
export function useJournalConnection() { return useContext(Context); }
function AuthCard({ children }: { children: React.ReactNode }) {
  return <main className="auth-shell"><div className="auth-brand"><Tile letter="B" points={3} /><Tile letter="S" /><span>one more game.</span></div><section className="card auth-card">{children}</section><p className="auth-caption">Two players. One private journal.</p></main>;
}
function SignIn({ initialError }: { initialError: string }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(cooldown - 1), 1000); return () => clearTimeout(timer); }, [cooldown]);
  async function send() {
    setBusy(true); setError('');
    try {
      const { error } = await getSupabase().auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { emailRedirectTo: `${window.location.origin}/` } });
      if (error) throw error;
      setSent(true); setCooldown(60);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not send a sign-in email. Please try again.'); } finally { setBusy(false); }
  }
  return <AuthCard><span className="eyebrow">BEN & SHARON’S SHARED JOURNAL</span><h1>{sent ? 'Check your inbox.' : 'Good to see you.'}</h1><p>{sent ? 'Enter the sign-in code from your email here, or open its sign-in link in this browser.' : 'Sign in with your invited email to see the same games and photos on both phones.'}</p><form onSubmit={async event => { event.preventDefault(); if (!sent) { await send(); return; } setBusy(true); setError(''); try { const { error } = await getSupabase().auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' }); if (error) throw error; } catch (err) { setError(err instanceof Error ? err.message : 'That code could not be verified.'); } finally { setBusy(false); } }}>
    <label className="field">Your email<input type="email" autoComplete="email" required value={email} disabled={sent} onChange={event => setEmail(event.target.value)} placeholder="Your invited email address" /></label>
    {sent && <label className="field">Sign-in code<input autoFocus type="text" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6,8}" maxLength={8} required value={code} onChange={event => setCode(event.target.value)} placeholder="Code from your email" /></label>}
    {error && <p className="error-message" role="alert">{error}</p>}
    <button className="button primary full-width" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" /> : sent ? <ArrowRight size={17} /> : <Mail size={17} />}{sent ? 'Open our journal' : 'Email me a sign-in code'}</button>
  </form>{sent && <div className="auth-help"><button className="text-button" onClick={() => { setSent(false); setCode(''); setError(''); }}>Use another email</button><button className="text-button" disabled={busy || cooldown > 0} onClick={() => void send()}>{cooldown ? `Resend in ${cooldown}s` : 'Resend email'}</button></div>}<p className="form-footnote">Only invited accounts can access your shared games.</p></AuthCard>;
}
export function CloudProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(cloudConfigured ? undefined : null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!cloudConfigured) return;
    const client = getSupabase(); let live = true;
    client.auth.getSession().then(({ data, error }) => { if (live) { setSession(data.session); if (error) setError('Your sign-in could not be restored. Please sign in again.'); } });
    // Keep this callback synchronous; awaiting Supabase queries here can deadlock auth.
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => { if (live) setSession(session); });
    return () => { live = false; subscription.unsubscribe(); };
  }, []);
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    let live = true;
    getSupabase().rpc('join_household').then(({ data, error }) => {
      if (!live) return;
      if (error) { setConnection(null); setError(error.code === '42501' ? 'This email is not invited to Ben and Sharon’s journal. Use one of your two invited accounts.' : 'Could not open the shared journal. Check your connection; the shared setup may still need to be completed.'); }
      else { setError(''); setConnection({ ...(data as Omit<Connection, 'userId'>), userId }); }
    });
    return () => { live = false; };
  }, [userId, retry]);
  const value = useMemo<JournalConnection>(() => {
    if (!cloudConfigured || !connection || connection.userId !== userId) return { cloud: false, repository: localRepository };
    return { cloud: true, repository: new CloudRepository(getSupabase(), connection.householdId), playerId: connection.playerId, email: session?.user.email, signOut: async () => { const { error } = await getSupabase().auth.signOut({ scope: 'local' }); if (error) throw new Error('Could not sign out. Check your connection and try again.'); } };
  }, [connection, userId, session?.user.email]);
  if (!cloudConfigured) return <Context.Provider value={value}>{children}</Context.Provider>;
  if (session === undefined) return <AuthCard><LoaderCircle size={24} className="spin" /><h1>Opening your journal…</h1></AuthCard>;
  if (!session) return <SignIn initialError={error} />;
  if (!connection || connection.userId !== session.user.id) return <AuthCard><span className="eyebrow">YOUR PRIVATE SHARED JOURNAL</span><h1>{error ? 'Let’s get you connected.' : 'Opening your journal…'}</h1>{error ? <><p role="alert">{error}</p><button className="button secondary" onClick={() => { setError(''); setRetry(retry + 1); }}><RefreshCw size={16} />Try again</button><button className="text-button" onClick={() => { void getSupabase().auth.signOut({ scope: 'local' }); }}>Use another account</button></> : <LoaderCircle size={24} className="spin" />}</AuthCard>;
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
