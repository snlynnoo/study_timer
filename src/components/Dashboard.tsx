import React, { useState, useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
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
  isSameWeek,
  isSameMonth,
  isSameYear,
  isWithinInterval,
  startOfToday
} from "date-fns";
import { Session } from "../types";
import { LayoutGrid, Calendar, Clock, BookOpen, ChevronDown } from "lucide-react";

interface DashboardProps {
  sessions: Session[];
  isDarkMode?: boolean;
}

type TimeRange = "daily" | "weekly" | "monthly" | "yearly" | "custom";
type PieChartMode = "mainTask" | "topic";

interface SummaryItem {
  mainTask: string;
  topic: string;
  duration: number;
}

export default function Dashboard({ sessions, isDarkMode }: DashboardProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("daily");
  const [customStartDate, setCustomStartDate] = useState<string>(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [pieChartMode, setPieChartMode] = useState<PieChartMode>("topic");
  const [selectedBar, setSelectedBar] = useState<string | null>(null);

  const formatDuration = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // Filter sessions based on time range selector (Daily/Monthly/Yearly)
  const now = new Date();
  
  const parsedCustomStart = useMemo(() => {
    const d = parseISO(customStartDate);
    return isNaN(d.getTime()) ? subDays(now, 30) : d;
  }, [customStartDate, now]);

  const parsedCustomEnd = useMemo(() => {
    const d = parseISO(customEndDate);
    return isNaN(d.getTime()) ? now : d;
  }, [customEndDate, now]);

  const baseFilteredSessions = sessions.filter(s => {
    const sessionDate = parseISO(s.date);
    if (isNaN(sessionDate.getTime())) return false;

    if (timeRange === "daily") {
      return isSameDay(sessionDate, now);
    }
    if (timeRange === "weekly") return isSameWeek(sessionDate, now, { weekStartsOn: 1 });
    if (timeRange === "monthly") return isSameMonth(sessionDate, now);
    if (timeRange === "yearly") return isSameYear(sessionDate, now);
    if (timeRange === "custom") {
      try {
        const start = startOfDay(parsedCustomStart);
        const end = endOfDay(parsedCustomEnd);
        if (start > end) return false;
        return isWithinInterval(sessionDate, { start, end });
      } catch (e) {
        return false;
      }
    }
    return true;
  });

  // Data for the entire period (to populate the bar chart)
  let chartData: { name: string; hours: number; rawDate?: Date }[] = [];

  if (timeRange === "daily") {
    const last7Days = eachDayOfInterval({
      start: subDays(new Date(), 6),
      end: new Date(),
    });
    chartData = last7Days.map((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const daySessions = sessions.filter((s) => s.date === dateStr);
      const totalMinutes = daySessions.reduce((acc, s) => acc + s.duration, 0);
      return {
        name: format(date, "EEE"),
        hours: parseFloat((totalMinutes / 60).toFixed(2)),
        rawDate: date,
      };
    });
  } else if (timeRange === "weekly") {
    const weekStart = subDays(now, now.getDay() === 0 ? 6 : now.getDay() - 1);
    const weekDays = eachDayOfInterval({
      start: weekStart,
      end: now,
    });
    chartData = weekDays.map((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const daySessions = sessions.filter((s) => s.date === dateStr);
      const totalMinutes = daySessions.reduce((acc, s) => acc + s.duration, 0);
      return {
        name: format(date, "EEE"),
        hours: parseFloat((totalMinutes / 60).toFixed(2)),
        rawDate: date,
      };
    });
  } else if (timeRange === "custom") {
    try {
      const start = parsedCustomStart;
      const end = parsedCustomEnd;
      // Ensure start is not after end
      const actualStart = start <= end ? start : end;
      const actualEnd = start <= end ? end : start;

      const intervalDays = eachDayOfInterval({
        start: actualStart,
        end: actualEnd,
      });
      chartData = intervalDays.map((date) => {
        const dateStr = format(date, "yyyy-MM-dd");
        const daySessions = sessions.filter((s) => s.date === dateStr);
        const totalMinutes = daySessions.reduce((acc, s) => acc + s.duration, 0);
        return {
          name: format(date, intervalDays.length > 20 ? "dd/MM" : "d MMM"),
          hours: parseFloat((totalMinutes / 60).toFixed(2)),
          rawDate: date,
        };
      });
    } catch (e) {
      chartData = [];
    }
  } else if (timeRange === "monthly") {
    const monthDays = eachDayOfInterval({
      start: startOfMonth(now),
      end: endOfMonth(now),
    });
    chartData = monthDays.map((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const daySessions = sessions.filter((s) => s.date === dateStr);
      const totalMinutes = daySessions.reduce((acc, s) => acc + s.duration, 0);
      return {
        name: format(date, "d"),
        hours: parseFloat((totalMinutes / 60).toFixed(2)),
        rawDate: date,
      };
    });
  } else {
    const yearMonths = eachMonthOfInterval({
      start: startOfYear(now),
      end: endOfMonth(now),
    });
    chartData = yearMonths.map((date) => {
      const filteredByMonth = sessions.filter((s) => isSameMonth(parseISO(s.date), date));
      const totalMinutes = filteredByMonth.reduce((acc, s) => acc + s.duration, 0);
      return {
        name: format(date, "MMM"),
        hours: parseFloat((totalMinutes / 60).toFixed(2)),
        rawDate: date,
      };
    });
  }

  // Interactive filtering implementation:
  // If a bar is selected, we filter target components to that specific date/month.
  // Otherwise, we show the base selection (usually "today" for daily, "this month" for monthly).
  const interactivelyFilteredSessions = useMemo(() => {
    if (!selectedBar) return baseFilteredSessions;
    
    const correspondingItem = chartData.find(d => d.name === selectedBar);
    if (!correspondingItem?.rawDate) return baseFilteredSessions;

    const target = correspondingItem.rawDate;
    return sessions.filter(s => {
      const d = parseISO(s.date);
      if (timeRange === "daily" || timeRange === "weekly" || timeRange === "monthly" || timeRange === "custom") {
        return isSameDay(d, target);
      } else {
        return isSameMonth(d, target);
      }
    });
  }, [selectedBar, baseFilteredSessions, chartData, sessions, timeRange]);

  // Use interactivelyFilteredSessions for everything below these lines
  const summaryMap = interactivelyFilteredSessions.reduce((acc: Record<string, SummaryItem>, s: Session) => {
    // Trim and normalize to ensure robust merging of identical tasks/topics
    const task = (s.mainTask || "").trim();
    const subTopic = (s.topic || "").trim();
    const key = `${task.toLowerCase()}|||${subTopic.toLowerCase()}`;
    
    if (!acc[key]) {
      acc[key] = { mainTask: task, topic: subTopic, duration: 0 };
    }
    acc[key].duration += s.duration;
    return acc;
  }, {});

  const summaryData = (Object.values(summaryMap) as SummaryItem[]).sort((a, b) => b.duration - a.duration);

  const pieDataMap = interactivelyFilteredSessions.reduce((acc: Record<string, number>, s: Session) => {
    const rawValue = pieChartMode === "mainTask" ? s.mainTask : s.topic;
    const key = (rawValue || "").trim();
    acc[key] = (acc[key] || 0) + s.duration;
    return acc;
  }, {});

  const pieData = Object.entries(pieDataMap).map(([name, value]: [string, number]) => ({
    name,
    value: parseFloat((value / 60).toFixed(2)),
    rawMinutes: value
  }));

  const COLORS = ["#f43f5e", "#14b8a6", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ec4899", "#10b981", "#6366f1"];

  const totalMinutes = interactivelyFilteredSessions.reduce((acc: number, s: Session) => acc + s.duration, 0);
  const totalHours = totalMinutes / 60;
  const sessionCount = interactivelyFilteredSessions.length;
  const uniqueTopics = Object.keys(pieDataMap).length;

  const handleChartClick = (state: any) => {
    if (state && state.activeLabel) {
      setSelectedBar(prev => prev === state.activeLabel ? null : state.activeLabel);
    } else if (state && state.activePayload && state.activePayload.length > 0) {
      const label = state.activePayload[0].payload.name;
      setSelectedBar(prev => prev === label ? null : label);
    }
  };

  const currentSelectionLabel = selectedBar 
    ? (timeRange === "yearly" ? `Month: ${selectedBar}` : `Day: ${selectedBar}`)
    : (timeRange === "daily" ? "Today" : 
       timeRange === "weekly" ? "This Week" : 
       timeRange === "monthly" ? "This Month" : 
       timeRange === "yearly" ? "This Year" :
       `${format(parsedCustomStart, "MMM d")} - ${format(parsedCustomEnd, "MMM d")}`);

  const renderCustomizedPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius * 1.3;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    const isLeft = x < cx;

    return (
      <text
        x={x}
        y={y}
        fill={isDarkMode ? "#ffffff" : "#1f2937"}
        textAnchor={isLeft ? "end" : "start"}
        className="text-[12px] font-bold"
      >
        <tspan x={x} dy="-0.2em">
          {name.length > 20 ? name.substring(0, 18) + "..." : name}
        </tspan>
        <tspan 
          x={x} 
          dy="1.4em" 
          fill={isDarkMode ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.7)"}
          fontSize="11px"
          fontWeight="bold"
        >
          {`${(percent * 100).toFixed(1)}%`}
        </tspan>
      </text>
    );
  };

  return (
    <div className="w-full max-w-6xl mt-6 space-y-8">
      {/* Time Range Selector */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-white/10 backdrop-blur p-1 rounded-2xl border border-white/20 flex gap-0.5 sm:gap-1">
              {(["daily", "weekly", "monthly", "yearly", "custom"] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => {
                    setTimeRange(range);
                    setSelectedBar(null);
                  }}
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

            {timeRange === "custom" && (
              <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                <input 
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-transparent text-white text-[10px] font-bold outline-none px-2 py-1"
                />
                <span className="text-white/40 text-[10px]">to</span>
                <input 
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-transparent text-white text-[10px] font-bold outline-none px-2 py-1"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <p className="text-white/60 text-[10px] uppercase tracking-widest font-bold bg-white/5 px-4 py-2 rounded-full border border-white/10">
              Showing stats for: <span className="text-white">{currentSelectionLabel}</span>
            </p>
            {selectedBar && (
              <button 
                onClick={() => setSelectedBar(null)} 
                className="text-[10px] uppercase tracking-widest font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 px-3 py-2 rounded-full border border-rose-500/20 transition-all flex items-center gap-1"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title={`${timeRange} Time`} value={formatDuration(totalMinutes)} icon={<Clock className="w-5 h-5" />} isDarkMode={isDarkMode} />
        <StatCard title="Sessions" value={sessionCount.toString()} icon={<LayoutGrid className="w-5 h-5" />} isDarkMode={isDarkMode} />
        <StatCard title={pieChartMode === "mainTask" ? "Main Tasks" : "Topics"} value={uniqueTopics.toString()} icon={<BookOpen className="w-5 h-5" />} isDarkMode={isDarkMode} />
        <StatCard title="Avg Session" value={sessionCount ? `${(totalHours / sessionCount * 60).toFixed(0)}m` : "0m"} icon={<Calendar className="w-5 h-5" />} isDarkMode={isDarkMode} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Daily Activity Chart */}
        <div className={`p-6 rounded-3xl shadow-xl border ${isDarkMode ? "bg-white/10 border-white/10" : "bg-gray-50 border-gray-100"}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
              {timeRange === "daily" ? "Daily Activity (Last 7 Days)" : timeRange === "weekly" ? "Weekly Activity (This Week Mon-Sun)" : timeRange === "monthly" ? "Daily Activity (Current Month)" : "Monthly Activity (Current Year)"}
            </h3>
            {selectedBar && <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest animate-pulse">Filtering Active</span>}
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} onClick={handleChartClick}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "rgba(255,255,255,0.05)" : "#f1f5f9"} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDarkMode ? "rgba(255,255,255,0.4)" : "#64748b", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: isDarkMode ? "rgba(255,255,255,0.4)" : "#64748b", fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }}
                  contentStyle={{ 
                    borderRadius: "12px", 
                    border: "none", 
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
                    color: isDarkMode ? "#ffffff" : "#000000"
                  }}
                  formatter={(value: any) => [`${value}h`, "Time"]}
                />
                <Bar 
                  dataKey="hours" 
                  radius={[4, 4, 0, 0]} 
                  className="cursor-pointer"
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={selectedBar === entry.name ? "#f43f5e" : (isDarkMode ? "rgba(244, 63, 94, 0.4)" : "rgba(244, 63, 94, 0.2)")}
                    />
                  ))}
                </Bar>
                <Line 
                  type="monotone" 
                  dataKey="hours" 
                  stroke="#14b8a6" 
                  strokeWidth={2} 
                  dot={{ r: 2, fill: "#14b8a6" }} 
                  activeDot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-gray-500 mt-4 text-center">Click on a bar to filter summary & distribution below</p>
        </div>

        {/* Topic Distribution Chart */}
        <div className={`p-6 rounded-3xl shadow-xl border ${isDarkMode ? "bg-white/10 border-white/10" : "bg-gray-50 border-gray-100"}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}>Distribution</h3>
            <div className={`flex p-1 rounded-xl border relative z-10 ${isDarkMode ? "bg-white/10 border-white/20" : "bg-gray-200 border-gray-300"}`}>
              <button 
                onClick={(e) => { 
                  e.preventDefault();
                  e.stopPropagation(); 
                  setPieChartMode("mainTask"); 
                }}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer relative z-20 ${
                  pieChartMode === "mainTask" 
                    ? "bg-white text-gray-900 shadow-lg" 
                    : (isDarkMode ? "text-white/80 hover:text-white" : "text-gray-900/70 hover:text-gray-900")
                }`}
              >
                Task
              </button>
              <button 
                onClick={(e) => { 
                  e.preventDefault();
                  e.stopPropagation(); 
                  setPieChartMode("topic"); 
                }}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer relative z-20 ${
                  pieChartMode === "topic" 
                    ? "bg-white text-gray-900 shadow-lg" 
                    : (isDarkMode ? "text-white/80 hover:text-white" : "text-gray-900/70 hover:text-gray-900")
                }`}
              >
                Topic
              </button>
            </div>
          </div>
          <div className="h-64 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={renderCustomizedPieLabel}
                  labelLine={true}
                >
                  {pieData.map((entry, index) => (
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
                  formatter={(value: any, name: any, props: any) => [formatDuration(props.payload.rawMinutes), name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Summary Table */}
        <div className={`col-span-1 md:col-span-2 p-6 rounded-3xl shadow-xl border overflow-hidden ${isDarkMode ? "bg-white/10 border-white/10" : "bg-gray-50 border-gray-100"}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
              Task & Topic Summary ({currentSelectionLabel})
            </h3>
            <span className={`px-3 py-1 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-bold uppercase tracking-widest`}>
              {summaryData.length} entries
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={`border-b ${isDarkMode ? "border-white/10" : "border-gray-100"}`}>
                  <th className="pb-2 font-bold text-gray-400 text-xs uppercase tracking-widest">Main Task</th>
                  <th className="pb-2 font-bold text-gray-400 text-xs uppercase tracking-widest">Topic</th>
                  <th className="pb-2 font-bold text-gray-400 text-xs uppercase tracking-widest text-right">Total Time</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? "divide-white/5" : "divide-gray-50"}`}>
                {summaryData.map((item, idx) => (
                  <tr key={idx} className={`group transition-colors ${isDarkMode ? "hover:bg-white/5" : "hover:bg-gray-50"}`}>
                    <td className={`py-2 font-bold ${isDarkMode ? "text-white" : "text-gray-800"}`}>{item.mainTask}</td>
                    <td className={`py-2 ${isDarkMode ? "text-white/60" : "text-gray-600"}`}>{item.topic}</td>
                    <td className="py-2 text-right font-mono font-bold text-rose-500">
                      {formatDuration(item.duration)}
                    </td>
                  </tr>
                ))}
                {summaryData.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-gray-400 font-medium">
                      No study data available for this selection.
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
