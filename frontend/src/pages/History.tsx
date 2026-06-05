import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Activity, Dumbbell, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import Layout from '../components/Layout';
import { useUI } from '../contexts/UIContext';

interface WorkoutLog {
  id: number;
  exercise: {
    id: number;
    name: string;
  };
  sets: number;
  reps: number;
  weight_kg: number;
}

interface Workout {
  id: number;
  date: string;
  notes: string;
  Logs: WorkoutLog[];
}

export default function History() {
  const { t } = useTranslation();
  const { toast } = useUI();
  const [history, setHistory] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchHistory = () => {
    setLoading(true);
    fetch('/api/workouts/history?user_id=1')
      .then(res => res.json())
      .then(data => {
        setHistory(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch history:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation(); // Don't expand the card
    
    if (window.confirm('Weet je zeker dat je deze training wilt verwijderen?')) {
      fetch(`/api/workouts/${id}`, { method: 'DELETE' })
        .then(res => {
          if (res.ok) {
            toast('Training verwijderd', 'success');
            fetchHistory();
          } else {
            toast('Fout bij verwijderen', 'error');
          }
        })
        .catch(() => toast('Netwerkfout', 'error'));
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Group logs by exercise for a cleaner display
  const getGroupedLogs = (logs: WorkoutLog[]) => {
    if (!logs || !Array.isArray(logs)) return [];
    
    const grouped: { [key: number]: { name: string, sets: { reps: number, weight: number }[] } } = {};
    
    logs.forEach(log => {
      if (!log.exercise) return;
      if (!grouped[log.exercise.id]) {
        grouped[log.exercise.id] = {
          name: log.exercise.name,
          sets: []
        };
      }
      grouped[log.exercise.id].sets.push({ reps: log.reps, weight: log.weight_kg });
    });
    
    return Object.values(grouped);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">{t('history.title')}</h1>
            <p className="text-slate-400 mt-1">{t('history.subtitle')}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20 text-slate-500">
            <Activity className="w-8 h-8 animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center text-slate-500 shadow-sm">
            <CalendarDays className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-semibold text-slate-300">{t('history.empty.title')}</p>
            <p className="text-sm mt-1">{t('history.empty.subtitle')}</p>
          </div>
        ) : (
          <div className="space-y-4 lg:space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-800 before:to-transparent">
            {history.map((workout) => {
              const dateObj = workout.date ? parseISO(workout.date) : new Date();
              const isExpanded = expandedId === workout.id;
              const groupedLogs = getGroupedLogs(workout.Logs);
              const totalSets = workout.Logs?.length || 0;

              return (
                <div key={workout.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  {/* Timeline Dot */}
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-950 bg-blue-600 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                    <Dumbbell className="w-4 h-4 text-white" />
                  </div>
                  
                  {/* Card */}
                  <div className="w-[calc(100%-3.5rem)] md:w-[calc(50%-2.5rem)] bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl shadow-sm transition-all overflow-hidden">
                    <div 
                      className="p-4 lg:p-5 cursor-pointer flex justify-between items-start"
                      onClick={() => toggleExpand(workout.id)}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider bg-blue-500/10 px-2 py-0.5 rounded">
                            {format(dateObj, 'MMM d, yyyy')}
                          </span>
                        </div>
                        <h3 className="text-base lg:text-lg font-bold text-white leading-tight truncate">
                          {workout.notes || t('dashboard.recent.routine')}
                        </h3>
                        <p className="text-[10px] lg:text-xs text-slate-500 mt-1">
                          {totalSets} {t('history.setsCompleted')} • {groupedLogs.length} {t('history.exercises')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 lg:gap-3 shrink-0 ml-2">
                        <div className="text-slate-500 bg-slate-800/50 p-1.5 rounded-full shrink-0">
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </div>
                        <button 
                          onClick={(e) => handleDelete(e, workout.id)}
                          className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors shrink-0"
                          title={t('common.delete') || 'Verwijderen'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 lg:px-5 pb-5 pt-2 border-t border-slate-800/50 bg-slate-950/30">
                        {groupedLogs.length === 0 ? (
                          <p className="text-sm text-slate-500 italic">{t('history.noLogs')}</p>
                        ) : (
                          <div className="space-y-4">
                            {groupedLogs.map((group, gIdx) => (
                              <div key={gIdx}>
                                <h4 className="text-xs lg:text-sm font-semibold text-slate-300 mb-2">{group.name}</h4>
                                <div className="grid grid-cols-1 gap-1.5 pl-2 border-l border-slate-700">
                                  {group.sets.map((set, sIdx) => (
                                    <div key={sIdx} className="flex items-center gap-3 text-[10px] lg:text-xs text-slate-400">
                                      <span className="w-10 lg:w-12 font-medium text-slate-500">Set {sIdx + 1}</span>
                                      <span className="w-14 lg:w-16 bg-slate-800 px-2 py-0.5 rounded text-center text-slate-300">{set.weight} kg</span>
                                      <span className="w-14 lg:w-16 bg-slate-800 px-2 py-0.5 rounded text-center text-slate-300">{set.reps} reps</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
