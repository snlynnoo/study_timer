import React, { useState } from "react";
import { Trash2, Calendar, Clock, Tag, Edit2, Check, X } from "lucide-react";
import { Session } from "../types";
import BreakDuration from "./BreakDuration";
import {parseBreakMinutes} from '../lib/breakMinutes';
import TimeInput from './TimeInput';
import {durationBetween,isValidTime} from '../lib/timeInput';
import { format, parseISO } from "date-fns";

interface SessionListProps {
  sessions: Session[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Session>) => Promise<boolean>;
  isDarkMode?: boolean;
}

export default function SessionList({ sessions, onDelete, onUpdate, isDarkMode }: SessionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Session>>({});
  const [breakMinutes,setBreakMinutes]=useState('');
  const [editError,setEditError]=useState('');
  const [saving,setSaving]=useState(false);

  const sortedSessions = [...sessions].sort((a, b) => {
    return new Date(b.date + "T" + b.startTime).getTime() - new Date(a.date + "T" + a.startTime).getTime();
  });

  const handleStartEdit = (session: Session) => {
    setEditingId(session.id || null);
    setBreakMinutes(session.breakSeconds==null?'':String(Number((session.breakSeconds/60).toFixed(2))));
    setEditError('');
    setEditValues({
      mainTask: session.mainTask,
      topic: session.topic,
      duration: session.duration,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime
    });
  };

  const handleSave = async(id: string) => {
    setEditError('');
    if(!isValidTime(editValues.startTime||'')||!isValidTime(editValues.endTime||'')){setEditError('Enter valid start and end times in 24-hour format.');return;}
    let seconds:number|null;
    try{seconds=parseBreakMinutes(breakMinutes);}catch(error:any){setEditError(error.message);return;}
    setSaving(true);
    try{
      if(await onUpdate(id,{...editValues,breakSeconds:seconds}))setEditingId(null);
      else setEditError('Could not save this session. Please try again.');
    }catch{setEditError('Could not save this session. Please try again.');}finally{setSaving(false);}
  };

  const updateEditStartTime = (val: string) => {
    const duration = durationBetween(val, editValues.endTime || "");
    setEditValues(prev => ({ ...prev, startTime: val, duration }));
  };

  const updateEditEndTime = (val: string) => {
    const duration = durationBetween(editValues.startTime || "", val);
    setEditValues(prev => ({ ...prev, endTime: val, duration }));
  };

  return (
    <div className="session-history w-full max-w-4xl mt-2">
      <h3 className={`text-xl font-bold mb-2 px-4 ${isDarkMode ? "text-emerald-400" : "text-emerald-600"}`}>Recent Sessions</h3>
      <div className="space-y-2">
        {sortedSessions.length === 0 ? (
          <div className={`text-center py-12 rounded-3xl border-2 border-dashed text-gray-400 ${isDarkMode ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"}`}>
            No sessions recorded yet.
          </div>
        ) : (
          sortedSessions.map((session) => (
            <div
              key={session.id}
              className={`flex flex-col md:flex-row items-start md:items-center justify-between p-3 rounded-2xl shadow-sm border transition-shadow gap-4 ${
                isDarkMode ? "bg-white/10 border-white/10 hover:shadow-white/5" : "bg-gray-50 border-gray-100 hover:shadow-md"
              }`}
            >
              <div className="flex flex-wrap items-center gap-4 md:gap-8 flex-1">
                {editingId === session.id ? (
                  <div className="session-editor grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                    <div className="session-edit-column">
                      <div>
                      <label htmlFor={`edit-task-${session.id}`} className="session-inline-label">Main Task / Topic</label>
                      <input 
                        id={`edit-task-${session.id}`}
                        type="text" 
                        value={editValues.mainTask} 
                        onChange={e => setEditValues(prev => ({ ...prev, mainTask: e.target.value }))}
                        className={`w-full px-3 py-1 rounded-lg border text-sm ${isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-white border-gray-200"}`}
                      />
                      </div>
                      <div>
                      <label htmlFor={`edit-topic-${session.id}`} className="session-inline-label">Sub-Task / Topic</label>
                      <input 
                        id={`edit-topic-${session.id}`}
                        type="text" 
                        value={editValues.topic} 
                        onChange={e => setEditValues(prev => ({ ...prev, topic: e.target.value }))}
                        className={`w-full px-3 py-1 rounded-lg border text-sm ${isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-white border-gray-200"}`}
                      />
                      </div>
                    </div>
                    <div className="session-edit-column">
                      <div>
                      <label className="session-inline-label">Date & duration (min)</label>
                      <div className="flex gap-2">
                        <input 
                          type="date" 
                          value={editValues.date} 
                          onChange={e => setEditValues(prev => ({ ...prev, date: e.target.value }))}
                          className={`flex-1 px-3 py-1 rounded-lg border text-sm ${isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-white border-gray-200"}`}
                        />
                        <input 
                          type="number" 
                          readOnly
                          value={editValues.duration} 
                          className={`w-20 px-3 py-1 rounded-lg border text-sm cursor-not-allowed ${isDarkMode ? "bg-white/5 border-white/10 text-white/50" : "bg-gray-50 border-gray-200 text-gray-400"}`}
                        />
                      </div>
                      </div>
                      <div className="session-time-break-row">
                        <div className="session-edit-time-range">
                          <label className="session-inline-label">Time range</label>
                          <div className="grid grid-cols-2 gap-2">
                            <TimeInput compact label="Start time" value={editValues.startTime||':'} onChange={updateEditStartTime}/>
                            <TimeInput compact label="End time" value={editValues.endTime||':'} onChange={updateEditEndTime}/>
                          </div>
                        </div>
                        <div className="session-edit-break">
                          <label htmlFor={`break-${session.id}`} className="session-inline-label">Break (min)</label>
                          <input id={`break-${session.id}`} aria-label="Break time (minutes)" type="number" min="0" max="10080" step="any" value={breakMinutes} onChange={e=>setBreakMinutes(e.target.value)} placeholder="Unknown" className={`w-full px-3 py-1 rounded-lg border text-sm ${isDarkMode ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-gray-300'}`} aria-describedby={`break-help-${session.id}`}/>
                          <p id={`break-help-${session.id}`} className="sr-only">Leave blank if unknown.</p>
                        </div>
                      </div>
                    </div>
                    {editError&&<p role="alert" className="session-edit-error">{editError}</p>}
                  </div>
                ) : (
                  <>
                    <div className={`flex items-center gap-2 ${isDarkMode ? "text-white/60" : "text-gray-600"}`}>
                      <Calendar className="w-4 h-4 text-teal-500" />
                      <span className="text-sm font-medium">{format(parseISO(session.date), "MMM d, yyyy")}</span>
                    </div>
                    <div className={`flex items-center gap-2 ${isDarkMode ? "text-white/60" : "text-gray-600"}`}>
                      <Clock className="w-4 h-4 text-teal-500" />
                      <span className="text-sm font-medium">
                        {session.startTime} - {session.endTime} ({session.duration} min focus)
                      </span>
                      <BreakDuration seconds={session.breakSeconds}/>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-600 w-fit">
                        <Tag className="w-3 h-3" />
                        <span className="text-xs font-bold uppercase tracking-wider">{session.mainTask}</span>
                      </div>
                      <span className={`text-sm font-bold ml-1 ${isDarkMode ? "text-white" : "text-gray-800"}`}>{session.topic}</span>
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                {editingId === session.id ? (
                  <>
                    <button
                      disabled={saving}
                      onClick={() => handleSave(session.id!)}
                      className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                      title={saving?'Saving…':'Save'}
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
                      disabled={saving}
                      onClick={() => setEditingId(null)}
                      className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Cancel"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      disabled={saving}
                      onClick={() => handleStartEdit(session)}
                      className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => session.id && onDelete(session.id)}
                      className="p-2 text-gray-400 hover:text-teal-500 hover:bg-teal-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
