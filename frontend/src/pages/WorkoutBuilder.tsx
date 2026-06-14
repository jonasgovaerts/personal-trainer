import { useState, useEffect } from 'react';
import { Reorder } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { GripVertical, Plus, Search, Dumbbell, Save, Clock, Target, Trash2 } from 'lucide-react';
import Layout from '../components/Layout';
import { useUI } from '../hooks/useUI';

interface Exercise {
  id: number;
  name: string;
  description: string;
  hockey_benefit: string;
  equipment: { name: string }[];
}

interface WorkoutItem {
  id: string; 
  exerciseId: number;
  name: string;
  sets: number;
  reps: string;
  rest: string;
}

export default function WorkoutBuilder() {
  const { t } = useTranslation();
  const { toast } = useUI();
  const [search, setSearch] = useState('');
  const [exerciseLibrary, setExerciseLibrary] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [workoutItems, setWorkoutItems] = useState<WorkoutItem[]>([]);
  const [workoutName, setWorkoutName] = useState('New Hockey Strength Phase 1');

  useEffect(() => {
    fetch('/api/exercises?user_id=me')
      .then(res => res.json())
      .then(data => {
        setExerciseLibrary(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch exercises:", err);
        toast('Failed to load exercise library', 'error');
        setLoading(false);
      });
  }, [toast]);

  const filteredLibrary = exerciseLibrary.filter(ex => 
    ex.name.toLowerCase().includes(search.toLowerCase()) || 
    ex.hockey_benefit.toLowerCase().includes(search.toLowerCase())
  );

  const addExercise = (ex: Exercise) => {
    const newItem: WorkoutItem = {
      id: `item-${Date.now()}-${Math.random()}`,
      exerciseId: ex.id,
      name: ex.name,
      sets: 3,
      reps: '8-10',
      rest: '90s',
    };
    setWorkoutItems([...workoutItems, newItem]);
  };

  const removeExercise = (id: string) => {
    setWorkoutItems(workoutItems.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof WorkoutItem, value: any) => {
    setWorkoutItems(workoutItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const saveWorkout = async () => {
    try {
      const res = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 1,
          notes: workoutName,
        })
      });

      if (res.ok) {
        const workout = await res.json();
        
        for (const item of workoutItems) {
          await fetch(`/api/workouts/${workout.id}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              exercise_id: item.exerciseId,
              sets: item.sets,
              reps: parseInt(item.reps) || 0,
              weight_kg: 0
            })
          });
        }
        
        toast(t('builder.workout.saved'), 'success');
        setWorkoutItems([]);
      }
    } catch (err) {
      console.error("Failed to save workout", err);
      toast(t('builder.workout.error'), 'error');
    }
  };

  return (
    <Layout>
      <div className="flex h-[calc(100vh-8rem)] gap-8">
        {/* Left: Exercise Library */}
        <div className="w-1/3 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-800">
            <h2 className="text-xl font-bold text-white mb-4">{t('builder.library.title')}</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder={t('builder.library.search')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>
            <p className="text-xs text-slate-500 mt-3">{t('builder.library.filtered')}</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {loading ? (
              <p className="text-slate-500 text-sm text-center py-10">{t('builder.library.loading')}</p>
            ) : filteredLibrary.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-10">{t('builder.library.empty')}</p>
            ) : (
              filteredLibrary.map(ex => (
                <div 
                  key={ex.id}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-800/50 border border-transparent hover:border-slate-700 transition-colors group"
                >
                  <div className="flex-1 pr-4">
                    <p className="text-sm font-semibold text-white leading-tight">{ex.name}</p>
                    <div className="flex gap-2 mt-1 text-xs text-slate-500">
                      <span className="flex items-start gap-1">
                        <Target className="w-3 h-3 mt-0.5 shrink-0" /> 
                        <span className="line-clamp-2" title={ex.hockey_benefit}>{ex.hockey_benefit}</span>
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => addExercise(ex)}
                    className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-blue-600 hover:text-white transition-all shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Workout Builder */}
        <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
            <div>
              <input 
                type="text" 
                value={workoutName}
                onChange={e => setWorkoutName(e.target.value)}
                className="bg-transparent w-96 text-2xl font-bold text-white focus:outline-none focus:border-b border-blue-500"
              />
              <p className="text-sm text-slate-400 mt-1">{t('builder.workout.subtitle')}</p>
            </div>
            <button 
              onClick={saveWorkout}
              disabled={workoutItems.length === 0}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-medium py-2.5 px-5 rounded-xl transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> {t('builder.workout.save')}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-slate-950/20">
            {workoutItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <Dumbbell className="w-16 h-16 mb-4 opacity-20" />
                <p>{t('builder.workout.empty.title')}</p>
                <p className="text-sm">{t('builder.workout.empty.subtitle')}</p>
              </div>
            ) : (
              <Reorder.Group axis="y" values={workoutItems} onReorder={setWorkoutItems} className="space-y-3">
                {workoutItems.map(item => (
                  <Reorder.Item 
                    key={item.id} 
                    value={item} 
                    className="bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-sm flex items-center gap-4 group relative"
                  >
                    <div className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-white transition-colors p-2 -ml-2">
                      <GripVertical className="w-5 h-5" />
                    </div>
                    
                    <div className="flex-1">
                      <h4 className="font-semibold text-white">{item.name}</h4>
                      
                      <div className="flex gap-4 mt-3">
                        <div className="flex flex-col">
                          <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">{t('builder.workout.sets')}</label>
                          <input 
                            type="number" 
                            inputMode="numeric"
                            value={item.sets}
                            onChange={(e) => updateItem(item.id, 'sets', parseInt(e.target.value) || 0)}
                            className="w-16 bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white text-center focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">{t('builder.workout.reps')}</label>
                          <input 
                            type="text" 
                            value={item.reps}
                            onChange={(e) => updateItem(item.id, 'reps', e.target.value)}
                            className="w-24 bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white text-center focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {t('builder.workout.rest')}
                          </label>
                          <input 
                            type="text" 
                            value={item.rest}
                            onChange={(e) => updateItem(item.id, 'rest', e.target.value)}
                            className="w-20 bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white text-center focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => removeExercise(item.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all absolute right-4 top-4"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            )}
          </div>
        </div>

      </div>
    </Layout>
  );
}
