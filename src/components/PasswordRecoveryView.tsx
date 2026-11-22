import React,{useState} from 'react';
import {api} from '../lib/api';

export default function PasswordRecoveryView({token,onBack}:{token:string|null;onBack:()=>void}) {
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [confirmation,setConfirmation]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  async function submit(event:React.FormEvent) {
    event.preventDefault();setError('');setMessage('');
    if(token&&password!==confirmation){setError('Passwords do not match.');return;}
    setBusy(true);
    try {
      const result=await api<{message:string}>(token?'/auth/reset-password':'/auth/forgot-password',{
        method:'POST',body:JSON.stringify(token?{token,password}:{email}),
      });
      setPassword('');setConfirmation('');setMessage(result.message);
    }catch(error:any){setError(error.message);}finally{setBusy(false);}
  }
  return <>
    <h1 id="login-title">{token?'Choose a new password.':'Forgot your password?'}</h1>
    {error&&<p role="alert" className="auth-error">{error}</p>}
    {message&&<p role="status" className="recovery-message">{message}</p>}
    {(!token||!message)&&<form className="auth-form" onSubmit={submit}>
      {token?<>
        <label>New password<input type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <label>Confirm new password<input type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>
      </>:<label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>}
      <button className="auth-submit" disabled={busy}>{busy?'Please wait…':token?'Reset password':'Send reset link'}</button>
    </form>}
    <p className="auth-help"><button type="button" className="auth-mode-switch" disabled={busy} onClick={onBack}>Back to sign in</button></p>
  </>;
}
