import React, { useEffect, useState } from 'react';
import { Timer, ArrowRight, Sparkles, Heart, Eye, EyeOff } from 'lucide-react';
import { api, type LocalUser } from '../lib/api';
import TextSizeControl from './TextSizeControl';

export default function AuthView({ onSuccess, fontSize, onFontSizeChange }: { onSuccess: (user: LocalUser) => void; fontSize: number; onFontSizeChange: (size: number) => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState<{required: boolean; email?: string} | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => { api('/auth/setup').then(setSetup).catch(e => setError(e.message)); }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (setup?.required && password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const { user } = await api(setup?.required ? '/auth/setup' : '/auth/login', {
        method:'POST', body:JSON.stringify(setup?.required ? {code,password} : {email,password}),
      });
      setPassword(''); setConfirmPassword(''); setCode(''); onSuccess(user);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  return <main className="login-layout">
    <header className="login-header">
      <a className="brand auth-brand" href="/" aria-label="Study Timer home"><span className="brand-icon"><Timer size={24}/></span><span>study<span className="brand-light">timer</span></span></a>
      <TextSizeControl value={fontSize} onChange={onFontSizeChange}/>
    </header>
    <div className="login-center">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-art" aria-hidden="true"><span className="login-orbit"/><div className="login-art-clock"><Timer size={17}/><strong>25:00</strong><i/></div><span className="login-flow-badge"><Sparkles size={14}/>Find your flow</span></div>
        <h1 id="login-title">{setup?.required ? 'Set up your account' : 'Welcome back.'}</h1>
      {error && <p role="alert" className="auth-error">{error}</p>}
      <form onSubmit={submit} className="auth-form">
        {setup?.required ? <>
          <p className="auth-setup-note">Set a local password for <strong>{setup.email}</strong> using the one-time code provided with this installation.</p>
          <label>Setup code<input autoComplete="off" required value={code} onChange={e=>setCode(e.target.value)} placeholder="Enter your one-time setup code"/></label>
        </> : <label>Email address<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>}
        <label>{setup?.required ? 'New password' : 'Password'}<span className="password-field"><input aria-label={setup?.required ? 'New password' : 'Password'} type={showPassword ? 'text' : 'password'} autoComplete={setup?.required ? 'new-password' : 'current-password'} minLength={setup?.required ? 10 : 1} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)} placeholder={setup?.required ? 'At least 10 characters' : 'Enter your password'}/><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={()=>setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>
        {setup?.required && <label>Confirm password<input type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="One more time"/></label>}
        <button className="auth-submit" disabled={loading || !setup}>{loading ? 'Please wait…' : setup?.required ? 'Set password & get started' : 'Sign In'}<ArrowRight size={17}/></button>
      </form>
      {!setup?.required && <p className="auth-help">Need an account or a password reset?<br/><span>Your administrator can help you get started.</span></p>}
      </section>
    </div>
    <footer className="login-footer"><span>Made with <Heart size={12} fill="currentColor" aria-label="love"/> by Sai</span><span>Study Timer 2.0</span></footer>
  </main>;
}
