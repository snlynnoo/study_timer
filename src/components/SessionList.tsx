import React from "react";
import { Trash2, Calendar, Clock, Tag } from "lucide-react";
import { Session } from "../types";
import { format, parseISO } from "date-fns";

interface SessionListProps {
  sessions: Session[];
  onDelete: (id: string) => void;
  isDarkMode?: boolean;
}

export default function SessionList({ sessions, onDelete, isDarkMode }: SessionListProps) {
  console.log("SessionList rendering with sessions:", sessions.length);
  const sortedSessions = [...sessions].sort((a, b) => {
    return new Date(b.date + "T" + b.startTime).getTime() - new Date(a.date + "T" + a.startTime).getTime();
  });

  return (
    <div className="w-full max-w-4xl mt-12">
      <h3 className={`text-xl font-bold mb-6 px-4 ${isDarkMode ? "text-white" : "text-gray-800"}`}>Recent Sessions</h3>
      <div className="space-y-4">
        {sortedSessions.length === 0 ? (
          <div className={`text-center py-12 rounded-3xl border-2 border-dashed text-gray-400 ${isDarkMode ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"}`}>
            No sessions recorded yet.
          </div>
        ) : (
          sortedSessions.map((session) => (
            <div
              key={session.id}
              className={`flex flex-col md:flex-row items-start md:items-center justify-between p-6 rounded-2xl shadow-sm border transition-shadow gap-4 ${
                isDarkMode ? "bg-white/10 border-white/10 hover:shadow-white/5" : "bg-gray-50 border-gray-100 hover:shadow-md"
              }`}
            >
              <div className="flex flex-wrap items-center gap-4 md:gap-8">
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
              </div>
              <button
                onClick={() => session.id && onDelete(session.id)}
                className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors ml-auto md:ml-0"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
