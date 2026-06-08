import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Clock, Flame, Dumbbell } from 'lucide-react';
import Layout from '../components/Layout';
import { cn } from '../lib/utils';

// Mock data for predefined workouts
const predefinedPlans = [
  {
    id: 'plan-1',
    category: 'Full Body',
    name: 'Gameday Prep',
    duration: '45 min',
    intensity: 'High',
    exerciseCount: 6,
    description: 'A full body explosive routine to prime your central nervous system before a game.',
    exercises: [
      { name: 'Skater Jumps', sets: 3, reps: 8, weight: 0 },
      { name: 'Medicine Ball Rotational Throws', sets: 3, reps: 6, weight: 5 },
      { name: 'Bulgarian Split Squats', sets: 2, reps: 8, weight: 15 },
      { name: 'Pallof Press', sets: 3, reps: 10, weight: 0 },
      { name: 'Goblet Squats', sets: 2, reps: 8, weight: 20 },
      { name: 'Plank met Shoulder Taps', sets: 2, reps: 12, weight: 0 }
    ]
  },
  {
    id: 'plan-2',
    category: 'Lower Body',
    name: 'Explosive Stride',
    duration: '50 min',
    intensity: 'VeryHigh',
    exerciseCount: 5,
    description: 'Focuses entirely on lower body power generation for faster acceleration on the ice.',
    exercises: [
      { name: 'Bulgarian Split Squats', sets: 4, reps: 6, weight: 20 },
      { name: 'Skater Jumps', sets: 4, reps: 10, weight: 0 },
      { name: 'Single-Leg Romanian Deadlift (RDL)', sets: 3, reps: 8, weight: 25 },
      { name: 'Cossack Squats', sets: 3, reps: 8, weight: 10 },
      { name: 'Glute Bridges', sets: 3, reps: 15, weight: 0 }
    ]
  },
  {
    id: 'plan-3',
    category: 'Core',
    name: 'Anti-Rotational Armor',
    duration: '30 min',
    intensity: 'Medium',
    exerciseCount: 4,
    description: 'Build an indestructible core to win battles in the corners and improve shot power.',
    exercises: [
      { name: 'Pallof Press', sets: 3, reps: 12, weight: 0 },
      { name: 'Russian Twists', sets: 3, reps: 20, weight: 10 },
      { name: 'Plank met Shoulder Taps', sets: 3, reps: 20, weight: 0 },
      { name: 'Medicine Ball Rotational Throws', sets: 3, reps: 10, weight: 5 }
    ]
  },
  {
    id: 'plan-4',
    category: 'Upper Body',
    name: 'Puck Protection Power',
    duration: '40 min',
    intensity: 'Medium',
    exerciseCount: 5,
    description: 'Upper body strength focused on pulling and pushing power to fend off opponents.',
    exercises: [
      { name: 'Pull-ups', sets: 4, reps: 8, weight: 0 },
      { name: 'Dumbbell Rows', sets: 3, reps: 10, weight: 20 },
      { name: 'Push-ups', sets: 3, reps: 15, weight: 0 },
      { name: 'Pallof Press', sets: 3, reps: 10, weight: 0 },
      { name: 'Russian Twists', sets: 3, reps: 20, weight: 10 }
    ]
  },
  {
    id: 'plan-5',
    category: 'Full Body',
    name: 'Off-Season Builder',
    duration: '60 min',
    intensity: 'High',
    exerciseCount: 8,
    description: 'Comprehensive strength building routine for the off-season.',
    exercises: [
      { name: 'Goblet Squats', sets: 4, reps: 10, weight: 25 },
      { name: 'Pull-ups', sets: 4, reps: 8, weight: 0 },
      { name: 'Medicine Ball Rotational Throws', sets: 3, reps: 10, weight: 8 },
      { name: 'Bulgarian Split Squats', sets: 3, reps: 10, weight: 15 },
      { name: 'Single-Leg Romanian Deadlift (RDL)', sets: 3, reps: 10, weight: 20 },
      { name: 'Plank met Shoulder Taps', sets: 3, reps: 16, weight: 0 },
      { name: 'Glute Bridges', sets: 3, reps: 15, weight: 0 },
      { name: 'Cossack Squats', sets: 3, reps: 8, weight: 10 }
    ]
  },
  {
    id: 'plan-6',
    category: 'Full Body',
    name: 'Advanced Full Body Conditioning',
    duration: '60 min',
    intensity: 'VeryHigh',
    exerciseCount: 8,
    description: 'A demanding 1-hour session focusing on overall conditioning, agility, and strength.',
    exercises: [
      { name: 'Burpees', sets: 4, reps: 15, weight: 0 },
      { name: 'Jump Squats', sets: 4, reps: 12, weight: 0 },
      { name: 'Overhead Press', sets: 4, reps: 10, weight: 15 },
      { name: 'Lunges', sets: 3, reps: 12, weight: 10 },
      { name: 'Pull-ups', sets: 3, reps: 8, weight: 0 },
      { name: 'Push-ups', sets: 3, reps: 20, weight: 0 },
      { name: 'Deadbugs', sets: 3, reps: 16, weight: 0 },
      { name: 'Plank', sets: 3, reps: 60, weight: 0 }
    ]
  },
  {
    id: 'plan-7',
    category: 'Upper Body',
    name: 'Upper Body Hypertrophy',
    duration: '60 min',
    intensity: 'High',
    exerciseCount: 6,
    description: 'Build upper body mass and strength for winning battles on the ice.',
    exercises: [
      { name: 'Pull-ups', sets: 4, reps: 10, weight: 0 },
      { name: 'Overhead Press', sets: 4, reps: 10, weight: 20 },
      { name: 'Dumbbell Rows', sets: 4, reps: 10, weight: 25 },
      { name: 'Push-ups', sets: 4, reps: 20, weight: 0 },
      { name: 'Bicep Curls', sets: 3, reps: 12, weight: 15 },
      { name: 'Tricep Dips', sets: 3, reps: 15, weight: 0 }
    ]
  },
  {
    id: 'plan-8',
    category: 'Lower Body',
    name: 'Lower Body Endurance',
    duration: '60 min',
    intensity: 'VeryHigh',
    exerciseCount: 7,
    description: 'Long duration lower body burn to simulate 3rd period fatigue resistance.',
    exercises: [
      { name: 'Goblet Squats', sets: 4, reps: 15, weight: 20 },
      { name: 'Lunges', sets: 4, reps: 20, weight: 10 },
      { name: 'Bulgarian Split Squats', sets: 3, reps: 12, weight: 15 },
      { name: 'Single-Leg Romanian Deadlift (RDL)', sets: 3, reps: 12, weight: 20 },
      { name: 'Calf Raises', sets: 4, reps: 20, weight: 15 },
      { name: 'Glute Bridges', sets: 3, reps: 20, weight: 0 },
      { name: 'Leg Raises', sets: 3, reps: 15, weight: 0 }
    ]
  },
  {
    id: 'plan-9',
    category: 'Full Body',
    name: 'Heavy Duty Iron',
    duration: '60 min',
    intensity: 'High',
    exerciseCount: 6,
    description: 'A heavy-hitting full body routine utilizing barbell and dumbbells to build maximal strength and ice-bound armor.',
    exercises: [
      { name: 'Barbell Deadlift', sets: 4, reps: 6, weight: 60 },
      { name: 'Dumbbell Bench Press', sets: 4, reps: 8, weight: 22 },
      { name: 'Barbell Bent Over Row', sets: 3, reps: 10, weight: 40 },
      { name: 'Barbell Back Squat', sets: 3, reps: 8, weight: 50 },
      { name: 'Overhead Press', sets: 3, reps: 10, weight: 35 },
      { name: 'Deadbugs', sets: 3, reps: 12, weight: 0 }
    ]
  },
  {
    id: 'plan-10',
    category: 'Full Body',
    name: 'Kettlebell & Dumbbell Power',
    duration: '45 min',
    intensity: 'High',
    exerciseCount: 6,
    description: 'An explosive full body circuit combining kettlebell power and dumbbells for unmatched endurance and functional conditioning.',
    exercises: [
      { name: 'Kettlebell Swings', sets: 4, reps: 15, weight: 16 },
      { name: 'Dumbbell Rows', sets: 3, reps: 10, weight: 18 },
      { name: 'Kettlebell Clean & Press', sets: 3, reps: 8, weight: 12 },
      { name: 'Bulgarian Split Squats', sets: 3, reps: 10, weight: 14 },
      { name: 'Push-ups', sets: 3, reps: 15, weight: 0 },
      { name: 'Russian Twists', sets: 3, reps: 20, weight: 10 }
    ]
  }
];

export default function PredefinedWorkouts() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('All');
  const [availableExercises, setAvailableExercises] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch exercises filtered by user's equipment
    fetch('/api/exercises?user_id=1')
      .then(res => res.json())
      .then(data => {
        if (data) {
          setAvailableExercises(data.map((ex: any) => ex.name.toLowerCase()));
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch exercises:", err);
        setLoading(false);
      });
  }, []);

  const categories = ['All', 'Full Body', 'Lower Body', 'Upper Body', 'Core'];

  const filteredPlans = filter === 'All' 
    ? predefinedPlans 
    : predefinedPlans.filter(plan => plan.category === filter);

  return (
    <Layout>
      <div className="space-y-8 h-full flex flex-col">
        <div className="flex items-end justify-between shrink-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">{t('predefined.title')}</h1>
            <p className="text-slate-400 mt-1">{t('predefined.subtitle')}</p>
          </div>
        </div>

        {/* Filter Badges */}
        <div className="flex gap-2 overflow-x-auto pb-2 shrink-0">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                filter === cat 
                  ? "bg-blue-600 text-white" 
                  : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800"
              )}
            >
              {t(`predefined.cat.${cat.replace(' ', '')}`)}
            </button>
          ))}
        </div>

        {/* Plans Grid */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center h-64 text-slate-500">
              <p>Loading plans...</p>
            </div>
          ) : filteredPlans.length === 0 ? (
            <div className="flex justify-center items-center h-64 text-slate-500 text-center flex-col gap-2">
              <p>No plans available.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 pb-8">
              {filteredPlans.map(plan => {
                // Check if user has all required exercises for this plan
                const hasEquipment = plan.exercises.every(ex => availableExercises.includes(ex.name.toLowerCase()));
                return <PlanCard key={plan.id} plan={plan} t={t} hasEquipment={hasEquipment} />
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

import { useNavigate } from 'react-router-dom';

function PlanCard({ plan, t, hasEquipment }: { plan: any, t: any, hasEquipment: boolean }) {
  const navigate = useNavigate();

  return (
    <div className={cn(
      "bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col group transition-all",
      hasEquipment ? "hover:border-slate-700" : "opacity-60 grayscale"
    )}>
      <div className="p-6 border-b border-slate-800 flex-1 relative">
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col gap-2">
            <span className="bg-blue-500/10 text-blue-500 text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md self-start">
              {t(`predefined.cat.${plan.category.replace(' ', '')}`)}
            </span>
            {!hasEquipment && (
              <span className="bg-red-500/10 text-red-500 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded border border-red-500/20 self-start">
                {t('predefined.missingEquipment')}
              </span>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 text-xs font-semibold text-slate-400">
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {plan.duration}</span>
            <span className="flex items-center gap-1.5 text-orange-400"><Flame className="w-3.5 h-3.5" /> {t(`predefined.intensity.${plan.intensity}`)}</span>
          </div>
        </div>
        
        <h3 className="text-xl font-bold text-white mb-2">{t(`predefined.plan.${plan.id}.name`)}</h3>
        <p className="text-sm text-slate-400 leading-relaxed mb-4">{t(`predefined.plan.${plan.id}.description`)}</p>
        
        <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800/50">
          <div className="flex items-center gap-2 mb-2 text-slate-300 text-xs font-bold uppercase tracking-wider">
            <Dumbbell className="w-3.5 h-3.5 text-blue-500" />
            {plan.exerciseCount} {t('predefined.exercises')}
          </div>
          <ul className="text-sm text-slate-500 space-y-1 pl-5 list-disc marker:text-slate-700">
            {plan.exercises.map((ex: any, idx: number) => (
              <li key={idx}>
                <span className="font-semibold text-slate-400">{ex.sets}x{ex.reps}</span> {ex.name}
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      <div className="p-4 bg-slate-800/20 shrink-0">
        <button 
          onClick={() => navigate('/active-workout', { state: { plan } })}
          className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-blue-600 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
        >
          <Play className="w-4 h-4" />
          {t('predefined.start')}
        </button>
      </div>
    </div>
  )
}
