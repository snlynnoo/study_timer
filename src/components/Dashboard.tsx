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
import { PALETTE } from "../lib/palette";
import {buildDistribution} from '../lib/distribution';
import { LayoutGrid, Calendar, Clock, BookOpen, ChevronDown,ArrowDownWideNarrow,ArrowUpNarrowWide } from "lucide-react";

interface DashboardProps {
  sessions: Session[];
  isDarkMode?: boolean;
}

type TimeRange = "daily" | "weekly" | "monthly" | "yearly" | "custom";
type DistributionMode = "mainTask" | "topic";

interface SummaryItem {
  mainTask: string;
  topic: string;
  duration: number;
}

export default function Dashboard({ sessions, isDarkMode }: DashboardProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("daily");
  const [customStartDate, setCustomStartDate] = useState<string>(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [distributionMode, setDistributionMode] = useState<DistributionMode>("topic");
  const [selectedBar, setSelectedBar] = useState<string | null>(null);
  const [distributionOrder,setDistributionOrder]=useState<"asc"|"desc">("desc");

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

  const distributionData=buildDistribution(interactivelyFilteredSessions,distributionMode,distributionOrder);
  const maxDistributionMinutes=Math.max(0,...distributionData.map(item=>item.minutes));

  const totalMinutes = interactivelyFilteredSessions.reduce((acc: number, s: Session) => acc + s.duration, 0);
  const totalHours = totalMinutes / 60;
  const sessionCount = interactivelyFilteredSessions.length;
  const uniqueTopics = distributionData.length;

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

  return (
    <div className="stats-page w-full max-w-6xl mt-6 space-y-8">
      {/* Time Range Selector */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-white p-1 rounded-2xl border border-slate-200 flex gap-0.5 sm:gap-1">
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
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>

            {timeRange === "custom" && (
              <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-transparent text-slate-600 text-xs font-bold outline-none px-2 py-1"
                />
                <span className="text-slate-400 text-xs">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-transparent text-slate-600 text-xs font-bold outline-none px-2 py-1"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <p className="text-slate-400 text-xs uppercase tracking-widest font-bold bg-white px-4 py-2 rounded-full border border-slate-200">
              Showing stats for: <span className="text-slate-700">{currentSelectionLabel}</span>
            </p>
            {selectedBar && (
              <button
                onClick={() => setSelectedBar(null)}
                className="text-xs uppercase tracking-widest font-bold text-teal-400 hover:text-teal-300 bg-teal-500/10 px-3 py-2 rounded-full border border-teal-500/20 transition-all flex items-center gap-1"
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
        <StatCard title={distributionMode === "mainTask" ? "Main" : "Sub"} value={uniqueTopics.toString()} icon={<BookOpen className="w-5 h-5" />} isDarkMode={isDarkMode} />
        <StatCard title="Avg Session" value={sessionCount ? `${(totalHours / sessionCount * 60).toFixed(0)}m` : "0m"} icon={<Calendar className="w-5 h-5" />} isDarkMode={isDarkMode} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Daily Activity Chart */}
        <div className={`p-6 rounded-3xl shadow-xl border ${isDarkMode ? "bg-white/10 border-white/10" : "bg-gray-50 border-gray-100"}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
              {timeRange === "daily" ? "Daily Activity (Last 7 Days)" : timeRange === "weekly" ? "Weekly Activity (This Week Mon-Sun)" : timeRange === "monthly" ? "Daily Activity (Current Month)" : "Monthly Activity (Current Year)"}
            </h3>
            {selectedBar && <span className="text-xs font-bold text-teal-500 uppercase tracking-widest animate-pulse">Filtering Active</span>}
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} onClick={handleChartClick}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "rgba(255,255,255,0.05)" : "#f1f5f9"} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDarkMode ? "rgba(255,255,255,0.4)" : "#64748b", fontSize: "0.875rem" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: isDarkMode ? "rgba(255,255,255,0.4)" : "#64748b", fontSize: "0.875rem" }} />
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
                      fill={selectedBar === entry.name ? PALETTE.orange : PALETTE.teal}
                    />
                  ))}
                </Bar>
                <Line
                  type="monotone"
                  dataKey="hours"
                  stroke={PALETTE.blue}
                  strokeWidth={2}
                  dot={{ r: 2, fill: PALETTE.blue }}
                  activeDot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-500 mt-4 text-center">Click on a bar to filter summary & distribution below</p>
        </div>

        {/* Horizontal distribution, one readable row per category. */}
        <section className={`distribution-panel p-6 rounded-3xl shadow-xl border ${isDarkMode ? "bg-white/10 border-white/10" : "bg-gray-50 border-gray-100"}`} aria-labelledby="distribution-heading">
          <div className="distribution-heading">
            <h3 id="distribution-heading" className="text-lg font-semibold">Distribution</h3>
            <div className="distribution-controls">
              <button type="button" className="distribution-sort-toggle" aria-label={distributionOrder==='asc'?'Sort descending':'Sort ascending'} title={`${distributionOrder==='asc'?'Ascending':'Descending'} by focus time. Click to reverse.`} onClick={()=>setDistributionOrder(order=>order==='asc'?'desc':'asc')}>
                {distributionOrder==='asc'?<ArrowUpNarrowWide size={18}/>:<ArrowDownWideNarrow size={18}/>}
              </button>
              <div className="distribution-mode" role="group" aria-label="Distribution categories">
                <button type="button" aria-pressed={distributionMode==='mainTask'} onClick={()=>setDistributionMode('mainTask')}>Main</button>
                <button type="button" aria-pressed={distributionMode==='topic'} onClick={()=>setDistributionMode('topic')}>Sub</button>
              </div>
            </div>
          </div>
          {distributionData.length?<div className="distribution-scroll" tabIndex={0} role="region" aria-label={`${distributionMode==='mainTask'?'Main':'Sub'} distribution, ${distributionOrder==='asc'?'ascending':'descending'} by focus time`}>
            <ol className="distribution-rows">{distributionData.map(item=>{
              const percent=totalMinutes>0?item.minutes/totalMinutes*100:0;
              return <li key={item.name} className="distribution-row">
                <div className="distribution-row-caption"><span>{item.name}</span><strong>{formatDuration(item.minutes)} <small>({percent.toFixed(1)}%)</small></strong></div>
                <div className="distribution-track" aria-hidden="true"><span style={{width:`${maxDistributionMinutes>0?item.minutes/maxDistributionMinutes*100:0}%`}}/></div>
              </li>;
            })}</ol>
          </div>:<p className="distribution-empty">No study data available for this selection.</p>}
        </section>

        {/* Summary Table */}
        <div className={`col-span-1 md:col-span-2 p-6 rounded-3xl shadow-xl border overflow-hidden ${isDarkMode ? "bg-white/10 border-white/10" : "bg-gray-50 border-gray-100"}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
              Task & Topic Summary ({currentSelectionLabel})
            </h3>
            <span className={`px-3 py-1 rounded-full bg-teal-500/10 text-teal-500 text-xs font-bold uppercase tracking-widest`}>
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
                    <td className="py-2 text-right font-mono font-bold text-teal-500">
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
        <div className="text-teal-500">{icon}</div>
      </div>
      <p className={`text-3xl font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}
