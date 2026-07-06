import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Dumbbell, Target, Info, PlayCircle, Plus, Pencil, Trash2, X, Save } from 'lucide-react';
import Layout from '../components/Layout';
import { cn } from '../lib/utils';
import { useUI } from '../contexts/UIContext';
import { useUser } from '../contexts/UserContext';

interface Exercise {
  id: number;
  user_id?: number;
  name: string;
  description: string;
  hockey_benefit: string;
  image_url: string;
  video_url: string;
  equipment: { id?: number; name: string }[];
}

interface Equipment {
  id: number;
  name: string;
}

export default function Exercises() {
  const { t } = useTranslation();
  const { toast, confirm } = useUI();
  const { user } = useUser();
  const [search, setSearch] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  const [allEquipment, setAllEquipment] = useState<Equipment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formBenefit, setFormBenefit] = useState('');
  const [formEquipmentIds, setFormEquipmentIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchExercises = () => {
    fetch('/api/exercises?user_id=me')
      .then(res => res.json())
      .then(data => {
        setExercises(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch exercises:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchExercises();
    fetch('/api/equipment')
      .then(res => res.json())
      .then(data => setAllEquipment(Array.isArray(data) ? data : []))
      .catch(err => console.error("Failed to fetch equipment:", err));
  }, []);

  const openNewForm = () => {
    setEditingId(null);
    setFormName('');
    setFormDesc('');
    setFormBenefit('');
    setFormEquipmentIds([]);
    setShowForm(true);
  };

  const openEditForm = (ex: Exercise) => {
    setEditingId(ex.id);
    setFormName(ex.name);
    setFormDesc(ex.description || '');
    setFormBenefit(ex.hockey_benefit || '');
    setFormEquipmentIds((ex.equipment || []).map(e => e.id).filter((id): id is number => typeof id === 'number'));
    setShowForm(true);
  };

  const toggleEquipment = (id: number) => {
    setFormEquipmentIds(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  };

  const saveExercise = async () => {
    if (!formName.trim()) {
      toast(t('exercises.form.nameRequired') || 'Name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDesc.trim(),
        hockey_benefit: formBenefit.trim(),
        equipment_ids: formEquipmentIds,
      };
      const res = await fetch(editingId ? `/api/exercises/${editingId}` : '/api/exercises', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to save');
      toast(editingId ? (t('exercises.form.updated') || 'Exercise updated!') : (t('exercises.form.created') || 'Exercise created!'), 'success');
      setShowForm(false);
      fetchExercises();
    } catch (err) {
      console.error(err);
      toast(t('exercises.form.error') || 'Error saving exercise', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteExercise = (ex: Exercise) => {
    confirm(`${t('exercises.form.deleteConfirm') || 'Delete exercise'} "${ex.name}"?`, async () => {
      try {
        const res = await fetch(`/api/exercises/${ex.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete');
        setExercises(prev => prev.filter(e => e.id !== ex.id));
        toast(t('exercises.form.deleted') || 'Exercise deleted', 'success');
      } catch (err) {
        console.error(err);
        toast(t('exercises.form.error') || 'Error deleting exercise', 'error');
      }
    });
  };

  const filteredExercises = exercises.filter(ex =>
    ex.name.toLowerCase().includes(search.toLowerCase()) ||
    (ex.hockey_benefit || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-8 h-full flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">{t('exercises.title')}</h1>
            <p className="text-slate-400 mt-1">{t('exercises.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={t('exercises.search')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-full py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>
            <button
              onClick={openNewForm}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-full transition-colors flex items-center gap-2 shrink-0 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> {t('exercises.newExercise') || 'New Exercise'}
            </button>
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
                <ExerciseCard
                  key={ex.id}
                  exercise={ex}
                  t={t}
                  isOwner={!!user && ex.user_id === user.id}
                  onEdit={() => openEditForm(ex)}
                  onDelete={() => deleteExercise(ex)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Custom exercise form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-blue-600 p-6 flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold text-white">
                {editingId ? (t('exercises.form.editTitle') || 'Edit Exercise') : (t('exercises.newExercise') || 'New Exercise')}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-blue-100 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t('exercises.form.name') || 'Name'}</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Nordic Hamstring Curl"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white font-bold focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t('exercises.form.description') || 'Description'}</label>
                <textarea
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  rows={3}
                  placeholder={t('exercises.form.descriptionPlaceholder') || 'How to perform the exercise...'}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t('exercises.benefit')}</label>
                <input
                  type="text"
                  value={formBenefit}
                  onChange={e => setFormBenefit(e.target.value)}
                  placeholder={t('exercises.form.benefitPlaceholder') || 'What it improves...'}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">{t('exercises.form.equipment') || 'Equipment'}</label>
                <div className="grid grid-cols-2 gap-2">
                  {allEquipment.map(eq => (
                    <button
                      key={eq.id}
                      onClick={() => toggleEquipment(eq.id)}
                      className={cn(
                        "flex items-center gap-2 p-2.5 rounded-xl border transition-all text-left text-sm",
                        formEquipmentIds.includes(eq.id)
                          ? "bg-blue-600/20 border-blue-500 text-white"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      )}
                    >
                      <div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0", formEquipmentIds.includes(eq.id) ? "bg-blue-500 border-blue-500" : "border-slate-600")}>
                        {formEquipmentIds.includes(eq.id) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <span className="leading-tight">{eq.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-950/50 border-t border-slate-800 shrink-0">
              <button
                onClick={saveExercise}
                disabled={saving || !formName.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-2xl transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" /> {saving ? '...' : (t('exercises.form.save') || 'Save Exercise')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function ExerciseCard({ exercise, t, isOwner, onEdit, onDelete }: { exercise: Exercise, t: any, isOwner: boolean, onEdit: () => void, onDelete: () => void }) {
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
      <div className="w-full sm:w-48 h-40 sm:h-auto bg-slate-800/50 flex flex-col items-center justify-center p-0 border-b sm:border-b-0 sm:border-r border-slate-800 relative overflow-hidden shrink-0">
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
                <Dumbbell className="w-12 h-12 lg:w-16 lg:h-16 text-slate-700 mb-3 group-hover:scale-110 transition-transform duration-500" />
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 text-center">
                  {t('exercises.illustration')}
                </p>
              </div>
            )}

            {exercise.video_url && (
              <button
                onClick={() => setIsPlaying(true)}
                className="absolute bottom-3 flex items-center gap-1.5 text-[10px] lg:text-xs font-semibold text-white hover:text-blue-200 bg-blue-600/80 hover:bg-blue-600 px-2.5 py-1.5 rounded-full transition-colors z-20 backdrop-blur-sm cursor-pointer"
              >
                <PlayCircle className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                {t('exercises.watchVideo')}
              </button>
            )}
          </>
        )}
      </div>

      {/* Details Area */}
      <div className="p-5 lg:p-6 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2 gap-2">
          <h3 className="text-lg lg:text-xl font-bold text-white leading-tight flex items-center gap-2">
            {exercise.name}
            {isOwner && <span className="bg-blue-500/20 text-blue-400 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded shrink-0">{t('exercises.custom') || 'Custom'}</span>}
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            {isOwner && (
              <div className="flex items-center gap-1">
                <button onClick={onEdit} className="text-slate-500 hover:text-blue-500 transition-colors p-1 rounded hover:bg-slate-800"><Pencil className="w-4 h-4" /></button>
                <button onClick={onDelete} className="text-slate-500 hover:text-red-500 transition-colors p-1 rounded hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
              </div>
            )}
            <span className="bg-slate-800 text-slate-300 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md">
              {equipmentList}
            </span>
          </div>
        </div>

        {exercise.hockey_benefit && (
          <div className="flex items-start gap-2 mb-3 lg:mb-4 bg-blue-500/5 p-2.5 lg:p-3 rounded-xl border border-blue-500/10">
            <Target className="w-4 h-4 lg:w-5 lg:h-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] lg:text-xs font-bold text-blue-400 uppercase tracking-wider block mb-0.5">{t('exercises.benefit')}</span>
              <p className="text-xs lg:text-sm text-slate-300 leading-snug">{exercise.hockey_benefit}</p>
            </div>
          </div>
        )}

        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-2">
            <Info className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-slate-500" />
            <span className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-wider">{t('exercises.instructions')}</span>
          </div>
          <p className="text-xs lg:text-sm text-slate-400 leading-relaxed pl-4 lg:pl-5 relative">
            <span className="absolute left-0 lg:left-1 top-1.5 w-1.5 h-1.5 rounded-full bg-slate-700" />
            {exercise.description}
          </p>
        </div>
      </div>
    </div>
  );
}
