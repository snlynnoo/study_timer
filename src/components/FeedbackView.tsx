import React,{useEffect,useRef,useState} from 'react';
import {Inbox,Mail,RefreshCw,Send} from 'lucide-react';
import {api} from '../lib/api';

interface Feedback {id:string;subject:string;message:string;created_at:string;read_at:string|null;sender_name?:string;sender_email?:string;last_activity_at?:string}
interface Reply {id:string;message:string;created_at:string;sender_name:string;sender_role:'admin'|'user'}
interface FeedbackInbox {items:Feedback[];total:number;unread?:number;page:number;pageSize:number}
const dateLabel=(date:string)=>new Date(date).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short',hour12:false});

export default function FeedbackView({isAdmin,onUnreadChange}:{isAdmin:boolean;onUnreadChange?:(count:number)=>void}) {
  const [subject,setSubject]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const [inbox,setInbox]=useState<FeedbackInbox|null>(null);
  const [page,setPage]=useState(1);
  const [refresh,setRefresh]=useState(0);
  const [loading,setLoading]=useState(true);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [replies,setReplies]=useState<Reply[]>([]);
  const [repliesLoading,setRepliesLoading]=useState(false);
  const [repliesError,setRepliesError]=useState('');
  const [replyDrafts,setReplyDrafts]=useState<Record<string,string>>({});
  const [composing,setComposing]=useState(false);
  const [threadVersion,setThreadVersion]=useState(0);
  const loadedThread=useRef<string|null>(null);
  useEffect(()=>{
    let cancelled=false;setLoading(true);setError('');
    api<FeedbackInbox>(`${isAdmin?'/feedback':'/feedback/mine'}?page=${page}`).then(result=>{if(!cancelled){setInbox(result);if(isAdmin)onUnreadChange?.(result.unread??0);}})
      .catch(error=>{if(!cancelled)setError(error.message);})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[isAdmin,page,refresh]);
  useEffect(()=>{
    if(!selectedId){setReplies([]);loadedThread.current=null;return;}
    let cancelled=false,inFlight=false;
    if(loadedThread.current!==selectedId){setReplies([]);setRepliesLoading(true);}
    setRepliesError('');
    async function load() {
      if(inFlight)return;inFlight=true;
      try {
        const result=await api<{items:Reply[]}>(`/feedback/${selectedId}/replies`);
        if(!cancelled){setReplies(result.items);loadedThread.current=selectedId;setRepliesError('');}
      }catch(error:any){if(!cancelled)setRepliesError(error.message);}
      finally{inFlight=false;if(!cancelled)setRepliesLoading(false);}
    }
    void load();
    const interval=setInterval(load,5000);
    window.addEventListener('focus',load);
    return()=>{cancelled=true;clearInterval(interval);window.removeEventListener('focus',load);};
  },[selectedId,threadVersion,refresh]);
  async function reply(event:React.FormEvent) {
    event.preventDefault();if(!selectedId)return;
    const id=selectedId,draft=replyDrafts[id]??'';
    if(!draft.trim())return;
    setBusy(true);setError('');setSuccess('');
    try {
      await api(`/feedback/${id}/replies`,{method:'POST',body:JSON.stringify({message:draft.trim()})});
      setReplyDrafts(previous=>({...previous,[id]:''}));setThreadVersion(value=>value+1);
      const stamp=new Date().toISOString();
      setInbox(previous=>previous?{...previous,unread:isAdmin?Math.max(0,(previous.unread??0)-(previous.items.find(item=>item.id===id)?.read_at?0:1)):previous.unread,items:previous.items.map(item=>item.id===id?{...item,read_at:isAdmin?stamp:null,last_activity_at:stamp}:item).sort((a,b)=>(b.last_activity_at??b.created_at).localeCompare(a.last_activity_at??a.created_at))}:previous);
      if(isAdmin)api<{count:number}>('/feedback/unread-count').then(result=>onUnreadChange?.(result.count)).catch(()=>{});
    }catch(error:any){setError(error.message);}finally{setBusy(false);}
  }
  async function send(event:React.FormEvent) {
    event.preventDefault();setError('');setSuccess('');
    if(!subject.trim()||!message.trim()){setError('Enter a subject and feedback message.');return;}
    setBusy(true);
    try {
      const result=await api<{id:string;message:string}>('/feedback',{method:'POST',body:JSON.stringify({subject:subject.trim(),message:message.trim()})});
      setSuccess(result.message);setSubject('');setMessage('');setRefresh(value=>value+1);setPage(1);setSelectedId(result.id);setComposing(false);
    }catch(error:any){setError(error.message);}finally{setBusy(false);}
  }
  async function markRead(item:Feedback) {
    setBusy(true);setError('');
    try {
      await api(`/feedback/${item.id}`,{method:'PATCH',body:JSON.stringify({read:!item.read_at})});
      setRefresh(value=>value+1);
    }catch(error:any){setError(error.message);}finally{setBusy(false);}
  }
  const selected=inbox?.items.find(item=>item.id===selectedId);
  return <section className="feedback-page" aria-labelledby="feedback-heading">
    <header className="feedback-heading"><div><h1 id="feedback-heading">Feedback</h1><p>{isAdmin?'Continue conversations with your users.':'Continue a conversation or start new feedback.'}</p></div>
      <div className="feedback-heading-actions">{!isAdmin&&<button className="feedback-secondary" disabled={busy} onClick={()=>setComposing(true)}>New feedback</button>}
      <button className="feedback-secondary" disabled={loading||busy} onClick={()=>setRefresh(value=>value+1)}><RefreshCw size={16}/> Refresh</button></div>
    </header>
    {error&&<p role="alert" className="feedback-error">{error}</p>}
    {success&&<p role="status" className="feedback-success">{success}</p>}
    {!isAdmin&&composing&&<form className="feedback-compose" onSubmit={send}>
      <h2>New feedback</h2><p className="feedback-help">Start a separate conversation about a new topic.</p>
      <label htmlFor="feedback-subject">Subject</label><input id="feedback-subject" required disabled={busy} maxLength={200} value={subject} onChange={e=>{setSubject(e.target.value);setSuccess('');}} placeholder="What is your feedback about?"/>
      <label htmlFor="feedback-message">Message</label><textarea id="feedback-message" required disabled={busy} maxLength={5000} rows={5} value={message} onChange={e=>{setMessage(e.target.value);setSuccess('');}} placeholder="Tell us more…" aria-describedby="feedback-message-help"/>
      <p id="feedback-message-help" className="feedback-help">{message.length.toLocaleString()} / 5,000 characters · Visible to administrators only.</p>
      <button className="feedback-send" disabled={busy}><Send size={17}/>{busy?'Sending…':'Send feedback'}</button><button type="button" className="feedback-secondary feedback-compose-cancel" disabled={busy} onClick={()=>setComposing(false)}>Cancel</button>
    </form>}
    <div className="feedback-threads">
      <div className="feedback-inbox-heading"><h2><Inbox size={20}/> {isAdmin?'Inbox':'My feedback'}</h2><span>{inbox?`${inbox.total} ${inbox.total===1?'conversation':'conversations'}${isAdmin?` · ${inbox.unread} unread`:''}`:'Loading…'}</span></div>
      {loading?<p role="status" className="feedback-empty">Loading feedback…</p>:inbox&&inbox.items.length?<>
        <div className="feedback-inbox-layout">
          <div className="feedback-message-list" aria-label="Feedback messages">{inbox.items.map(item=><button key={item.id} className={`feedback-message ${selectedId===item.id?'selected':''}`} aria-pressed={selectedId===item.id} disabled={busy} onClick={()=>setSelectedId(item.id)}>
            <span className="feedback-message-top"><strong>{item.subject}</strong>{isAdmin&&!item.read_at&&<span className="feedback-unread">Unread</span>}</span>
            {isAdmin&&<span>{item.sender_name}</span>}<time dateTime={item.created_at}>{dateLabel(item.last_activity_at??item.created_at)}</time>
          </button>)}</div>
          <article className="feedback-detail" aria-label="Selected feedback">{selected?<>
            <header><h2>{selected.subject}</h2>{isAdmin&&<p>From {selected.sender_name} · <a href={`mailto:${selected.sender_email}`}>{selected.sender_email}</a></p>}<time dateTime={selected.created_at}>{dateLabel(selected.created_at)}</time></header>
            {isAdmin&&<button className="feedback-secondary" disabled={busy} onClick={()=>markRead(selected)}><Mail size={16}/>{busy?'Saving…':selected.read_at?'Mark unread':'Mark read'}</button>}
            <section className="feedback-replies" aria-label="Conversation messages"><h3>Conversation</h3>
              <article className="feedback-reply from-user"><header><strong>{isAdmin?selected.sender_name:'You'}</strong><time dateTime={selected.created_at}>{dateLabel(selected.created_at)}</time></header><p className="feedback-body">{selected.message}</p></article>
              <div role="log" aria-label="Replies" aria-live="polite" aria-relevant="additions text">
              {repliesLoading?<p role="status">Loading replies…</p>:repliesError?<p role="alert">{repliesError}</p>:replies.length?replies.map(item=><article className={`feedback-reply ${item.sender_role==='admin'?'from-admin':'from-user'}`} key={item.id}><header><strong>{item.sender_name}{item.sender_role==='admin'?' · Administrator':''}</strong><time dateTime={item.created_at}>{dateLabel(item.created_at)}</time></header><p className="feedback-body">{item.message}</p></article>):<p className="feedback-help">No replies yet.</p>}</div>
            </section>
            <form className="feedback-reply-form" onSubmit={reply}>
              <label htmlFor="feedback-reply">Message</label>
              <textarea id="feedback-reply" required disabled={busy} maxLength={5000} rows={4} value={replyDrafts[selected.id]??''} onChange={e=>setReplyDrafts(previous=>({...previous,[selected.id]:e.target.value}))} placeholder="Write your reply…"/>
              <p className="feedback-help">{isAdmin?'Messages stay in this conversation with the sender.':'Messages stay in this conversation. Use New feedback for a different topic.'}</p>
              <button className="feedback-send" disabled={busy||!(replyDrafts[selected.id]??'').trim()}><Send size={17}/>{busy?'Sending…':'Send message'}</button>
            </form>
          </>:<div className="feedback-empty"><Mail size={28}/><p>Select a message to read the feedback.</p></div>}</article>
        </div>
        <nav className="feedback-pagination" aria-label="Inbox pages"><button className="feedback-secondary" disabled={page===1||busy} onClick={()=>{setPage(value=>value-1);setSelectedId(null);}}>Previous</button><span>Page {page} of {Math.max(1,Math.ceil(inbox.total/inbox.pageSize))}</span><button className="feedback-secondary" disabled={page*inbox.pageSize>=inbox.total||busy} onClick={()=>{setPage(value=>value+1);setSelectedId(null);}}>Next</button></nav>
      </>:inbox?<div className="feedback-empty"><Inbox size={30}/><h2>No conversations yet</h2><p>{isAdmin?'Messages from users will appear here.':'Select New feedback to start your first conversation.'}</p></div>:null}
    </div>
  </section>;
}
