import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Reorder } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { GripVertical, Plus, Search, Dumbbell, Save, Clock, Target, Trash2, Pencil, X, ClipboardList, PlayCircle } from 'lucide-react';
import Layout from '../components/Layout';
import { useUI } from '../contexts/UIContext';

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

interface RoutineExercise {
  exercise_id: number;
  sets: number;
  reps: string;
  rest: string;
  exercise?: { id: number; name: string };
}

interface Routine {
  id: number;
  name: string;
  exercises: RoutineExercise[];
}

export default function WorkoutBuilder() {
  const { t } = useTranslation();
  const { toast, confirm } = useUI();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [exerciseLibrary, setExerciseLibrary] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<number | null>(null);
  const [workoutItems, setWorkoutItems] = useState<WorkoutItem[]>([]);
  const [workoutName, setWorkoutName] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchRoutines = () => {
    fetch('/api/routines')
      .then(res => res.json())
      .then(data => setRoutines(Array.isArray(data) ? data : []))
      .catch(err => console.error("Failed to fetch routines:", err));
  };

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
    fetchRoutines();
  }, []);

  const filteredLibrary = exerciseLibrary.filter(ex =>
    ex.name.toLowerCase().includes(search.toLowerCase()) ||
    (ex.hockey_benefit || '').toLowerCase().includes(search.toLowerCase())
  );

  const startNewRoutine = () => {
    setEditingRoutineId(null);
    setWorkoutName(t('builder.defaultName') || 'New Routine');
    setWorkoutItems([]);
    setIsBuilding(true);
  };

  const startEditRoutine = (routine: Routine) => {
    setEditingRoutineId(routine.id);
    setWorkoutName(routine.name);
    setWorkoutItems(routine.exercises.map((re, idx) => ({
      id: `item-${idx}-${re.exercise_id}`,
      exerciseId: re.exercise_id,
      name: re.exercise?.name || 'Unknown exercise',
      sets: re.sets,
      reps: re.reps,
      rest: re.rest,
    })));
    setIsBuilding(true);
  };

  const cancelBuilder = () => {
    setIsBuilding(false);
    setEditingRoutineId(null);
    setWorkoutItems([]);
    setWorkoutName('');
  };

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

  const saveRoutine = async () => {
    if (!workoutName.trim()) {
      toast(t('builder.nameRequired') || 'Give your routine a name', 'error');
      return;
    }
    if (workoutItems.length === 0) {
      toast(t('builder.workout.empty.title'), 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: workoutName.trim(),
        exercises: workoutItems.map((item, idx) => ({
          exercise_id: item.exerciseId,
          sets: item.sets,
          reps: item.reps,
          rest: item.rest,
          position: idx,
        }))
      };
      const res = await fetch(editingRoutineId ? `/api/routines/${editingRoutineId}` : '/api/routines', {
        method: editingRoutineId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to save routine');
      toast(t('builder.workout.saved'), 'success');
      cancelBuilder();
      fetchRoutines();
    } catch (err) {
      console.error("Failed to save routine", err);
      toast(t('builder.workout.error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const startRoutine = (routine: Routine) => {
    // Hand off to the ActiveWorkout screen using the same "plan" shape it expects.
    navigate('/active-workout', {
      state: {
        plan: {
          id: routine.id,
          name: routine.name,
          exercises: routine.exercises.map(re => ({
            name: re.exercise?.name || '',
            sets: re.sets,
            reps: parseInt(re.reps) || 0,
          })),
        }
      }
    });
  };

  const deleteRoutine = (routine: Routine) => {
    confirm(`${t('builder.deleteConfirm') || 'Delete routine'} "${routine.name}"?`, async () => {
      try {
        const res = await fetch(`/api/routines/${routine.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete');
        setRoutines(prev => prev.filter(r => r.id !== routine.id));
        toast(t('builder.deleted') || 'Routine deleted', 'success');
      } catch (err) {
        console.error(err);
        toast(t('builder.workout.error'), 'error');
      }
    });
  };

  // ----- Routine list view -----
  if (!isBuilding) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto space-y-8 pb-32">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">{t('nav.workoutBuilder')}</h1>
              <p className="text-slate-400 mt-1">{t('builder.subtitle') || 'Build and save reusable workout routines.'}</p>
            </div>
            <button
              onClick={startNewRoutine}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-6 rounded-xl transition-colors flex items-center gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" /> {t('builder.newRoutine') || 'New Routine'}
            </button>
          </div>

          {routines.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center text-slate-500 shadow-sm">
              <ClipboardList className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-semibold text-slate-300">{t('builder.noRoutines') || 'No routines yet'}</p>
              <p className="text-sm text-slate-500 mt-1">{t('builder.noRoutinesDesc') || 'Build a routine once, reuse it anytime.'}</p>
              <button
                onClick={startNewRoutine}
                className="mt-6 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 px-6 rounded-xl transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> {t('builder.newRoutine') || 'New Routine'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {routines.map(routine => (
                <div key={routine.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Dumbbell className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white truncate">{routine.name}</h3>
                        <p className="text-[10px] text-slate-500 uppercase font-bold">
                          {routine.exercises.length} {t('builder.exercisesLabel') || 'exercises'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => startRoutine(routine)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-3 rounded-lg transition-colors flex items-center gap-1.5 text-xs mr-1">
                        <PlayCircle className="w-4 h-4" /> {t('builder.start') || 'Start'}
                      </button>
                      <button onClick={() => startEditRoutine(routine)} className="text-slate-500 hover:text-blue-500 transition-colors p-2 rounded-lg hover:bg-slate-800"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => deleteRoutine(routine)} className="text-slate-500 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="p-3 divide-y divide-slate-800/50">
                    {routine.exercises.map((re, idx) => (
                      <div key={idx} className="py-2 px-1 flex items-center justify-between">
                        <p className="text-sm text-white truncate">{re.exercise?.name || 'Unknown exercise'}</p>
                        <p className="text-xs text-slate-500 font-medium whitespace-nowrap pl-3">
                          {re.sets} × {re.reps} • {re.rest}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // ----- Builder / editor view -----
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

        {/* Right: Routine Builder */}
        <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={cancelBuilder} className="text-slate-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800 shrink-0">
                <X className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <input
                  type="text"
                  value={workoutName}
                  onChange={e => setWorkoutName(e.target.value)}
                  placeholder={t('builder.defaultName') || 'New Routine'}
                  className="bg-transparent w-full text-2xl font-bold text-white focus:outline-none focus:border-b border-blue-500"
                />
                <p className="text-sm text-slate-400 mt-1">{t('builder.workout.subtitle')}</p>
              </div>
            </div>
            <button
              onClick={saveRoutine}
              disabled={workoutItems.length === 0 || saving}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-medium py-2.5 px-5 rounded-xl transition-colors flex items-center gap-2 shrink-0"
            >
              <Save className="w-4 h-4" /> {saving ? '...' : t('builder.workout.save')}
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
