import React, { useState } from "react";
import { X, Plus, Download, Calendar as CalendarIcon, Clock, Tag, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Session } from "../types";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";

interface HistoryActionsProps {
  sessions: Session[];
  onInsert: (session: Session) => Promise<boolean>;
  isDarkMode?: boolean;
}

export default function HistoryActions({ sessions, onInsert, isDarkMode }: HistoryActionsProps) {
  const [isInsertOpen, setIsInsertOpen] = useState(false);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  
  // Insert Form State
  const [newSession, setNewSession] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    startTime: "09:00",
    endTime: "09:25",
    mainTask: "",
    topic: "",
    duration: 25
  });

  // Download Range State
  const [dateRange, setDateRange] = useState({
    from: format(new Date(), "yyyy-MM-dd"),
    to: format(new Date(), "yyyy-MM-dd")
  });

  const handleInsert = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onInsert(newSession);
    if (success) {
      setIsInsertOpen(false);
      setNewSession({
        date: format(new Date(), "yyyy-MM-dd"),
        startTime: "09:00",
        endTime: "09:25",
        mainTask: "",
        topic: "",
        duration: 25
      });
    }
  };

  const handleDownload = () => {
    const fromDate = startOfDay(parseISO(dateRange.from));
    const toDate = endOfDay(parseISO(dateRange.to));

    const filteredSessions = sessions.filter(s => {
      const sessionDate = parseISO(s.date);
      return isWithinInterval(sessionDate, { start: fromDate, end: toDate });
    });

    if (filteredSessions.length === 0) {
      alert("No sessions found in this date range.");
      return;
    }

    // CSV Columns: Date (2025-01-11), Start time, End time, Main task, Topic, duration in minutes
    const headers = ["Date", "Start time", "End time", "Main task", "Topic", "Duration (min)"];
    const rows = filteredSessions.map(s => [
      s.date,
      s.startTime,
      s.endTime,
      `"${s.mainTask.replace(/"/g, '""')}"`,
      `"${s.topic.replace(/"/g, '""')}"`,
      s.duration
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `sessions_${dateRange.from}_to_${dateRange.to}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsDownloadOpen(false);
  };

  return (
    <div className="w-full max-w-4xl flex gap-4 px-4 mb-6">
      <button
        onClick={() => setIsInsertOpen(true)}
        className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all shadow-lg active:scale-95 ${
          isDarkMode ? "bg-white/10 text-white hover:bg-white/20" : "bg-white text-gray-800 hover:bg-gray-50"
        }`}
      >
        <Plus className="w-5 h-5 text-rose-500" />
        Insert Session
      </button>
      <button
        onClick={() => setIsDownloadOpen(true)}
        className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all shadow-lg active:scale-95 ${
          isDarkMode ? "bg-white/10 text-white hover:bg-white/20" : "bg-white text-gray-800 hover:bg-gray-50"
        }`}
      >
        <Download className="w-5 h-5 text-teal-500" />
        Download CSV
      </button>

      {/* Insert Modal */}
      <AnimatePresence>
        {isInsertOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsInsertOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-md p-8 rounded-3xl shadow-2xl ${
                isDarkMode ? "bg-gray-900 text-white" : "bg-white text-gray-800"
              }`}
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold">Insert Session</h2>
                <button onClick={() => setIsInsertOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleInsert} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <CalendarIcon className="w-3 h-3" /> Date
                    </label>
                    <input
                      type="date"
                      required
                      value={newSession.date}
                      onChange={(e) => setNewSession({ ...newSession, date: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl font-bold focus:outline-none focus:ring-2 transition-all ${
                        isDarkMode ? "bg-white/5 focus:ring-white/20" : "bg-gray-100 focus:ring-gray-200"
                      }`}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Clock className="w-3 h-3" /> Duration (min)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={newSession.duration}
                      onChange={(e) => setNewSession({ ...newSession, duration: parseInt(e.target.value) || 0 })}
                      className={`w-full px-4 py-3 rounded-xl font-bold focus:outline-none focus:ring-2 transition-all ${
                        isDarkMode ? "bg-white/5 focus:ring-white/20" : "bg-gray-100 focus:ring-gray-200"
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Start Time</label>
                    <input
                      type="time"
                      required
                      value={newSession.startTime}
                      onChange={(e) => setNewSession({ ...newSession, startTime: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl font-bold focus:outline-none focus:ring-2 transition-all ${
                        isDarkMode ? "bg-white/5 focus:ring-white/20" : "bg-gray-100 focus:ring-gray-200"
                      }`}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">End Time</label>
                    <input
                      type="time"
                      required
                      value={newSession.endTime}
                      onChange={(e) => setNewSession({ ...newSession, endTime: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl font-bold focus:outline-none focus:ring-2 transition-all ${
                        isDarkMode ? "bg-white/5 focus:ring-white/20" : "bg-gray-100 focus:ring-gray-200"
                      }`}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Tag className="w-3 h-3" /> Main Task
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ERP Project"
                    value={newSession.mainTask}
                    onChange={(e) => setNewSession({ ...newSession, mainTask: e.target.value })}
                    className={`w-full px-4 py-3 rounded-xl font-bold focus:outline-none focus:ring-2 transition-all ${
                      isDarkMode ? "bg-white/5 focus:ring-white/20" : "bg-gray-100 focus:ring-gray-200"
                    }`}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <BookOpen className="w-3 h-3" /> Topic
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Finish Part 2"
                    value={newSession.topic}
                    onChange={(e) => setNewSession({ ...newSession, topic: e.target.value })}
                    className={`w-full px-4 py-3 rounded-xl font-bold focus:outline-none focus:ring-2 transition-all ${
                      isDarkMode ? "bg-white/5 focus:ring-white/20" : "bg-gray-100 focus:ring-gray-200"
                    }`}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all shadow-lg active:scale-95 mt-4"
                >
                  Save Session
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Download Modal */}
      <AnimatePresence>
        {isDownloadOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDownloadOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-md p-8 rounded-3xl shadow-2xl ${
                isDarkMode ? "bg-gray-900 text-white" : "bg-white text-gray-800"
              }`}
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold">Download CSV</h2>
                <button onClick={() => setIsDownloadOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.from}
                    onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                    className={`w-full px-4 py-3 rounded-xl font-bold focus:outline-none focus:ring-2 transition-all ${
                      isDarkMode ? "bg-white/5 focus:ring-white/20" : "bg-gray-100 focus:ring-gray-200"
                    }`}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.to}
                    onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                    className={`w-full px-4 py-3 rounded-xl font-bold focus:outline-none focus:ring-2 transition-all ${
                      isDarkMode ? "bg-white/5 focus:ring-white/20" : "bg-gray-100 focus:ring-gray-200"
                    }`}
                  />
                </div>

                <button
                  onClick={handleDownload}
                  className="w-full py-4 bg-teal-600 text-white rounded-2xl font-bold hover:bg-teal-700 transition-all shadow-lg active:scale-95 mt-4 flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Generate CSV
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
