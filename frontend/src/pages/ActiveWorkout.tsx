import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Timer, Activity, ChevronLeft, ChevronRight, Repeat, LayoutList, Dumbbell, PlayCircle } from 'lucide-react';
import Layout from '../components/Layout';
import { cn } from '../lib/utils';
import { useUI } from '../contexts/UIContext';

interface Exercise {
  id: number;
  name: string;
  description: string;
  image_url?: string;
  video_url?: string;
}

interface SetLog {
  id: string;
  reps: number;
  weight: number;
  completed: boolean;
}

interface ActiveExercise {
  exercise: Exercise;
  sets: SetLog[];
}

type WorkoutMode = 'standard' | 'circuit';

export default function ActiveWorkout() {
  const { t } = useTranslation();
  const { toast } = useUI();
  const location = useLocation();
  const navigate = useNavigate();
  const plan = location.state?.plan;

  const [activeExercises, setActiveExercises] = useState<ActiveExercise[]>([]);
  const [loading, setLoading] = useState(true);

  // Stepper State
  const [mode, setMode] = useState<WorkoutMode>('standard');
  const [currentExIdx, setCurrentExIdx] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Screen Wake Lock
  useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        console.error('Wake Lock error:', err);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().catch(console.error);
      }
    };
  }, []);

  useEffect(() => {
    setIsPlaying(false);
  }, [currentExIdx]);

  useEffect(() => {
    if (!plan) {
      navigate('/plans');
      return;
    }

    fetch('/api/exercises?user_id=me')
      .then(res => res.json())
      .then(data => {
        const library: Exercise[] = data || [];
        
        const mapped = plan.exercises.map((planEx: any) => {
          const exName = typeof planEx === 'string' ? planEx : planEx.name;
          const found = library.find(e => e.name.toLowerCase() === exName.toLowerCase()) 
                        || { id: 0, name: exName, description: '' };
          
          const numSets = planEx.sets || 3;
          
          return {
            exercise: found,
            sets: Array.from({ length: numSets }).map((_, i) => ({
              id: `set-${found.id}-${i}`,
              reps: planEx.reps || 0,
              weight: planEx.weight || 0,
              completed: false,
            }))
          };
        });

        setActiveExercises(mapped);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load exercises", err);
        toast('Failed to load exercises for this plan.', 'error');
        setLoading(false);
      });
  }, [plan, navigate]);

  const toggleSet = (exIndex: number, setIndex: number) => {
    const updated = [...activeExercises];
    updated[exIndex].sets[setIndex].completed = !updated[exIndex].sets[setIndex].completed;
    setActiveExercises(updated);
  };

  const updateSet = (exIndex: number, setIndex: number, field: 'reps' | 'weight', value: string) => {
    const updated = [...activeExercises];
    updated[exIndex].sets[setIndex][field] = parseFloat(value) || 0;
    setActiveExercises(updated);
  };

  const addSet = (exIndex: number) => {
    const updated = [...activeExercises];
    updated[exIndex].sets.push({
      id: `set-${Date.now()}`,
      reps: 0,
      weight: 0,
      completed: false,
    });
    setActiveExercises(updated);
  };

  const finishWorkout = async () => {
    try {
      const res = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Custom routines carry their own name; predefined plans use a translation key.
          notes: plan?.name || (plan ? t(`predefined.plan.${plan.id}.name`) : 'Custom Session'),
        })
      });

      if (!res.ok) throw new Error('Failed to create session');
      
      const workout = await res.json();

      for (const ex of activeExercises) {
        for (const set of ex.sets) {
          if (set.completed && ex.exercise.id !== 0) {
            await fetch(`/api/workouts/${workout.id}/log`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                exercise_id: ex.exercise.id,
                sets: 1,
                reps: set.reps,
                weight_kg: set.weight
              })
            });
          }
        }
      }

      toast(t('active.saved'), 'success');
      navigate('/');
    } catch (err) {
      console.error(err);
      toast(t('active.error'), 'error');
    }
  };

  // Stepper Navigation Logic
  const handleNext = () => {
    if (mode === 'standard') {
      if (currentExIdx < activeExercises.length - 1) {
        setCurrentExIdx(prev => prev + 1);
      } else {
        finishWorkout();
      }
    } else {
      // Circuit Mode Next
      let nextIdx = currentExIdx + 1;
      let nextRound = currentRound;
      const maxSets = Math.max(...activeExercises.map(e => e.sets.length));

      while (true) {
        if (nextIdx >= activeExercises.length) {
          nextIdx = 0;
          nextRound++;
        }
        
        if (nextRound >= maxSets) {
          finishWorkout();
          return;
        }

        if (activeExercises[nextIdx].sets.length > nextRound) {
          setCurrentExIdx(nextIdx);
          setCurrentRound(nextRound);
          return;
        }
        nextIdx++;
      }
    }
  };

  const handlePrev = () => {
    if (mode === 'standard') {
      if (currentExIdx > 0) setCurrentExIdx(prev => prev - 1);
    } else {
      // Circuit Mode Prev
      let prevIdx = currentExIdx - 1;
      let prevRound = currentRound;

      while (true) {
        if (prevIdx < 0) {
          if (prevRound === 0) return; // At the very start
          prevRound--;
          prevIdx = activeExercises.length - 1;
        }

        if (activeExercises[prevIdx].sets.length > prevRound) {
          setCurrentExIdx(prevIdx);
          setCurrentRound(prevRound);
          return;
        }
        prevIdx--;
      }
    }
  };

  const isLastStep = () => {
    if (mode === 'standard') {
      return currentExIdx === activeExercises.length - 1;
    } else {
      const maxSets = Math.max(...activeExercises.map(e => e.sets.length));
      // Are we on the last exercise that has a set in the max round?
      let lastValidIdx = 0;
      for (let i = 0; i < activeExercises.length; i++) {
        if (activeExercises[i].sets.length === maxSets) {
          lastValidIdx = i;
        }
      }
      return currentRound === maxSets - 1 && currentExIdx === lastValidIdx;
    }
  };

  if (!plan || loading || activeExercises.length === 0) {
    return (
      <Layout>
        <div className="flex h-full items-center justify-center text-slate-500">
          <Activity className="w-8 h-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  const activeEx = activeExercises[currentExIdx];

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6 pb-24">
        {/* Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sticky top-0 z-10 backdrop-blur-md bg-opacity-90">
          <div>
            <h1 className="text-2xl font-bold text-white">{t(`predefined.plan.${plan.id}.name`)}</h1>
            <p className="text-slate-400 text-sm mt-1 flex items-center gap-2">
              <Timer className="w-4 h-4" /> {t('active.inProgress')}
            </p>
          </div>
          
          {/* Mode Toggle */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
            <button
              onClick={() => { setMode('standard'); setCurrentRound(0); setCurrentExIdx(0); }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors",
                mode === 'standard' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"
              )}
            >
              <LayoutList className="w-4 h-4" /> Standard
            </button>
            <button
              onClick={() => { setMode('circuit'); setCurrentRound(0); setCurrentExIdx(0); }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors",
                mode === 'circuit' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"
              )}
            >
              <Repeat className="w-4 h-4" /> Circuit
            </button>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-between text-sm font-semibold text-slate-400 px-2">
          <span>Exercise {currentExIdx + 1} of {activeExercises.length}</span>
          {mode === 'circuit' && <span>Round {currentRound + 1}</span>}
        </div>

        {/* Active Exercise Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="flex flex-col md:flex-row border-b border-slate-800">
            {/* Media Area */}
            <div className="w-full md:w-1/3 min-h-[200px] bg-slate-800/50 flex flex-col items-center justify-center p-0 border-b md:border-b-0 md:border-r border-slate-800 relative overflow-hidden shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none z-10" />
              
              {isPlaying && activeEx.exercise.video_url ? (
                <iframe 
                  src={`${activeEx.exercise.video_url.replace('watch?v=', 'embed/')}?autoplay=1`} 
                  title={activeEx.exercise.name}
                  className="w-full h-full absolute inset-0 z-20 border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                  allowFullScreen
                ></iframe>
              ) : (
                <>
                  {activeEx.exercise.image_url ? (
                    <img src={activeEx.exercise.image_url} alt={activeEx.exercise.name} className="w-full h-full object-cover opacity-80" />
                  ) : (
                    <div className="p-6 flex flex-col items-center justify-center">
                      <Dumbbell className="w-16 h-16 text-slate-700 mb-3" />
                      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 text-center">
                        Illustration
                      </p>
                    </div>
                  )}
                  
                  {activeEx.exercise.video_url && (
                    <button 
                      onClick={() => setIsPlaying(true)}
                      className="absolute bottom-4 flex items-center gap-1.5 text-xs font-semibold text-white hover:text-blue-200 bg-blue-600/80 hover:bg-blue-600 px-3 py-1.5 rounded-full transition-colors z-20 backdrop-blur-sm cursor-pointer"
                    >
                      <PlayCircle className="w-4 h-4" />
                      Watch Video
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Exercise Details */}
            <div className="flex-1 p-5 lg:p-6 flex flex-col justify-center">
              <h2 className="text-2xl lg:text-3xl font-bold text-white mb-2">{activeEx.exercise.name}</h2>
              {activeEx.exercise.description && (
                <p className="text-xs lg:text-sm text-slate-400 leading-relaxed border-l-2 border-slate-700 pl-3">
                  {activeEx.exercise.description}
                </p>
              )}
            </div>
          </div>
          
          <div className="p-6 bg-slate-950/20">
            <div className="grid grid-cols-12 gap-4 mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider px-2">
              <div className="col-span-2 text-center">{t('active.set')}</div>
              <div className="col-span-4 text-center">{t('active.kg')}</div>
              <div className="col-span-4 text-center">{t('active.reps')}</div>
              <div className="col-span-2 text-center"><Check className="w-4 h-4 mx-auto" /></div>
            </div>
            
            <div className="space-y-3">
              {activeEx.sets.map((set, setIdx) => {
                // In Circuit mode, hide sets that don't match the current round
                if (mode === 'circuit' && setIdx !== currentRound) return null;

                return (
                  <div 
                    key={set.id} 
                    className={cn(
                      "grid grid-cols-12 gap-4 items-center p-3 rounded-xl border transition-colors",
                      set.completed ? "bg-emerald-500/5 border-emerald-500/20" : "bg-slate-950 border-slate-800"
                    )}
                  >
                    <div className="col-span-2 text-center text-sm font-semibold text-slate-400">
                      {setIdx + 1}
                    </div>
                    <div className="col-span-4">
                      <input 
                        type="number" 
                        inputMode="decimal"
                        placeholder="-"
                        value={set.weight || ''}
                        onChange={e => updateSet(currentExIdx, setIdx, 'weight', e.target.value)}
                        disabled={set.completed}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-center text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                      />
                    </div>
                    <div className="col-span-4">
                      <input 
                        type="number" 
                        inputMode="numeric"
                        placeholder="-"
                        value={set.reps || ''}
                        onChange={e => updateSet(currentExIdx, setIdx, 'reps', e.target.value)}
                        disabled={set.completed}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-center text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                      />
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <button
                        onClick={() => toggleSet(currentExIdx, setIdx)}
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center transition-colors shadow-sm",
                          set.completed 
                            ? "bg-emerald-500 text-white" 
                            : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                        )}
                      >
                        <Check className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {mode === 'standard' && (
              <button 
                onClick={() => addSet(currentExIdx)}
                className="mt-6 w-full py-3 border-2 border-dashed border-slate-800 text-slate-400 hover:text-white hover:border-slate-600 rounded-xl text-sm font-semibold transition-colors"
              >
                + {t('active.addSet')}
              </button>
            )}
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-between pt-4 gap-4">
          <button
            onClick={handlePrev}
            disabled={currentExIdx === 0 && currentRound === 0}
            className="flex-1 flex items-center justify-center gap-2 px-4 lg:px-6 py-3.5 rounded-xl font-semibold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm lg:text-base"
          >
            <ChevronLeft className="w-4 h-4 lg:w-5 lg:h-5" /> <span className="hidden sm:inline">Previous</span><span className="sm:hidden">Prev</span>
          </button>

          {isLastStep() ? (
            <button
              onClick={finishWorkout}
              className="flex-[1.5] flex items-center justify-center gap-2 px-6 lg:px-8 py-3.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/20 transition-colors text-sm lg:text-base"
            >
              <Check className="w-4 h-4 lg:w-5 lg:h-5" /> {t('active.finish')}
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex-[1.5] flex items-center justify-center gap-2 px-6 lg:px-8 py-3.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20 transition-colors text-sm lg:text-base"
            >
              Next <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5" />
            </button>
          )}
        </div>
      </div>
    </Layout>
  );
}
