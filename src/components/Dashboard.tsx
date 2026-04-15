import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { 
  format, 
  parseISO, 
  startOfDay, 
  endOfDay, 
  eachDayOfInterval, 
  subDays, 
  startOfMonth, 
  endOfMonth, 
  eachMonthOfInterval, 
  startOfYear, 
  subMonths,
  isSameDay,
  isSameMonth,
  isSameYear
} from "date-fns";
import { Session } from "../types";
import { LayoutGrid, Calendar, Clock, BookOpen } from "lucide-react";

interface DashboardProps {
  sessions: Session[];
  isDarkMode?: boolean;
}

type TimeRange = "daily" | "monthly" | "yearly";

export default function Dashboard({ sessions, isDarkMode }: DashboardProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("daily");

  // Filter sessions based on time range
  const now = new Date();
  const filteredSessions = sessions.filter(s => {
    const sessionDate = parseISO(s.date);
    if (timeRange === "daily") return isSameDay(sessionDate, now);
    if (timeRange === "monthly") return isSameMonth(sessionDate, now);
    if (timeRange === "yearly") return isSameYear(sessionDate, now);
    return true;
  });

  // Process data for charts
  const last7Days = eachDayOfInterval({
    start: subDays(new Date(), 6),
    end: new Date(),
  });

  const dailyData = last7Days.map((date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const daySessions = sessions.filter((s) => s.date === dateStr);
    const totalMinutes = daySessions.reduce((acc, s) => acc + s.duration, 0);
    return {
      name: format(date, "EEE"),
      hours: parseFloat((totalMinutes / 60).toFixed(2)),
    };
  });

  // Summary Table Data
  const summaryMap = sessions.reduce((acc: Record<string, { mainTask: string; topic: string; duration: number }>, s) => {
    const key = `${s.mainTask}-${s.topic}`;
    if (!acc[key]) {
      acc[key] = { mainTask: s.mainTask, topic: s.topic, duration: 0 };
    }
    acc[key].duration += s.duration;
    return acc;
  }, {});

  const summaryData = Object.values(summaryMap).sort((a, b) => b.duration - a.duration);

  const topicDataMap = filteredSessions.reduce((acc: Record<string, number>, s) => {
    acc[s.topic] = (acc[s.topic] || 0) + s.duration;
    return acc;
  }, {});

  const topicData = Object.entries(topicDataMap).map(([name, value]) => ({
    name,
    value: parseFloat((value / 60).toFixed(2)),
  }));

  const COLORS = ["#f43f5e", "#14b8a6", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ec4899"];

  const totalHours = filteredSessions.reduce((acc, s) => acc + s.duration, 0) / 60;
  const sessionCount = filteredSessions.length;
  const uniqueTopics = Object.keys(topicDataMap).length;

  return (
    <div className="w-full max-w-6xl mt-12 space-y-8">
      {/* Time Range Selector */}
      <div className="flex justify-center">
        <div className="bg-white/10 backdrop-blur p-1 rounded-2xl border border-white/20 flex gap-0.5 sm:gap-1">
          {(["daily", "monthly", "yearly"] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-bold capitalize transition-all shrink-0 ${
                timeRange === range
                  ? "bg-white text-gray-900 shadow-lg"
                  : "text-white hover:bg-white/10"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title={`${timeRange} Hours`} value={`${totalHours.toFixed(1)}h`} icon={<Clock className="w-5 h-5" />} isDarkMode={isDarkMode} />
        <StatCard title="Sessions" value={sessionCount.toString()} icon={<LayoutGrid className="w-5 h-5" />} isDarkMode={isDarkMode} />
        <StatCard title="Topics" value={uniqueTopics.toString()} icon={<BookOpen className="w-5 h-5" />} isDarkMode={isDarkMode} />
        <StatCard title="Avg Session" value={sessionCount ? `${(totalHours / sessionCount * 60).toFixed(0)}m` : "0m"} icon={<Calendar className="w-5 h-5" />} isDarkMode={isDarkMode} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Daily Activity Chart */}
        <div className={`p-6 rounded-3xl shadow-xl border ${isDarkMode ? "bg-white/10 border-white/10" : "bg-gray-50 border-gray-100"}`}>
          <h3 className={`text-lg font-semibold mb-6 ${isDarkMode ? "text-white" : "text-gray-800"}`}>Daily Activity (Last 7 Days)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "rgba(255,255,255,0.05)" : "#f1f5f9"} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDarkMode ? "rgba(255,255,255,0.4)" : "#64748b", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: isDarkMode ? "rgba(255,255,255,0.4)" : "#64748b", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ 
                    borderRadius: "12px", 
                    border: "none", 
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
                    color: isDarkMode ? "#ffffff" : "#000000"
                  }}
                />
                <Bar dataKey="hours" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Topic Distribution Chart */}
        <div className={`p-6 rounded-3xl shadow-xl border ${isDarkMode ? "bg-white/10 border-white/10" : "bg-gray-50 border-gray-100"}`}>
          <h3 className={`text-lg font-semibold mb-6 ${isDarkMode ? "text-white" : "text-gray-800"}`}>Time per Topic ({timeRange})</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topicData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {topicData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ 
                    borderRadius: "12px", 
                    border: "none", 
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
                    color: isDarkMode ? "#ffffff" : "#000000"
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Summary Table */}
        <div className={`col-span-1 md:col-span-2 p-6 rounded-3xl shadow-xl border overflow-hidden ${isDarkMode ? "bg-white/10 border-white/10" : "bg-gray-50 border-gray-100"}`}>
          <h3 className={`text-lg font-semibold mb-6 ${isDarkMode ? "text-white" : "text-gray-800"}`}>Task & Topic Summary (Total)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={`border-b ${isDarkMode ? "border-white/10" : "border-gray-100"}`}>
                  <th className="pb-4 font-bold text-gray-400 text-xs uppercase tracking-widest">Main Task</th>
                  <th className="pb-4 font-bold text-gray-400 text-xs uppercase tracking-widest">Topic</th>
                  <th className="pb-4 font-bold text-gray-400 text-xs uppercase tracking-widest text-right">Total Time</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? "divide-white/5" : "divide-gray-50"}`}>
                {summaryData.slice(0, 10).map((item, idx) => (
                  <tr key={idx} className={`group transition-colors ${isDarkMode ? "hover:bg-white/5" : "hover:bg-gray-50"}`}>
                    <td className={`py-4 font-bold ${isDarkMode ? "text-white" : "text-gray-800"}`}>{item.mainTask}</td>
                    <td className={`py-4 ${isDarkMode ? "text-white/60" : "text-gray-600"}`}>{item.topic}</td>
                    <td className="py-4 text-right font-mono font-bold text-rose-500">
                      {(item.duration / 60).toFixed(1)}h
                    </td>
                  </tr>
                ))}
                {summaryData.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-gray-400 font-medium">
                      No study data available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, isDarkMode }: { title: string; value: string; icon: React.ReactNode; isDarkMode?: boolean }) {
  return (
    <div className={`p-6 rounded-2xl shadow-lg border ${isDarkMode ? "bg-white/10 border-white/10" : "bg-gray-50 border-gray-100"}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{title}</p>
        <div className="text-rose-500">{icon}</div>
      </div>
      <p className={`text-3xl font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}
