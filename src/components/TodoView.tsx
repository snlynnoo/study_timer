import React, { useEffect, useRef, useState } from 'react';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, X, Check, Circle } from 'lucide-react';
import { api } from '../lib/api';
import TaskAchievement from './TaskAchievement';
import SortableTask from './SortableTask';
import {Reorder} from 'motion/react';

interface Todo {id:string;date:string;title:string;notes:string;completed:boolean;sort_order:number;created_at:string;updated_at:string}
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
  const [loadError,setLoadError]=useState(false);
  const [dragging,setDragging]=useState(false);
  const orderBeforeDrag=useRef<Todo[]>([]);
  const pendingOrder=useRef<string[]>([]);
  const requestVersion=useRef(0);
  const titleInput=useRef<HTMLInputElement>(null);
  const first=startOfWeek(startOfMonth(month),{weekStartsOn:1});
  const last=endOfWeek(endOfMonth(month),{weekStartsOn:1});
  const from=dateKey(first),to=dateKey(last);
  const cells=eachDayOfInterval({start:first,end:last});
  const selectedDate=parseISO(selected);
  const dayTodos=todos.filter(task=>task.date===selected).sort((a,b)=>a.sort_order-b.sort_order||a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
  const completed=dayTodos.filter(task=>task.completed).length;

  useEffect(()=>{
    const version=++requestVersion.current;
    setLoading(true);setTodos([]);setError('');setLoadError(false);
    api<Todo[]>(`/todos?from=${from}&to=${to}`).then(data=>{if(requestVersion.current===version)setTodos(data);})
      .catch(e=>{if(requestVersion.current===version){setError(e.message);setLoadError(true);}})
      .finally(()=>{if(requestVersion.current===version)setLoading(false);});
    return()=>{requestVersion.current++;};
  },[from,to]);
  useEffect(()=>{if(draft)titleInput.current?.focus();},[draft?.id,!!draft]);
  function choose(date:Date) {
    setSelected(dateKey(date));
    if(!isSameMonth(date,month))setMonth(startOfMonth(date));
    setDraft(null);setRemoving(null);setError('');
  }
  function shiftMonth(offset:number) {
    const next=addMonths(month,offset);
    if(next.getFullYear()<1||next.getFullYear()>9999)return;
    setMonth(next);setSelected(dateKey(next));setDraft(null);setRemoving(null);
  }
  async function save(event:React.FormEvent) {
    event.preventDefault();if(!draft)return;
    const submitted={...draft};
    setBusy(true);setError('');
    try {
      const saved=await api<Todo>(submitted.id?`/todos/${submitted.id}`:'/todos',{method:submitted.id?'PATCH':'POST',body:JSON.stringify(submitted)});
      setTodos(previous=>[...previous.filter(task=>task.id!==saved.id),saved].sort((a,b)=>a.sort_order-b.sort_order||a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id)));
      setDraft(null);setSelected(saved.date);
      if(!isSameMonth(parseISO(saved.date),month))setMonth(startOfMonth(parseISO(saved.date)));

    }catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  async function remove() {
    if(!removing)return;
    setBusy(true);setError('');
    try {
      await api(`/todos/${removing.id}`,{method:'DELETE',body:'{}'});
      setTodos(previous=>previous.filter(task=>task.id!==removing.id));
      if(draft?.id===removing.id)setDraft(null);
      setRemoving(null);
    }catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  async function toggle(task:Todo) {
    setBusy(true);setError('');
    try {
      const saved=await api<Todo>(`/todos/${task.id}`,{method:'PATCH',body:JSON.stringify({completed:!task.completed})});
      setTodos(previous=>previous.map(item=>item.id===saved.id?saved:item));
    }catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  function previewOrder(ids:string[]) {
    pendingOrder.current=ids;
    setTodos(previous=>previous.map(task=>task.date===selected?{...task,sort_order:ids.indexOf(task.id)}:task));
  }
  async function persistOrder(ids:string[],before:Todo[]) {
    setDragging(false);
    if(ids.every((id,index)=>id===before[index]?.id))return;
    setBusy(true);setError('');
    try {
      const saved=await api<Todo[]>('/todos/order',{method:'PUT',body:JSON.stringify({date:selected,ids})});
      setTodos(previous=>[...previous.filter(task=>task.date!==selected),...saved]);

    }catch(e:any){
      setTodos(previous=>[...previous.filter(task=>task.date!==selected),...before]);
      setError(`${e.message} The previous order has been restored.`);
    }finally{setBusy(false);}
  }
  function moveTask(id:string,direction:number) {
    const ids=dayTodos.map(task=>task.id),index=ids.indexOf(id),target=index+direction;
    if(target<0||target>=ids.length)return;
    [ids[index],ids[target]]=[ids[target],ids[index]];
    previewOrder(ids);void persistOrder(ids,dayTodos);
  }
  return <section className="todo-page" aria-labelledby="todo-heading">
    <div className="todo-title"><div><h1 id="todo-heading">To-do</h1><p>Select a date to view and plan your tasks.</p></div><button className="todo-today" disabled={busy||dragging} onClick={()=>choose(new Date())}>Today</button></div>
    {error&&<p className="todo-error" role="alert">{error}</p>}
    <div className="todo-layout">
      <section className="todo-calendar" aria-label="Task calendar">
        <div className="calendar-heading"><h2 aria-live="polite">{format(month,'MMMM yyyy')}</h2><div><button aria-label="Previous month" disabled={busy||month.getFullYear()===1&&month.getMonth()===0} onClick={()=>shiftMonth(-1)}><ChevronLeft size={19}/></button><button aria-label="Next month" disabled={busy||month.getFullYear()===9999&&month.getMonth()===11} onClick={()=>shiftMonth(1)}><ChevronRight size={19}/></button></div></div>
        <div className="calendar-weekdays" aria-hidden="true">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=><span key={day}>{day}</span>)}</div>
        <div className="calendar-days" role="group" aria-label={format(month,'MMMM yyyy')}>
          {cells.map(date=>{
            const key=dateKey(date),dateTasks=todos.filter(task=>task.date===key),count=dateTasks.length,pending=dateTasks.filter(task=>!task.completed).length;
            return <button key={key} disabled={busy||dragging} aria-pressed={key===selected} aria-label={`${format(date,'EEEE, MMMM d, yyyy')}${isToday(date)?', today':''}${count?pending?`, ${pending} ${pending===1?'task':'tasks'} to do`:', all tasks complete':''}`} className={`calendar-day ${!isSameMonth(date,month)?'outside-month':''} ${isToday(date)?'today':''} ${key===selected?'selected':''}`} onClick={()=>choose(date)}><span>{format(date,'d')}</span><span className={`day-task-count ${count ? pending ? pending<count ? 'progress' : 'pending' : 'complete' : ''}`} aria-hidden="true">{count ? <>{pending ? <Circle size={10}/> : <Check size={11}/>}{pending>0&&<span>{pending}</span>}</> : null}</span></button>;
          })}
        </div>
        <div className="calendar-legend task-status-legend"><span><Circle size={11}/>Not started</span><span className="tasks-in-progress"><Circle size={11}/>In progress</span><span><Check size={13}/>All complete</span></div>
      </section>
      <section className="todo-day" aria-labelledby="selected-day-heading" aria-busy={loading}>
        <div className="todo-day-heading"><div><h2 id="selected-day-heading">{format(selectedDate,'EEEE, MMM d')}</h2><p>{loading?'Loading tasks…':`${dayTodos.length} ${dayTodos.length===1?'task':'tasks'} · ${completed} completed`}</p></div><button className="todo-add" disabled={busy||dragging||loading} onClick={()=>{setDraft({date:selected,title:'',notes:'',completed:false});setRemoving(null);setError('');}}><Plus size={17}/>Add task</button></div>
        {draft&&<form className="todo-editor" onSubmit={save}>
          <div className="todo-editor-heading"><h3>{draft.id?'Edit task':'New task'}</h3><button type="button" aria-label="Close task editor" disabled={busy||dragging} onClick={()=>setDraft(null)}><X size={18}/></button></div>
          <label>Task<input ref={titleInput} required maxLength={200} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="What needs to get done?"/></label>
          <label>Date<input type="date" required min="0001-01-01" max="9999-12-31" value={draft.date} onInput={e=>setDraft({...draft,date:e.currentTarget.value})} onChange={e=>setDraft({...draft,date:e.target.value})}/></label>
          <label>Notes <span>(optional)</span><textarea rows={3} maxLength={4000} value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})} placeholder="Add details"/></label>
          <div className="todo-form-actions"><button type="button" disabled={busy||dragging} onClick={()=>setDraft(null)}>Cancel</button><button className="todo-save" disabled={busy||!draft.title.trim()}>{busy?'Saving…':'Save task'}</button></div>
        </form>}
        {removing&&<div className="todo-remove-confirm" role="alertdialog" aria-modal="false" aria-labelledby="remove-task-title"><h3 id="remove-task-title">Remove “{removing.title}”?</h3><p>This task will be permanently removed.</p><div><button disabled={busy||dragging} onClick={()=>setRemoving(null)}>Cancel</button><button className="todo-confirm-remove" disabled={busy||dragging} onClick={remove}>{busy?'Removing…':'Remove task'}</button></div></div>}
        <Reorder.Group as="div" axis="y" className="todo-items" values={dayTodos.map(task=>task.id)} onReorder={previewOrder}>
          {dayTodos.map(task=><SortableTask key={task.id} id={task.id} title={task.title} completed={task.completed} disabled={busy||!!draft||!!removing||dayTodos.length<2} onStart={()=>{orderBeforeDrag.current=dayTodos;pendingOrder.current=dayTodos.map(item=>item.id);setDragging(true);}} onEnd={()=>{void persistOrder(pendingOrder.current,orderBeforeDrag.current);}} onMove={direction=>moveTask(task.id,direction)}>
            <button className="todo-check" aria-label={task.completed?`Mark ${task.title} incomplete`:`Complete ${task.title}`} aria-pressed={task.completed} disabled={busy||dragging} onClick={()=>toggle(task)}>{task.completed ? <Check size={15}/> : <Circle size={12}/>}</button>
            <div className="todo-item-content"><h3>{task.title}</h3>{task.notes&&<p>{task.notes}</p>}</div>
            <div className="todo-item-actions"><button aria-label={`Edit ${task.title}`} title="Edit task" disabled={busy||dragging} onClick={()=>{setDraft({...task});setRemoving(null);setError('');}}><Pencil size={16}/></button><button aria-label={`Remove ${task.title}`} title="Remove task" disabled={busy||dragging} onClick={()=>{setRemoving(task);setDraft(null);setError('');}}><Trash2 size={16}/></button></div>
          </SortableTask>)}
          {!loading&&!dayTodos.length&&!draft&&<div className="todo-empty"><CalendarDays size={30}/><h3>No tasks for this date</h3><p>Use Add task to plan your day.</p></div>}
        </Reorder.Group>
      </section>
    </div>
    <TaskAchievement tasks={todos} month={month} loading={loading} unavailable={loadError}/>
  </section>;
}
