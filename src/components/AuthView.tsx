import React, { useEffect, useRef, useState } from 'react';
import { Timer, ArrowRight, Sparkles, Heart, Eye, EyeOff } from 'lucide-react';
import { api, type LocalUser } from '../lib/api';
import TextSizeControl from './TextSizeControl';
import PasswordRecoveryView from './PasswordRecoveryView';
import {APP_LABEL} from '../lib/appInfo';

export default function AuthView({ onSuccess, fontSize, onFontSizeChange }: { onSuccess: (user: LocalUser) => void; fontSize: number; onFontSizeChange: (size: number) => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState<{required: boolean; email?: string; registrationEnabled?:boolean} | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [register,setRegister]=useState(false);
  const [name,setName]=useState('');
  const [website,setWebsite]=useState('');
  const [proof,setProof]=useState<{challengeId:string;nonce:number;expiresAt:number}|null>(null);
  const [checking,setChecking]=useState(false);
  const [recovery,setRecovery]=useState(()=>window.location.hash.startsWith('#reset-password='));
  const [resetToken,setResetToken]=useState<string|null>(()=>new URLSearchParams(window.location.hash.slice(1)).get('reset-password'));
  const worker=useRef<Worker|null>(null);
  const checkTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const checkGeneration=useRef(0);
  const stopCheck=()=>{
    checkGeneration.current++;worker.current?.terminate();worker.current=null;
    if(checkTimer.current)clearTimeout(checkTimer.current);
  };
  useEffect(() => { api('/auth/setup').then(setSetup).catch(e => setError(e.message)); }, []);
  useEffect(()=>()=>stopCheck(),[]);
  useEffect(()=>{if(resetToken)window.history.replaceState(null,'',window.location.pathname+window.location.search);},[]);
  function changeMode() {
    stopCheck();setRegister(!register);setProof(null);setChecking(false);setError('');setPassword('');setConfirmPassword('');
  }
  async function verify() {
    stopCheck();const generation=checkGeneration.current;
    setChecking(true);setProof(null);setError('');
    try {
      const challenge=await api<{id:string;difficulty:number;expiresAt:number}>('/auth/register/challenge');
      if(generation!==checkGeneration.current)return;
      const started=Date.now();
      worker.current=new Worker(new URL('../lib/registration.worker.ts',import.meta.url),{type:'module'});
      worker.current.onmessage=event=>{
        worker.current?.terminate();worker.current=null;
        if(checkTimer.current)clearTimeout(checkTimer.current);
        if(generation!==checkGeneration.current)return;
        if(event.data.error){setChecking(false);setError(event.data.error);return;}
        checkTimer.current=setTimeout(()=>{
          if(generation!==checkGeneration.current)return;
          setProof({challengeId:challenge.id,nonce:event.data.nonce,expiresAt:challenge.expiresAt});setChecking(false);
        },Math.max(0,2100-(Date.now()-started)));
      };
      worker.current.onerror=()=>{stopCheck();setChecking(false);setError('Security check failed. Please try again.');};
      checkTimer.current=setTimeout(()=>{stopCheck();setChecking(false);setError('Security check timed out. Please try again.');},90_000);
      worker.current.postMessage(challenge);
    } catch(e:any) {if(generation===checkGeneration.current){setChecking(false);setError(e.message);}}
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if ((setup?.required||register) && password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if(register&&(!proof||proof.expiresAt<=Date.now())) {setProof(null);setError('Please complete the security check again.');return;}
    setLoading(true);
    try {
      const { user } = await api(setup?.required ? '/auth/setup' : register?'/auth/register':'/auth/login', {
        method:'POST', body:JSON.stringify(setup?.required ? {code,password} : register?{name,email,password,website,challengeId:proof!.challengeId,nonce:proof!.nonce}:{email,password}),
      });
      setPassword(''); setConfirmPassword(''); setCode(''); onSuccess(user);
    } catch (e: any) { setError(e.message);if(register)setProof(null); }
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
        {recovery?<PasswordRecoveryView token={resetToken} onBack={()=>{setRecovery(false);setResetToken(null);}}/>:<>
        <h1 id="login-title">{setup?.required ? 'Set up your account' : register?'Create your account.':'Welcome back.'}</h1>
      {error && <p role="alert" className="auth-error">{error}</p>}
      <form onSubmit={submit} className="auth-form">
        {register&&<label>Name<input autoComplete="name" required maxLength={200} value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label>}
        {setup?.required ? <>
          <p className="auth-setup-note">Set a local password for <strong>{setup.email}</strong> using the one-time code provided with this installation.</p>
          <label>Setup code<input autoComplete="off" required value={code} onChange={e=>setCode(e.target.value)} placeholder="Enter your one-time setup code"/></label>
        </> : <label>Email address<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>}
        <label>{setup?.required ? 'New password' : 'Password'}<span className="password-field"><input aria-label={setup?.required ? 'New password' : 'Password'} type={showPassword ? 'text' : 'password'} autoComplete={setup?.required||register ? 'new-password' : 'current-password'} minLength={setup?.required||register ? 10 : 1} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)} placeholder={setup?.required||register ? 'At least 10 characters' : 'Enter your password'}/><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={()=>setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>
        {(setup?.required||register) && <label>Confirm password<input type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="One more time"/></label>}
        {register&&<>
          <div className="registration-trap" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)}/></label></div>
          <div className="registration-check"><div><strong>Security check</strong><p role="status">{checking?'Checking…':proof?'Check complete. Ready to register.':'Run a quick check before creating your account.'}</p></div><button type="button" disabled={checking||loading} onClick={verify}>{checking?'Checking…':proof?'Check again':'Verify'}</button></div>
        </>}
        <button className="auth-submit" disabled={loading || !setup || (register&&(!proof||checking))}>{loading ? 'Please wait…' : setup?.required ? 'Set password & get started' : register?'Create account':'Sign In'}<ArrowRight size={17}/></button>
      </form>
      {!setup?.required && <div className="auth-help">{setup?.registrationEnabled&&<>
        <p>{register?'Already have an account?':"Don't have an account?"}</p>
        <button type="button" disabled={loading} className="auth-account-button" onClick={changeMode}>{register?'Back to Sign In':'Sign Up'}</button>
      </>}<p className="auth-reset-note"><button type="button" disabled={loading} className="auth-mode-switch" onClick={()=>{stopCheck();setChecking(false);setProof(null);setPassword('');setConfirmPassword('');setRegister(false);setRecovery(true);}}>Forgot password?</button></p></div>}
      </>}
      </section>
    </div>
    <footer className="login-footer"><span>Made with <Heart size={12} fill="currentColor" aria-label="love"/> by Sai</span><span>{APP_LABEL}</span></footer>
  </main>;
}
