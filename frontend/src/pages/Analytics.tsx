import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Trophy, Dumbbell, 
  Target,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import { format, parseISO, eachDayOfInterval, isSameDay } from 'date-fns';
import Layout from '../components/Layout';
import { useUser } from '../contexts/UserContext';
import { cn } from '../lib/utils';

interface ExercisePR {
  name: string;
  weight: number;
  date: string;
}

export default function Analytics() {
  const { t } = useTranslation();
  const { user } = useUser();
  const [history, setHistory] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState('7d');

  const fetchAnalyticsData = () => {
    fetch('/api/workouts/history?user_id=1')
      .then(res => res.json())
      .then(data => {
        setHistory(Array.isArray(data) ? data : []);
      })
      .catch(err => {
        console.error("Failed to fetch history:", err);
      });
  };

  useEffect(() => {
    fetchAnalyticsData();

    // Auto-refresh every 10 seconds to keep charts up to date
    const interval = setInterval(fetchAnalyticsData, 10000);
    return () => clearInterval(interval);
  }, []);

  // 1. Calculate Volume Chart Data (Last 7 Days)
  const getVolumeData = () => {
    const days = eachDayOfInterval({
      start: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      end: new Date()
    });

    return days.map(day => {
      let dailyVolume = 0;
      history.forEach(workout => {
        const workoutDate = parseISO(workout.date);
        if (isSameDay(workoutDate, day)) {
          workout.logs?.forEach((log: any) => {
            dailyVolume += (log.weight_kg * log.reps * (log.sets || 1));
          });
        }
      });
      return {
        name: format(day, 'EEE'),
        date: format(day, 'MMM d'),
        volume: dailyVolume
      };
    });
  };

  // 2. Calculate Personal Bests
  const getPersonalBests = (): ExercisePR[] => {
    const prs: { [key: string]: ExercisePR } = {};
    
    history.forEach(workout => {
      workout.logs?.forEach((log: any) => {
        if (!log.exercise) return;
        const name = log.exercise.name;
        const weight = log.weight_kg;
        
        if (!prs[name] || weight > prs[name].weight) {
          prs[name] = {
            name,
            weight,
            date: format(parseISO(workout.date), 'MMM d, yyyy')
          };
        }
      });
    });
    
    return Object.values(prs).sort((a, b) => b.weight - a.weight).slice(0, 6);
  };

  // 3. Calculate Exercise Distribution
  const getDistribution = () => {
    const counts: { [key: string]: number } = {};
    history.forEach(workout => {
      workout.logs?.forEach((log: any) => {
        if (!log.exercise) return;
        counts[log.exercise.name] = (counts[log.exercise.name] || 0) + 1;
      });
    });
    
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  const volumeData = getVolumeData();
  const personalBests = getPersonalBests();
  const distribution = getDistribution();

  // Summary Metrics
  const totalVolume = history.reduce((acc, w) => {
    return acc + (w.logs?.reduce((lAcc: number, l: any) => lAcc + (l.weight_kg * l.reps * (l.sets || 1)), 0) || 0);
  }, 0);

  const avgVolumePerSession = history.length > 0 ? Math.round(totalVolume / history.length) : 0;
  
  const lastSessionVolume = history.length > 0 
    ? history[0].logs?.reduce((acc: number, l: any) => acc + (l.weight_kg * l.reps * (l.sets || 1)), 0) || 0
    : 0;

  const previousSessionVolume = history.length > 1
    ? history[1].logs?.reduce((acc: number, l: any) => acc + (l.weight_kg * l.reps * (l.sets || 1)), 0) || 0
    : 0;

  const volumeTrend = previousSessionVolume > 0 
    ? Math.round(((lastSessionVolume - previousSessionVolume) / previousSessionVolume) * 100)
    : 0;

  return (
    <Layout>
      <div className="space-y-6 lg:space-y-8 max-w-6xl mx-auto pb-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">{t('nav.progress')}</h1>
            <p className="text-slate-400 mt-1 text-sm">Performance and physical gains.</p>
          </div>
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl self-start sm:self-auto">
            {['7d', '30d', 'All'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  "px-3 lg:px-4 py-1.5 text-[10px] lg:text-xs font-bold rounded-lg transition-all",
                  timeRange === range ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                )}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Top Level Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          <div className="bg-slate-900 border border-slate-800 p-5 lg:p-6 rounded-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Trophy className="w-4 h-4 lg:w-5 lg:h-5 text-blue-500" />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Volume</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl lg:text-3xl font-bold text-white">{totalVolume.toLocaleString()}</span>
              <span className="text-xs text-slate-500 font-medium">kg</span>
            </div>
            <div className="mt-4 flex items-center gap-1.5">
              {volumeTrend >= 0 ? <ArrowUpRight className="w-4 h-4 text-emerald-500" /> : <ArrowDownRight className="w-4 h-4 text-red-500" />}
              <span className={cn("text-sm font-bold", volumeTrend >= 0 ? "text-emerald-500" : "text-red-500")}>
                {Math.abs(volumeTrend)}%
              </span>
              <span className="text-[10px] text-slate-500 ml-1">vs last session</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 lg:p-6 rounded-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Dumbbell className="w-4 h-4 lg:w-5 lg:h-5 text-purple-500" />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg. Session</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl lg:text-3xl font-bold text-white">{avgVolumePerSession.toLocaleString()}</span>
              <span className="text-xs text-slate-500 font-medium">kg</span>
            </div>
            <p className="mt-4 text-[10px] text-slate-500">Over {history.length} sessions</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 lg:p-6 rounded-2xl sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Target className="w-4 h-4 lg:w-5 lg:h-5 text-emerald-500" />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Weight</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl lg:text-3xl font-bold text-white">{user?.current_weight || '--'}</span>
              <span className="text-xs text-slate-500 font-medium">kg</span>
            </div>
            <div className="mt-4 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-emerald-500" 
                 style={{ width: user ? `${Math.min(100, (user.current_weight / user.target_weight) * 100)}%` : '0%' }}
               />
            </div>
            <p className="mt-2 text-[10px] text-slate-500 flex justify-between">
              <span>Goal: {user?.target_weight}kg</span>
              <span>{user ? Math.round((user.current_weight / user.target_weight) * 100) : 0}%</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          
          {/* Main Volume Chart */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-5 lg:p-6 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-base lg:text-lg text-white">Lifting Volume Trend</h3>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm" />
                  Total kg/day
                </div>
              </div>
              <div className="h-64 lg:h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={volumeData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#64748b', fontSize: 10}}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#64748b', fontSize: 10}}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px' }}
                      itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="volume" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorVol)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Distribution */}
            <div className="bg-slate-900 border border-slate-800 p-5 lg:p-6 rounded-2xl shadow-sm">
              <h3 className="font-semibold text-base lg:text-lg text-white mb-6">Exercise Frequency</h3>
              <div className="h-56 lg:h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distribution} layout="vertical" margin={{ left: -10 }}>
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#94a3b8', fontSize: 10}}
                      width={100}
                    />
                    <Tooltip 
                      cursor={{fill: 'transparent'}}
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px' }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={16}>
                      {distribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#1e293b'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Sidebar: Personal Bests */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-5 lg:p-6 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <h3 className="font-semibold text-lg text-white">Personal Bests</h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 lg:space-y-4">
                {personalBests.length === 0 ? (
                  <p className="text-sm text-slate-500 italic sm:col-span-2">Log workouts to see your PRs!</p>
                ) : (
                  personalBests.map((pr, idx) => (
                    <div key={idx} className="group p-4 bg-slate-950 border border-slate-800 rounded-xl hover:border-blue-500/50 transition-colors">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 truncate">{pr.name}</p>
                      <div className="flex items-end justify-between">
                        <span className="text-lg lg:text-xl font-bold text-white">{pr.weight} <span className="text-xs font-medium text-slate-400">kg</span></span>
                        <span className="text-[10px] text-slate-500 mb-1">{pr.date}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <button className="w-full mt-6 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors uppercase tracking-wider">
                View All PRs
              </button>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-5 lg:p-6 rounded-2xl shadow-lg text-white">
              <h4 className="font-bold text-lg mb-2">Keep it up!</h4>
              <p className="text-blue-100 text-xs lg:text-sm leading-relaxed mb-4">
                Total volume +12% vs last week. Most improved: <strong>Bulgarian Split Squats</strong>.
              </p>
              <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl">
                <p className="text-[10px] uppercase font-bold text-blue-200 mb-1">Upcoming Milestone</p>
                <div className="flex justify-between items-center">
                  <span className="text-xs lg:text-sm font-bold">1,000kg Total Lifted</span>
                  <span className="text-[10px]">850/1000</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
