import React, { useState } from "react";
import { Trash2, Calendar, Clock, Tag, Edit2, Check, X } from "lucide-react";
import { Session } from "../types";
import { format, parseISO } from "date-fns";

interface SessionListProps {
  sessions: Session[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Session>) => void;
  isDarkMode?: boolean;
}

export default function SessionList({ sessions, onDelete, onUpdate, isDarkMode }: SessionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Session>>({});

  const sortedSessions = [...sessions].sort((a, b) => {
    return new Date(b.date + "T" + b.startTime).getTime() - new Date(a.date + "T" + a.startTime).getTime();
  });

  const handleStartEdit = (session: Session) => {
    setEditingId(session.id || null);
    setEditValues({
      mainTask: session.mainTask,
      topic: session.topic,
      duration: session.duration,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime
    });
  };

  const calculateDuration = (start: string, end: string) => {
    try {
      const startParts = start.split(":").map(Number);
      const endParts = end.split(":").map(Number);
      if (startParts.length !== 2 || endParts.length !== 2) return 0;
      
      let startTotal = startParts[0] * 60 + startParts[1];
      let endTotal = endParts[0] * 60 + endParts[1];
      
      if (endTotal < startTotal) endTotal += 1440; // 24 hours
      return endTotal - startTotal;
    } catch (e) {
      return 0;
    }
  };

  const handleSave = (id: string) => {
    onUpdate(id, editValues);
    setEditingId(null);
  };

  const updateEditStartTime = (val: string) => {
    const duration = calculateDuration(val, editValues.endTime || "");
    setEditValues(prev => ({ ...prev, startTime: val, duration }));
  };

  const updateEditEndTime = (val: string) => {
    const duration = calculateDuration(editValues.startTime || "", val);
    setEditValues(prev => ({ ...prev, endTime: val, duration }));
  };

  return (
    <div className="w-full max-w-4xl mt-2">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase text-gray-400">Task & Topic</label>
                      <input 
                        type="text" 
                        value={editValues.mainTask} 
                        onChange={e => setEditValues(prev => ({ ...prev, mainTask: e.target.value }))}
                        className={`w-full px-3 py-1 rounded-lg border text-sm ${isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-white border-gray-200"}`}
                      />
                      <input 
                        type="text" 
                        value={editValues.topic} 
                        onChange={e => setEditValues(prev => ({ ...prev, topic: e.target.value }))}
                        className={`w-full px-3 py-1 rounded-lg border text-sm mt-1 ${isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-white border-gray-200"}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase text-gray-400">Date & Duration (m)</label>
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
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <input 
                          type="text" 
                          placeholder="HH:mm"
                          pattern="[0-9]{2}:[0-9]{2}"
                          value={editValues.startTime} 
                          onChange={e => updateEditStartTime(e.target.value)}
                          className={`w-full px-3 py-1 rounded-lg border text-sm ${isDarkMode ? "bg-white/10 border-white/20 text-white" : "bg-white border-gray-300"}`}
                        />
                        <input 
                          type="text" 
                          placeholder="HH:mm"
                          pattern="[0-9]{2}:[0-9]{2}"
                          value={editValues.endTime} 
                          onChange={e => updateEditEndTime(e.target.value)}
                          className={`w-full px-3 py-1 rounded-lg border text-sm ${isDarkMode ? "bg-white/10 border-white/20 text-white" : "bg-white border-gray-300"}`}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={`flex items-center gap-2 ${isDarkMode ? "text-white/60" : "text-gray-600"}`}>
                      <Calendar className="w-4 h-4 text-rose-500" />
                      <span className="text-sm font-medium">{format(parseISO(session.date), "MMM d, yyyy")}</span>
                    </div>
                    <div className={`flex items-center gap-2 ${isDarkMode ? "text-white/60" : "text-gray-600"}`}>
                      <Clock className="w-4 h-4 text-teal-500" />
                      <span className="text-sm font-medium">
                        {session.startTime} - {session.endTime} ({session.duration}m)
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 text-rose-600 w-fit">
                        <Tag className="w-3 h-3" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{session.mainTask}</span>
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
                      onClick={() => handleSave(session.id!)}
                      className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Save"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
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
                      onClick={() => handleStartEdit(session)}
                      className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => session.id && onDelete(session.id)}
                      className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
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
