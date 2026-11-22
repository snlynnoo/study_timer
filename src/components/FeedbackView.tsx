import React,{useEffect,useState} from 'react';
import {Inbox,Mail,RefreshCw,Send} from 'lucide-react';
import {api} from '../lib/api';

interface Feedback {id:string;subject:string;message:string;created_at:string;read_at:string|null;sender_name:string;sender_email:string}
interface FeedbackInbox {items:Feedback[];total:number;unread:number;page:number;pageSize:number}
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
  const [loading,setLoading]=useState(isAdmin);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  useEffect(()=>{
    if(!isAdmin)return;
    let cancelled=false;setLoading(true);setError('');
    api<FeedbackInbox>(`/feedback?page=${page}`).then(result=>{if(!cancelled){setInbox(result);onUnreadChange?.(result.unread);}})
      .catch(error=>{if(!cancelled)setError(error.message);})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[isAdmin,page,refresh]);
  async function send(event:React.FormEvent) {
    event.preventDefault();setError('');setSuccess('');
    if(!subject.trim()||!message.trim()){setError('Enter a subject and feedback message.');return;}
    setBusy(true);
    try {
      const result=await api<{message:string}>('/feedback',{method:'POST',body:JSON.stringify({subject:subject.trim(),message:message.trim()})});
      setSuccess(result.message);setSubject('');setMessage('');
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
    <header className="feedback-heading"><div><h1 id="feedback-heading">Feedback</h1><p>{isAdmin?'Read feedback from your users.':'Share suggestions, report a problem, or tell us what could be better.'}</p></div>
      {isAdmin&&<button className="feedback-secondary" disabled={loading||busy} onClick={()=>setRefresh(value=>value+1)}><RefreshCw size={16}/> Refresh</button>}
    </header>
    {error&&<p role="alert" className="feedback-error">{error}</p>}
    {success&&<p role="status" className="feedback-success">{success}</p>}
    {isAdmin?<>
      <div className="feedback-inbox-heading"><h2><Inbox size={20}/> Inbox</h2><span>{inbox?`${inbox.total} ${inbox.total===1?'message':'messages'} · ${inbox.unread} unread`:'Loading…'}</span></div>
      {loading?<p role="status" className="feedback-empty">Loading feedback…</p>:inbox&&inbox.items.length?<>
        <div className="feedback-inbox-layout">
          <div className="feedback-message-list" aria-label="Feedback messages">{inbox.items.map(item=><button key={item.id} className={`feedback-message ${selectedId===item.id?'selected':''}`} aria-pressed={selectedId===item.id} onClick={()=>setSelectedId(item.id)}>
            <span className="feedback-message-top"><strong>{item.subject}</strong>{!item.read_at&&<span className="feedback-unread">Unread</span>}</span>
            <span>{item.sender_name}</span><time dateTime={item.created_at}>{dateLabel(item.created_at)}</time>
          </button>)}</div>
          <article className="feedback-detail" aria-label="Selected feedback">{selected?<>
            <header><h2>{selected.subject}</h2><p>From {selected.sender_name} · <a href={`mailto:${selected.sender_email}`}>{selected.sender_email}</a></p><time dateTime={selected.created_at}>{dateLabel(selected.created_at)}</time></header>
            <p className="feedback-body">{selected.message}</p>
            <button className="feedback-secondary" disabled={busy} onClick={()=>markRead(selected)}><Mail size={16}/>{busy?'Saving…':selected.read_at?'Mark unread':'Mark read'}</button>
          </>:<div className="feedback-empty"><Mail size={28}/><p>Select a message to read the feedback.</p></div>}</article>
        </div>
        <nav className="feedback-pagination" aria-label="Inbox pages"><button className="feedback-secondary" disabled={page===1||busy} onClick={()=>{setPage(value=>value-1);setSelectedId(null);}}>Previous</button><span>Page {page} of {Math.max(1,Math.ceil(inbox.total/inbox.pageSize))}</span><button className="feedback-secondary" disabled={page*inbox.pageSize>=inbox.total||busy} onClick={()=>{setPage(value=>value+1);setSelectedId(null);}}>Next</button></nav>
      </>:inbox?<div className="feedback-empty"><Inbox size={30}/><h2>No feedback yet</h2><p>Messages from users will appear here.</p></div>:null}
    </>:<form className="feedback-compose" onSubmit={send}>
      <h2>Send feedback</h2>
      <label htmlFor="feedback-subject">Subject</label><input id="feedback-subject" required maxLength={200} value={subject} onChange={e=>{setSubject(e.target.value);setSuccess('');}} placeholder="What is your feedback about?"/>
      <label htmlFor="feedback-message">Message</label><textarea id="feedback-message" required maxLength={5000} rows={8} value={message} onChange={e=>{setMessage(e.target.value);setSuccess('');}} placeholder="Tell us more…" aria-describedby="feedback-message-help"/>
      <p id="feedback-message-help" className="feedback-help">{message.length.toLocaleString()} / 5,000 characters · Visible to administrators only.</p>
      <button className="feedback-send" disabled={busy}><Send size={17}/>{busy?'Sending…':'Send feedback'}</button>
    </form>}
  </section>;
}
