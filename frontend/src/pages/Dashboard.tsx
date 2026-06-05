import React, { useEffect, useState } from 'react';
import { ChevronRight, Dumbbell, Flame, Trophy, Apple, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { cn } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { useUser } from '../contexts/UserContext';
import { useUI } from '../contexts/UIContext';

const volumeData = [
  { name: 'Mon', volume: 4000 },
  { name: 'Tue', volume: 3000 },
  { name: 'Wed', volume: 5000 },
  { name: 'Thu', volume: 2780 },
  { name: 'Fri', volume: 6890 },
  { name: 'Sat', volume: 8390 },
  { name: 'Sun', volume: 9490 },
];

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, refreshUser } = useUser();
  const { toast } = useUI();
  const [history, setHistory] = useState<any[]>([]);
  const [nutritionLogs, setNutritionLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showWeightPrompt, setShowWeightPrompt] = useState(false);
  const [newWeight, setNewWeight] = useState('');

  const goal = user?.goal_calories || 2500;
  const proteinGoal = user?.goal_protein || 150;
  const carbsGoal = user?.goal_carbs || 250;
  const fatGoal = user?.goal_fat || 80;

  useEffect(() => {
    Promise.all([
      fetch('/api/workouts/history?user_id=1').then(res => res.json()),
      fetch('/api/nutrition?user_id=1').then(res => res.json())
    ])
    .then(([workoutsData, nutritionData]) => {
      setHistory(Array.isArray(workoutsData) ? workoutsData : []);
      setNutritionLogs(Array.isArray(nutritionData) ? nutritionData : []);
      setLoading(false);
    })
    .catch(err => {
      console.error("Failed to fetch dashboard data:", err);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (user && user.last_weight_update) {
      const lastUpdate = new Date(user.last_weight_update).getTime();
      const daysSinceUpdate = (Date.now() - lastUpdate) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate >= 7) {
        setShowWeightPrompt(true);
      }
    } else if (user) {
      // If no last_weight_update but user exists, prompt them
      setShowWeightPrompt(true);
    }
  }, [user]);

  const calculateAge = (dob: string) => {
    if (!dob) return 30;
    const diff_ms = Date.now() - new Date(dob).getTime();
    const age_dt = new Date(diff_ms); 
    return Math.abs(age_dt.getUTCFullYear() - 1970);
  };

  const handleWeightUpdate = async () => {
    if (!user || !newWeight) return;

    const weight = parseFloat(newWeight);
    const targetWeight = user.target_weight;
    const height = user.height;
    const age = calculateAge(user.birth_date);
    const activity = parseFloat(user.activity_level) || 1.375;

    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr += user.gender === 'male' ? 5 : -161;

    const tdee = bmr * activity;

    let calories = tdee;
    if (targetWeight < weight) calories -= 500; 
    else if (targetWeight > weight) calories += 500; 

    calories = Math.round(calories);

    const protein = Math.round(targetWeight * 2.2);
    const fat = Math.round(targetWeight * 1.0);
    const proteinCals = protein * 4;
    const fatCals = fat * 9;
    const remainingCals = calories - proteinCals - fatCals;
    const carbs = Math.max(0, Math.round(remainingCals / 4));

    try {
      await fetch('/api/user/1/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...user,
          current_weight: weight,
          goal_calories: calories,
          goal_protein: protein,
          goal_carbs: carbs,
          goal_fat: fat,
          last_weight_update: new Date().toISOString()
        })
      });
      
      toast(t('dashboard.weightUpdated') || 'Weight and goals updated successfully!', 'success');
      setShowWeightPrompt(false);
      refreshUser();
    } catch (err) {
      console.error(err);
      toast('Failed to update weight', 'error');
    }
  };

  // Calculate dynamic stats
  const totalWorkouts = history.length;
  
  let totalVolume = 0;
  if (Array.isArray(history)) {
    history.forEach(w => {
      if (w.logs && Array.isArray(w.logs)) {
        w.logs.forEach((log: any) => {
          totalVolume += ((log.reps || 0) * (log.weight_kg || 0) * (log.sets || 1));
        });
      }
    });
  }

  const displayVolume = totalVolume > 0 ? `${totalVolume} kg` : "0 kg";
  const displayStreak = totalWorkouts > 0 ? "1 Day" : "0 Days";

  // Calculate today's nutrition
  const consumedCals = Array.isArray(nutritionLogs) ? nutritionLogs.reduce((sum, item) => sum + (item.calories || 0), 0) : 0;
  const consumedP = Array.isArray(nutritionLogs) ? nutritionLogs.reduce((sum, item) => sum + (item.protein || 0), 0) : 0;
  const consumedC = Array.isArray(nutritionLogs) ? nutritionLogs.reduce((sum, item) => sum + (item.carbs || 0), 0) : 0;
  const consumedF = Array.isArray(nutritionLogs) ? nutritionLogs.reduce((sum, item) => sum + (item.fat || 0), 0) : 0;

  // Flat chart if no history
  const chartData = totalWorkouts === 0 ? [
    { name: 'Mon', volume: 0 },
    { name: 'Tue', volume: 0 },
    { name: 'Wed', volume: 0 },
    { name: 'Thu', volume: 0 },
    { name: 'Fri', volume: 0 },
    { name: 'Sat', volume: 0 },
    { name: 'Sun', volume: 0 },
  ] : volumeData;

  return (
    <Layout>
      <div className="space-y-8 pb-20">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">{t('dashboard.progress.title')}</h1>
            <p className="text-slate-400 mt-1">{t('dashboard.progress.subtitle')}</p>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <StatCard title={t('dashboard.stats.workouts')} value={totalWorkouts.toString()} icon={<Dumbbell className="w-5 h-5 text-blue-500"/>} trend={totalWorkouts > 0 ? "+1" : "0"} positive={totalWorkouts > 0} />
          <StatCard title={t('dashboard.stats.streak')} value={displayStreak} icon={<Flame className="w-5 h-5 text-orange-500"/>} trend={totalWorkouts > 0 ? t('dashboard.stats.streak.msg') : "Start!"} />
          <StatCard title={t('dashboard.stats.volume')} value={displayVolume} icon={<Trophy className="w-5 h-5 text-yellow-500"/>} trend={totalVolume > 0 ? "+Vol" : ""} positive={totalVolume > 0} />
          <StatCard title="Today's KCAL" value={`${consumedCals}`} icon={<Apple className="w-5 h-5 text-emerald-500"/>} trend={`${goal - consumedCals} rem.`} positive={consumedCals <= goal} />
        </div>

        {/* Today's Nutrition Summary */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 lg:p-6 shadow-sm cursor-pointer hover:border-slate-700 transition-colors" onClick={() => navigate('/nutrition')}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg text-white flex items-center gap-2">
              <Apple className="w-5 h-5 text-emerald-500" />
              Today's Nutrition
            </h3>
            <ChevronRight className="w-5 h-5 text-slate-500" />
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
            <div className="flex flex-col justify-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Calories</span>
              <div className="flex items-end gap-1.5">
                <span className="text-xl lg:text-2xl font-bold text-white">{consumedCals}</span>
                <span className="text-[10px] lg:text-sm font-medium text-slate-400 mb-1">/ {goal}</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min(100, (consumedCals / goal) * 100)}%` }} />
              </div>
            </div>
            
            <div className="flex flex-col justify-center">
              <span className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1">Protein</span>
              <div className="flex items-end gap-1.5">
                <span className="text-lg lg:text-xl font-bold text-white">{consumedP}g</span>
                <span className="text-[10px] lg:text-sm font-medium text-slate-400 mb-0.5">/ {proteinGoal}g</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${Math.min(100, (consumedP / proteinGoal) * 100)}%` }} />
              </div>
            </div>

            <div className="flex flex-col justify-center">
              <span className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-1">Carbs</span>
              <div className="flex items-end gap-1.5">
                <span className="text-lg lg:text-xl font-bold text-white">{consumedC}g</span>
                <span className="text-[10px] lg:text-sm font-medium text-slate-400 mb-0.5">/ {carbsGoal}g</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${Math.min(100, (consumedC / carbsGoal) * 100)}%` }} />
              </div>
            </div>

            <div className="flex flex-col justify-center">
              <span className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1">Fat</span>
              <div className="flex items-end gap-1.5">
                <span className="text-lg lg:text-xl font-bold text-white">{consumedF}g</span>
                <span className="text-[10px] lg:text-sm font-medium text-slate-400 mb-0.5">/ {fatGoal}g</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${Math.min(100, (consumedF / fatGoal) * 100)}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          
          {/* Volume Chart */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-4 lg:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg text-white">{t('dashboard.chart.title')}</h3>
              <select className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-3 py-1 focus:outline-none">
                <option>{t('dashboard.chart.7days')}</option>
                <option>{t('dashboard.chart.month')}</option>
              </select>
            </div>
            <div className="h-64 lg:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                    itemStyle={{ color: '#e2e8f0' }}
                  />
                  <Area type="monotone" dataKey="volume" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorVolume)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent History */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 lg:p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg text-white">{t('dashboard.recent.title')}</h3>
              <button className="text-sm text-blue-500 hover:text-blue-400">{t('dashboard.recent.viewAll')}</button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto max-h-80 lg:max-h-none">
              {loading ? (
                <p className="text-slate-500 text-sm text-center py-4">{t('dashboard.recent.loading')}</p>
              ) : history.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">{t('dashboard.recent.empty')}</p>
              ) : (
                history.slice(0, 5).map((w, idx) => (
                  <HistoryItem 
                    key={w.id || idx}
                    date={w.date ? format(parseISO(w.date), 'MMM d, yyyy') : 'Unknown Date'} 
                    notes={w.notes || t('dashboard.recent.routine')} 
                    sets={w.logs?.length || 0}
                    setsLabel={t('dashboard.recent.sets')}
                  />
                ))
              )}
            </div>
            <button 
              onClick={() => navigate('/plans')}
              className="mt-4 w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 rounded-xl transition-colors"
            >
              {t('dashboard.recent.startNew')}
            </button>
          </div>
          
        </div>

      </div>

      {/* Weight Update Modal */}
      {showWeightPrompt && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{t('dashboard.weightPrompt.title') || 'Weekly Check-in'}</h3>
              <p className="text-sm text-slate-400">
                {t('dashboard.weightPrompt.subtitle') || 'It has been a week since your last update. Log your current weight to recalculate your nutrition goals.'}
              </p>
            </div>
            
            <div className="mb-6">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block text-center">
                {t('dashboard.weightPrompt.inputLabel') || 'Current Weight (kg)'}
              </label>
              <input 
                type="number" 
                value={newWeight}
                onChange={e => setNewWeight(e.target.value)}
                placeholder="e.g. 85"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white text-center focus:outline-none focus:border-blue-500 text-2xl font-bold"
                autoFocus
              />
            </div>

            <button 
              onClick={handleWeightUpdate}
              disabled={!newWeight}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-colors"
            >
              {t('dashboard.weightPrompt.button') || 'Update & Recalculate'}
            </button>
            <button 
              onClick={() => setShowWeightPrompt(false)}
              className="w-full mt-3 text-sm text-slate-500 hover:text-slate-300 font-medium transition-colors"
            >
              {t('dashboard.weightPrompt.skip') || 'Skip for now'}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}

function StatCard({ title, value, trend, positive, icon }: { title: string, value: string, trend: string, positive?: boolean, icon?: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 lg:p-5 shadow-sm hover:border-slate-700 transition-colors cursor-pointer group">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-[10px] lg:text-sm font-medium text-slate-400 uppercase tracking-wider">{title}</p>
      </div>
      <div className="flex items-end justify-between gap-1">
        <h4 className="text-xl lg:text-3xl font-bold text-white tracking-tight truncate">{value}</h4>
        <span className={cn(
          "text-[10px] lg:text-xs font-semibold px-1.5 py-0.5 lg:px-2 lg:py-1 rounded-md mb-1 whitespace-nowrap shrink-0",
          positive === undefined ? "bg-slate-800 text-slate-300" : positive ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
        )}>
          {trend}
        </span>
      </div>
    </div>
  )
}

function HistoryItem({ date, notes, sets, setsLabel }: { date: string, notes: string, sets: number, setsLabel: string }) {
  return (
    <div className="flex items-start gap-4 group cursor-pointer p-2 -mx-2 rounded-xl hover:bg-slate-800/50 transition-colors">
      <div className="relative pt-1 flex-1 border-l-2 border-slate-800 pl-4 ml-2">
        <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-blue-500 ring-4 ring-slate-900" />
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-semibold text-white">{date}</p>
            <p className="text-xs text-slate-500 mt-0.5">{notes}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold bg-slate-800 text-slate-300 px-2 py-1 rounded-md">{sets} {setsLabel}</span>
            <ChevronRight className="w-4 h-4 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </div>
    </div>
  )
}
