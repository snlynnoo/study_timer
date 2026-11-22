import React, { useEffect, useState } from 'react';
import { api, type LocalUser } from '../lib/api';

export default function UsersView({ currentUserId, onOwnPasswordReset,onRegistrationsSeen,refreshVersion=0 }: { currentUserId: string; onOwnPasswordReset: () => void;onRegistrationsSeen:()=>void;refreshVersion?:number }) {
  const [users, setUsers] = useState<LocalUser[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selected, setSelected] = useState<LocalUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showDeleted,setShowDeleted]=useState(false);
  const [deleting,setDeleting]=useState<LocalUser|null>(null);
  const [deleteEmail,setDeleteEmail]=useState('');
  const acknowledge=async(rows:LocalUser[])=>{
    const through_id=Math.max(0,...rows.filter(user=>!user.deleted_at).map(user=>user.registration_id??0));
    await api('/users/registrations/seen',{method:'POST',body:JSON.stringify({through_id})});onRegistrationsSeen();
  };
  const reload = async() => {const rows=await api<LocalUser[]>('/users?include_deleted=true');setUsers(rows);return rows;};
  useEffect(() => {let cancelled=false;reload().then(rows=>{if(!cancelled)return acknowledge(rows);}).catch(e=>{if(!cancelled)setError(e.message);});return()=>{cancelled=true;};}, [currentUserId,refreshVersion]);
  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await api('/users',{method:'POST',body:JSON.stringify({name,email,password})});
      setName(''); setEmail(''); setPassword(''); await reload(); setMessage('User created. They can now sign in with the password you set.');
    } catch(e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function reset(event: React.FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    if (resetPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      await api(`/users/${selected!.id}/password`,{method:'POST',body:JSON.stringify({password:resetPassword})});
      const own=selected!.id === currentUserId;
      setSelected(null); setResetPassword(''); setConfirmPassword('');
      if (own) { onOwnPasswordReset(); return; }
      await reload(); setMessage('Password reset. Existing sign-ins for this user have been revoked.');
    } catch(e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function updateUser(user:LocalUser,action:'active'|'delete'|'restore') {
    setBusy(true);setError('');setMessage('');
    try {
      await api(`/users/${user.id}${action==='restore'?'/restore':''}`,{
        method:action==='delete'?'DELETE':action==='restore'?'POST':'PATCH',
        body:JSON.stringify(action==='active'?{is_active:!user.is_active}:{}),
      });
      if(selected?.id===user.id)setSelected(null);
      await reload();setDeleting(null);setDeleteEmail('');
      setMessage(action==='delete'?'Account deleted and sign-ins revoked. You can restore it from Deleted accounts.':action==='restore'?'Account restored as inactive. Enable Active to allow sign-in.':user.is_active?'Account deactivated. Existing sign-ins revoked.':'Account activated.');
    }catch(error:any){setError(error.message);}finally{setBusy(false);}
  }
  const inputClass='mt-1 w-full border border-gray-200 rounded-xl px-4 py-3 bg-white';
  return <section className="users-page w-full max-w-4xl bg-white rounded-3xl p-6 sm:p-8 shadow-xl text-gray-900">
    <h1 className="text-2xl font-bold">Users</h1><p className="text-sm text-gray-500 mt-1 mb-6">Manage local accounts and passwords.</p>
    {error && <p role="alert" className="p-3 mb-4 bg-teal-50 text-teal-700 rounded-xl">{error}</p>}
    {message && <p role="status" className="p-3 mb-4 bg-emerald-50 text-emerald-700 rounded-xl">{message}</p>}
    <label className="user-deleted-toggle"><input type="checkbox" checked={showDeleted} onChange={e=>setShowDeleted(e.target.checked)}/> Show deleted accounts</label>
    <div className="user-cards space-y-3 mb-8">{users.filter(u=>showDeleted?!!u.deleted_at:!u.deleted_at).map(u=><div key={u.id} className="user-card flex flex-wrap items-center justify-between gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
      <div><p className="font-bold">{u.name} <span className="text-xs font-normal text-gray-500">{u.role === 'admin' ? 'Administrator' : 'User'}</span></p><p className="text-sm text-gray-600 break-all">{u.email}</p>{u.needs_password && <p className="text-xs text-amber-700 mt-1">Local password not set</p>}</div>
      <div className="user-management-actions">{u.deleted_at?<button disabled={busy} onClick={()=>updateUser(u,'restore')}>Restore account</button>:<>
        <label><input type="checkbox" aria-label={`Active account: ${u.email}`} checked={u.is_active} disabled={busy||u.id===currentUserId} onChange={()=>updateUser(u,'active')}/> Active</label>
        <button disabled={busy} onClick={()=>{setSelected(u);setResetPassword('');setConfirmPassword('');setError('');setMessage('');}} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold">Reset password</button>
        <button className="user-delete-button" disabled={busy||u.id===currentUserId} onClick={()=>{setDeleting(u);setDeleteEmail('');setError('');}}>Delete</button>
      </>}</div>
    </div>)}</div>
    {deleting&&<form className="user-delete-confirm" onSubmit={event=>{event.preventDefault();if(deleteEmail===deleting.email)void updateUser(deleting,'delete');}}>
      <h2>Delete {deleting.name}?</h2><p>The account will lose access immediately. Study data is retained so you can restore the account from Deleted accounts.</p>
      <label>Type {deleting.email} to confirm<input className={inputClass} type="email" required value={deleteEmail} onChange={e=>setDeleteEmail(e.target.value)}/></label>
      <div className="user-management-actions"><button className="user-delete-button" disabled={busy||deleteEmail!==deleting.email}>Delete account</button><button type="button" disabled={busy} onClick={()=>setDeleting(null)}>Cancel</button></div>
    </form>}
    {selected && <form onSubmit={reset} className="mb-8 p-5 rounded-2xl border border-teal-200 bg-teal-50 space-y-3">
      <h2 className="font-bold">Reset password for {selected.email}</h2>
      <p className="text-sm text-gray-600">This sets a new password and signs the user out of all local sessions.{selected.id === currentUserId && ' You will need to sign in again.'}</p>
      <label className="block text-sm">New password<input type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={resetPassword} onChange={e=>setResetPassword(e.target.value)} className={inputClass} /></label>
      <label className="block text-sm">Confirm new password<input type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} className={inputClass} /></label>
      <div className="flex gap-3"><button disabled={busy} className="px-4 py-2 rounded-xl bg-teal-600 text-white font-semibold">{busy?'Saving…':'Save new password'}</button><button type="button" disabled={busy} onClick={()=>{setSelected(null);setResetPassword('');setConfirmPassword('');}} className="px-4 py-2">Cancel</button></div>
    </form>}
    <h2 className="font-bold text-lg mb-3">Add user</h2>
    <form onSubmit={create} className="space-y-3">
      <label className="block text-sm">Name<input required maxLength={200} value={name} onChange={e=>setName(e.target.value)} className={inputClass}/></label>
      <label className="block text-sm">Email address<input type="email" autoComplete="off" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} className={inputClass}/></label>
      <label className="block text-sm">Initial password<input type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} className={inputClass}/></label>
      <p className="text-xs text-gray-500">Use at least 10 characters. Share the password directly with the user.</p>
      <button disabled={busy} className="px-5 py-3 bg-gray-900 text-white rounded-xl font-bold disabled:opacity-50">{busy?'Saving…':'Add user'}</button>
    </form>
  </section>;
}
