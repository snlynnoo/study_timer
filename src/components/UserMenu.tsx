import React, {useEffect, useRef, useState} from 'react';
import {LogOut} from 'lucide-react';

export default function UserMenu({name,role,onLogout}:{name:string;role:string;onLogout:()=>void}) {
  const [open,setOpen]=useState(false);
  const container=useRef<HTMLDivElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);

  useEffect(()=>{
    if(!open)return;
    const dismiss=(event:PointerEvent)=>{
      if(!container.current?.contains(event.target as Node))setOpen(false);
    };
    const escape=(event:KeyboardEvent)=>{
      if(event.key==='Escape') {setOpen(false);trigger.current?.focus();}
    };
    document.addEventListener('pointerdown',dismiss);
    document.addEventListener('keydown',escape);
    return ()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',escape);};
  },[open]);

  return <div className="header-user" ref={container} onBlur={event=>{
    if(!event.currentTarget.contains(event.relatedTarget as Node|null))setOpen(false);
  }}>
    <button ref={trigger} type="button" className="header-user-avatar" aria-label="Account" aria-expanded={open} aria-controls="account-details" onClick={()=>setOpen(!open)}>{Array.from(name.trim())[0]?.toUpperCase()||'U'}</button>
    {open&&<div id="account-details" className="header-user-dropdown" role="region" aria-label="Account details">
      <strong>{name}</strong>
      <span>{role==='admin'?'Administrator':'User'}</span>
      <button type="button" onClick={()=>{setOpen(false);onLogout();}}><LogOut size={17}/>Log out</button>
    </div>}
  </div>;
}
