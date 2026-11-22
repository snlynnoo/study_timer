import React, { useEffect, useRef, useState } from 'react';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, X, Check, Circle } from 'lucide-react';
import { api } from '../lib/api';

interface Todo {id:string;date:string;title:string;notes:string;completed:boolean;created_at:string;updated_at:string}
interface Draft {id?:string;date:string;title:string;notes:string;completed:boolean}
const dateKey=(date:Date)=>format(date,'yyyy-MM-dd');

export default function TodoView() {
  const [month,setMonth]=useState(()=>startOfMonth(new Date()));
  const [selected,setSelected]=useState(()=>dateKey(new Date()));
  const [todos,setTodos]=useState<Todo[]>([]);
  const [draft,setDraft]=useState<Draft|null>(null);
  const [removing,setRemoving]=useState<Todo|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const requestVersion=useRef(0);
  const titleInput=useRef<HTMLInputElement>(null);
  const first=startOfWeek(startOfMonth(month),{weekStartsOn:1});
  const last=endOfWeek(endOfMonth(month),{weekStartsOn:1});
  const from=dateKey(first),to=dateKey(last);
  const cells=eachDayOfInterval({start:first,end:last});
  const selectedDate=parseISO(selected);
  const dayTodos=todos.filter(task=>task.date===selected);
  const completed=dayTodos.filter(task=>task.completed).length;

  useEffect(()=>{
    const version=++requestVersion.current;
    setLoading(true);setTodos([]);setError('');
    api<Todo[]>(`/todos?from=${from}&to=${to}`).then(data=>{if(requestVersion.current===version)setTodos(data);})
      .catch(e=>{if(requestVersion.current===version)setError(e.message);})
      .finally(()=>{if(requestVersion.current===version)setLoading(false);});
    return()=>{requestVersion.current++;};
  },[from,to]);
  useEffect(()=>{if(draft)titleInput.current?.focus();},[draft?.id,!!draft]);
  function choose(date:Date) {
    setSelected(dateKey(date));
    if(!isSameMonth(date,month))setMonth(startOfMonth(date));
    setDraft(null);setRemoving(null);setError('');setMessage('');
  }
  function shiftMonth(offset:number) {
    const next=addMonths(month,offset);
    if(next.getFullYear()<1||next.getFullYear()>9999)return;
    setMonth(next);setSelected(dateKey(next));setDraft(null);setRemoving(null);setMessage('');
  }
  async function save(event:React.FormEvent) {
    event.preventDefault();if(!draft)return;
    const submitted={...draft};
    setBusy(true);setError('');setMessage('');
    try {
      const saved=await api<Todo>(submitted.id?`/todos/${submitted.id}`:'/todos',{method:submitted.id?'PATCH':'POST',body:JSON.stringify(submitted)});
      setTodos(previous=>[...previous.filter(task=>task.id!==saved.id),saved].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id)));
      setDraft(null);setSelected(saved.date);
      if(!isSameMonth(parseISO(saved.date),month))setMonth(startOfMonth(parseISO(saved.date)));
      setMessage(submitted.id?'Task updated.':'Task added.');
    }catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  async function remove() {
    if(!removing)return;
    setBusy(true);setError('');setMessage('');
    try {
      await api(`/todos/${removing.id}`,{method:'DELETE',body:'{}'});
      setTodos(previous=>previous.filter(task=>task.id!==removing.id));
      if(draft?.id===removing.id)setDraft(null);
      setRemoving(null);setMessage('Task removed.');
    }catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  async function toggle(task:Todo) {
    setBusy(true);setError('');setMessage('');
    try {
      const saved=await api<Todo>(`/todos/${task.id}`,{method:'PATCH',body:JSON.stringify({completed:!task.completed})});
      setTodos(previous=>previous.map(item=>item.id===saved.id?saved:item));
    }catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  return <section className="todo-page" aria-labelledby="todo-heading">
    <div className="todo-title"><div><h1 id="todo-heading">To-do</h1><p>Select a date to view and plan your tasks.</p></div><button className="todo-today" disabled={busy} onClick={()=>choose(new Date())}>Today</button></div>
    {error&&<p className="todo-error" role="alert">{error}</p>}
    {message&&<p className="todo-message" role="status">{message}</p>}
    <div className="todo-layout">
      <section className="todo-calendar" aria-label="Task calendar">
        <div className="calendar-heading"><h2 aria-live="polite">{format(month,'MMMM yyyy')}</h2><div><button aria-label="Previous month" disabled={busy||month.getFullYear()===1&&month.getMonth()===0} onClick={()=>shiftMonth(-1)}><ChevronLeft size={19}/></button><button aria-label="Next month" disabled={busy||month.getFullYear()===9999&&month.getMonth()===11} onClick={()=>shiftMonth(1)}><ChevronRight size={19}/></button></div></div>
        <div className="calendar-weekdays" aria-hidden="true">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=><span key={day}>{day}</span>)}</div>
        <div className="calendar-days" role="group" aria-label={format(month,'MMMM yyyy')}>
          {cells.map(date=>{
            const key=dateKey(date),dateTasks=todos.filter(task=>task.date===key),count=dateTasks.length,pending=dateTasks.filter(task=>!task.completed).length;
            return <button key={key} disabled={busy} aria-pressed={key===selected} aria-label={`${format(date,'EEEE, MMMM d, yyyy')}${isToday(date)?', today':''}${count?`, ${count} ${count===1?'task':'tasks'}, ${pending} incomplete`:''}`} className={`calendar-day ${!isSameMonth(date,month)?'outside-month':''} ${isToday(date)?'today':''} ${key===selected?'selected':''}`} onClick={()=>choose(date)}><span>{format(date,'d')}</span><span className={`day-task-count ${count ? pending ? 'pending' : 'complete' : ''}`} aria-hidden="true">{count ? <>{pending ? <Circle size={10}/> : <Check size={11}/>}<span>{count}</span></> : null}</span></button>;
          })}
        </div>
        <div className="calendar-legend task-status-legend"><span><Circle size={11}/>Pending tasks</span><span><Check size={13}/>All complete</span></div>
      </section>
      <section className="todo-day" aria-labelledby="selected-day-heading" aria-busy={loading}>
        <div className="todo-day-heading"><div><h2 id="selected-day-heading">{format(selectedDate,'EEEE, MMM d')}</h2><p>{loading?'Loading tasks…':`${dayTodos.length} ${dayTodos.length===1?'task':'tasks'} · ${completed} completed`}</p></div><button className="todo-add" disabled={busy||loading} onClick={()=>{setDraft({date:selected,title:'',notes:'',completed:false});setRemoving(null);setError('');setMessage('');}}><Plus size={17}/>Add task</button></div>
        {draft&&<form className="todo-editor" onSubmit={save}>
          <div className="todo-editor-heading"><h3>{draft.id?'Edit task':'New task'}</h3><button type="button" aria-label="Close task editor" disabled={busy} onClick={()=>setDraft(null)}><X size={18}/></button></div>
          <label>Task<input ref={titleInput} required maxLength={200} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="What needs to get done?"/></label>
          <label>Date<input type="date" required min="0001-01-01" max="9999-12-31" value={draft.date} onInput={e=>setDraft({...draft,date:e.currentTarget.value})} onChange={e=>setDraft({...draft,date:e.target.value})}/></label>
          <label>Notes <span>(optional)</span><textarea rows={3} maxLength={4000} value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})} placeholder="Add details"/></label>
          <div className="todo-form-actions"><button type="button" disabled={busy} onClick={()=>setDraft(null)}>Cancel</button><button className="todo-save" disabled={busy||!draft.title.trim()}>{busy?'Saving…':'Save task'}</button></div>
        </form>}
        {removing&&<div className="todo-remove-confirm" role="alertdialog" aria-modal="false" aria-labelledby="remove-task-title"><h3 id="remove-task-title">Remove “{removing.title}”?</h3><p>This task will be permanently removed.</p><div><button disabled={busy} onClick={()=>setRemoving(null)}>Cancel</button><button className="todo-confirm-remove" disabled={busy} onClick={remove}>{busy?'Removing…':'Remove task'}</button></div></div>}
        <div className="todo-items">
          {dayTodos.map(task=><article className={`todo-item ${task.completed?'is-complete':''}`} key={task.id}>
            <button className="todo-check" aria-label={task.completed?`Mark ${task.title} incomplete`:`Complete ${task.title}`} aria-pressed={task.completed} disabled={busy} onClick={()=>toggle(task)}>{task.completed ? <Check size={15}/> : <Circle size={12}/>}</button>
            <div className="todo-item-content"><h3>{task.title}</h3>{task.notes&&<p>{task.notes}</p>}</div>
            <div className="todo-item-actions"><button aria-label={`Edit ${task.title}`} title="Edit task" disabled={busy} onClick={()=>{setDraft({...task});setRemoving(null);setError('');setMessage('');}}><Pencil size={16}/></button><button aria-label={`Remove ${task.title}`} title="Remove task" disabled={busy} onClick={()=>{setRemoving(task);setDraft(null);setError('');setMessage('');}}><Trash2 size={16}/></button></div>
          </article>)}
          {!loading&&!dayTodos.length&&!draft&&<div className="todo-empty"><CalendarDays size={30}/><h3>No tasks for this date</h3><p>Use Add task to plan your day.</p></div>}
        </div>
      </section>
    </div>
  </section>;
}
