import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Dumbbell, Target, Info, PlayCircle } from 'lucide-react';
import Layout from '@/components/Layout';
import { cn } from '@/lib/utils';

interface Exercise {
  id: number;
  name: string;
  description: string;
  hockey_benefit: string;
  image_url: string;
  video_url: string;
  equipment: { name: string }[];
}

export default function Exercises() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch exercises relevant to the user
    fetch('/api/exercises?user_id=1')
      .then(res => res.json())
      .then(data => {
        setExercises(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch exercises:", err);
        setLoading(false);
      });
  }, []);

  const filteredExercises = exercises.filter(ex => 
    ex.name.toLowerCase().includes(search.toLowerCase()) || 
    ex.hockey_benefit.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-8 h-full flex flex-col">
        <div className="flex items-end justify-between shrink-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">{t('exercises.title')}</h1>
            <p className="text-slate-400 mt-1">{t('exercises.subtitle')}</p>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder={t('exercises.search')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-full py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <p className="text-slate-500">{t('exercises.loading')}</p>
            </div>
          ) : filteredExercises.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <Dumbbell className="w-16 h-16 mb-4 opacity-20" />
              <p>{t('exercises.empty')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-8">
              {filteredExercises.map(ex => (
                <ExerciseCard key={ex.id} exercise={ex} t={t} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function ExerciseCard({ exercise, t }: { exercise: Exercise, t: any }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const equipmentList = exercise.equipment?.map(e => e.name).join(', ') || t('exercises.bodyweight');

  // Convert youtube watch URL to embed URL
  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    let videoId = '';
    if (url.includes('watch?v=')) {
      videoId = url.split('watch?v=')[1].split('&')[0];
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1].split('?')[0];
    } else if (url.includes('embed/')) {
      return url;
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
  };

  const embedUrl = getEmbedUrl(exercise.video_url);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col sm:flex-row group transition-all hover:border-slate-700">
      {/* Sketch / Illustration Area */}
      <div className="w-full sm:w-48 h-48 sm:h-auto bg-slate-800/50 flex flex-col items-center justify-center p-0 border-b sm:border-b-0 sm:border-r border-slate-800 relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none z-10" />
        
        {isPlaying && embedUrl ? (
          <iframe 
            src={`${embedUrl}?autoplay=1&mute=1`} 
            title={exercise.name}
            className="w-full h-full absolute inset-0 z-20 border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowFullScreen
          ></iframe>
        ) : (
          <>
            {exercise.image_url ? (
              <img src={exercise.image_url} alt={exercise.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
            ) : (
              <div className="p-6 flex flex-col items-center justify-center">
                <Dumbbell className="w-16 h-16 text-slate-700 mb-3 group-hover:scale-110 transition-transform duration-500" />
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 text-center">
                  {t('exercises.illustration')}
                </p>
              </div>
            )}
            
            {exercise.video_url && (
              <button 
                onClick={() => setIsPlaying(true)}
                className="absolute bottom-4 flex items-center gap-1.5 text-xs font-semibold text-white hover:text-blue-200 bg-blue-600/80 hover:bg-blue-600 px-3 py-1.5 rounded-full transition-colors z-20 backdrop-blur-sm cursor-pointer"
              >
                <PlayCircle className="w-4 h-4" />
                {t('exercises.watchVideo')}
              </button>
            )}
          </>
        )}
      </div>

      {/* Details Area */}
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-bold text-white">{exercise.name}</h3>
          <span className="bg-slate-800 text-slate-300 text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md shrink-0 ml-4">
            {equipmentList}
          </span>
        </div>
        
        <div className="flex items-start gap-2 mb-4 bg-blue-500/5 p-3 rounded-xl border border-blue-500/10">
          <Target className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block mb-0.5">{t('exercises.benefit')}</span>
            <p className="text-sm text-slate-300 leading-snug">{exercise.hockey_benefit}</p>
          </div>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-2">
            <Info className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('exercises.instructions')}</span>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed pl-5 relative">
            <span className="absolute left-1 top-1.5 w-1.5 h-1.5 rounded-full bg-slate-700" />
            {exercise.description}
          </p>
        </div>
      </div>
    </div>
  );
}
