import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Target, Settings, RotateCcw, Dumbbell, Save, LogOut, Ruler, Plus, Trash2, TrendingDown, TrendingUp, Minus, LineChart as LineChartIcon, Camera, Image as ImageIcon } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Layout from '../components/Layout';
import { cn } from '../lib/utils';
import { useUI } from '../contexts/UIContext';
import { useUser } from '../contexts/UserContext';

interface Measurement {
  id: number;
  weight_kg: number;
  chest: number;
  waist: number;
  hips: number;
  bicep: number;
  thigh: number;
  calf: number;
  neck: number;
  timestamp: string;
}

const MEASUREMENT_FIELDS: { key: keyof Omit<Measurement, 'id' | 'timestamp'>; label: string; unit: string }[] = [
  { key: 'weight_kg', label: 'Weight', unit: 'kg' },
  { key: 'chest', label: 'Chest', unit: 'cm' },
  { key: 'waist', label: 'Waist', unit: 'cm' },
  { key: 'hips', label: 'Hips', unit: 'cm' },
  { key: 'bicep', label: 'Bicep', unit: 'cm' },
  { key: 'thigh', label: 'Thigh', unit: 'cm' },
  { key: 'calf', label: 'Calf', unit: 'cm' },
  { key: 'neck', label: 'Neck', unit: 'cm' },
];

export default function Profile() {
  const { t } = useTranslation();
  const { toast, confirm } = useUI();
  const { user, refreshUser } = useUser();

  const [profile, setProfile] = useState<any>(null);
  const [goals, setGoals] = useState<any>(null);
  const [userName, setUserName] = useState<string>('');

  const [allEquipment, setAllEquipment] = useState<any[]>([]);
  const [userEquipmentIds, setUserEquipmentIds] = useState<number[]>([]);
  const [savingEq, setSavingEq] = useState(false);

  // Body measurements state
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [showMeasurementForm, setShowMeasurementForm] = useState(false);
  const [measurementInput, setMeasurementInput] = useState<Record<string, string>>({});
  const [savingMeasurement, setSavingMeasurement] = useState(false);
  const [chartField, setChartField] = useState<string>('weight_kg');

  // Progress photos
  const [photos, setPhotos] = useState<any[]>([]);
  const [photosAvailable, setPhotosAvailable] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const fetchMeasurements = () => {
    fetch('/api/measurements')
      .then(res => res.json())
      .then(data => setMeasurements(Array.isArray(data) ? data : []))
      .catch(err => console.error("Failed to fetch measurements:", err));
  };

  const fetchPhotos = () => {
    fetch('/api/photos')
      .then(res => {
        if (res.status === 503) { setPhotosAvailable(false); return []; }
        setPhotosAvailable(true);
        return res.json();
      })
      .then(data => setPhotos(Array.isArray(data) ? data : []))
      .catch(err => console.error("Failed to fetch photos:", err));
  };

  const uploadPhoto = async (file: File) => {
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/photos', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('upload failed');
      toast(t('profile.photos.uploaded') || 'Photo uploaded', 'success');
      fetchPhotos();
    } catch (err) {
      console.error(err);
      toast(t('profile.photos.error') || 'Error uploading photo', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const deletePhoto = (id: number) => {
    confirm(t('profile.photos.deleteConfirm') || 'Delete this photo?', async () => {
      try {
        const res = await fetch(`/api/photos/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('delete failed');
        setPhotos(prev => prev.filter(p => p.id !== id));
      } catch (err) {
        console.error(err);
        toast(t('profile.photos.error') || 'Error', 'error');
      }
    });
  };

  const saveMeasurement = async () => {
    const payload: Record<string, number> = {};
    let hasValue = false;
    MEASUREMENT_FIELDS.forEach(f => {
      const val = parseFloat(measurementInput[f.key] || '');
      payload[f.key] = isNaN(val) ? 0 : val;
      if (!isNaN(val) && val > 0) hasValue = true;
    });
    if (!hasValue) {
      toast('Enter at least one measurement', 'error');
      return;
    }

    setSavingMeasurement(true);
    try {
      const res = await fetch('/api/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to save');
      const saved = await res.json();
      setMeasurements([saved, ...measurements]);
      setMeasurementInput({});
      setShowMeasurementForm(false);
      toast('Measurements logged!', 'success');
      if (payload.weight_kg > 0) refreshUser();
    } catch (err) {
      console.error(err);
      toast('Error saving measurements', 'error');
    } finally {
      setSavingMeasurement(false);
    }
  };

  const deleteMeasurement = (id: number) => {
    confirm('Delete this measurement entry?', async () => {
      try {
        const res = await fetch(`/api/measurements/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete');
        setMeasurements(prev => prev.filter(m => m.id !== id));
        toast('Measurement deleted', 'success');
      } catch (err) {
        console.error(err);
        toast('Error deleting measurement', 'error');
      }
    });
  };

  // Delta vs the previous (older) entry for the same field; null when no comparison possible
  const getDelta = (index: number, key: keyof Measurement): number | null => {
    const current = measurements[index][key] as number;
    if (!current) return null;
    for (let i = index + 1; i < measurements.length; i++) {
      const prev = measurements[i][key] as number;
      if (prev > 0) return Number((current - prev).toFixed(1));
    }
    return null;
  };

  useEffect(() => {
    if (user) {
      setUserName(user.name);
      setProfile({
        gender: user.gender,
        age: user.birth_date, // display as age using calculateAge
        birthDate: user.birth_date,
        height: user.height,
        currentWeight: user.current_weight,
        targetWeight: user.target_weight,
        activityLevel: user.activity_level
      });
      setGoals({
        calories: user.goal_calories,
        protein: user.goal_protein,
        carbs: user.goal_carbs,
        fat: user.goal_fat,
        water: user.goal_water_ml
      });
    }

    // Fetch equipment data
    Promise.all([
      fetch('/api/equipment').then(res => res.json()),
      fetch('/api/user/me').then(res => res.json())
    ])
    .then(([eqData, userData]) => {
      setAllEquipment(eqData || []);
      if (userData && userData.equipment) {
        setUserEquipmentIds(userData.equipment.map((e: any) => e.id));
      }
    })
    .catch(err => {
      console.error("Failed to fetch equipment:", err);
      toast('Failed to load profile data', 'error');
    });

    fetchMeasurements();
    fetchPhotos();
  }, []);

  // Build the measurement trend series (oldest → newest) for the selected field.
  const measurementChartData = [...measurements]
    .reverse()
    .filter(m => (m[chartField as keyof Measurement] as number) > 0)
    .map(m => ({
      date: new Date(m.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      value: m[chartField as keyof Measurement] as number,
    }));

  const handleRetakeWizard = () => {
    localStorage.removeItem('setup_complete');
    localStorage.setItem('force_setup', 'true');
    window.location.href = '/';
  };

  const calculateAge = (dob: string) => {
    if (!dob) return 0;
    const diff_ms = Date.now() - new Date(dob).getTime();
    const age_dt = new Date(diff_ms); 
  
    return Math.abs(age_dt.getUTCFullYear() - 1970);
  };

  const toggleEquipment = (id: number) => {
    if (userEquipmentIds.includes(id)) {
      setUserEquipmentIds(userEquipmentIds.filter(eId => eId !== id));
    } else {
      setUserEquipmentIds([...userEquipmentIds, id]);
    }
  };

  const saveEquipment = async () => {
    setSavingEq(true);
    try {
      const res = await fetch('/api/user/me/equipment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipment_ids: userEquipmentIds })
      });
      if (res.ok) {
        toast(t('profile.equipmentSaved') || 'Equipment saved!', 'success');
      } else {
        throw new Error('Failed to save');
      }
    } catch (err) {
      console.error(err);
      toast('Error saving equipment', 'error');
    } finally {
      setSavingEq(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-8 pb-20">
        
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">{t('nav.profile')}</h1>
            <p className="text-slate-400 mt-1">{t('nav.settings')}</p>
          </div>
        </div>

        {profile && goals ? (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-500" />
                {t('profile.personalInfo')}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 lg:gap-6">
                <div>
                  <p className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('wizard.name')}</p>
                  <p className="text-base lg:text-lg font-medium text-white truncate">{userName}</p>
                </div>
                <div>
                  <p className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('profile.gender')}</p>
                  <p className="text-base lg:text-lg font-medium text-white capitalize">{t(`profile.gender.${profile.gender}`)}</p>
                </div>
                <div>
                  <p className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('profile.age')}</p>
                  <p className="text-base lg:text-lg font-medium text-white">{calculateAge(profile.birthDate)}</p>
                </div>
                <div>
                  <p className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('profile.height')}</p>
                  <p className="text-base lg:text-lg font-medium text-white">{profile.height} cm</p>
                </div>
                <div>
                  <p className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('profile.currentWeight')}</p>
                  <p className="text-base lg:text-lg font-medium text-white">{profile.currentWeight} kg</p>
                </div>
                <div>
                  <p className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('profile.targetWeight')}</p>
                  <p className="text-base lg:text-lg font-medium text-white">{profile.targetWeight} kg</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-500" />
                {t('profile.nutritionGoals')}
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                <div>
                  <p className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('profile.calories')}</p>
                  <p className="text-lg lg:text-xl font-bold text-white">{goals.calories} <span className="text-[10px] lg:text-sm font-normal text-slate-400">kcal</span></p>
                </div>
                <div>
                  <p className="text-[10px] lg:text-xs font-bold text-blue-500 uppercase tracking-wider mb-1">{t('profile.protein')}</p>
                  <p className="text-lg lg:text-xl font-bold text-white">{goals.protein} <span className="text-[10px] lg:text-sm font-normal text-slate-400">g</span></p>
                </div>
                <div>
                  <p className="text-[10px] lg:text-xs font-bold text-orange-500 uppercase tracking-wider mb-1">{t('profile.carbs')}</p>
                  <p className="text-lg lg:text-xl font-bold text-white">{goals.carbs} <span className="text-[10px] lg:text-sm font-normal text-slate-400">g</span></p>
                </div>
                <div>
                  <p className="text-[10px] lg:text-xs font-bold text-emerald-500 uppercase tracking-wider mb-1">{t('profile.fat')}</p>
                  <p className="text-lg lg:text-xl font-bold text-white">{goals.fat} <span className="text-[10px] lg:text-sm font-normal text-slate-400">g</span></p>
                </div>
                <div>
                  <p className="text-[10px] lg:text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1">{t('profile.water') || 'Water'}</p>
                  <p className="text-lg lg:text-xl font-bold text-white">{goals.water || 2500} <span className="text-[10px] lg:text-sm font-normal text-slate-400">ml</span></p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Ruler className="w-5 h-5 text-cyan-500" />
                  Body Measurements
                </h3>
                <button
                  onClick={() => setShowMeasurementForm(!showMeasurementForm)}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-1.5 px-4 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> {showMeasurementForm ? 'Cancel' : 'Log'}
                </button>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                Track your weight and body measurements over time. Logging a weight also updates your profile.
              </p>

              {showMeasurementForm && (
                <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 mb-4 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {MEASUREMENT_FIELDS.map(f => (
                      <div key={f.key}>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{f.label} ({f.unit})</label>
                        <input
                          type="number"
                          step="0.1"
                          inputMode="decimal"
                          value={measurementInput[f.key] || ''}
                          onChange={e => setMeasurementInput({ ...measurementInput, [f.key]: e.target.value })}
                          placeholder="—"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={saveMeasurement}
                    disabled={savingMeasurement}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors text-sm uppercase tracking-wider flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" /> {savingMeasurement ? 'Saving...' : 'Save Measurements'}
                  </button>
                </div>
              )}

              {measurements.length === 0 ? (
                <p className="text-center text-slate-600 py-4 text-sm">No measurements logged yet.</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-1">
                  {measurements.map((m, idx) => (
                    <div key={m.id} className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          {new Date(m.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <button onClick={() => deleteMeasurement(m.id)} className="text-slate-600 hover:text-red-500 transition-colors p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
                        {MEASUREMENT_FIELDS.filter(f => (m[f.key] as number) > 0).map(f => {
                          const delta = getDelta(idx, f.key);
                          return (
                            <div key={f.key} className="flex items-baseline justify-between gap-1">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">{f.label}</span>
                              <span className="text-sm font-semibold text-white whitespace-nowrap">
                                {m[f.key]}<span className="text-[10px] text-slate-500 font-normal"> {f.unit}</span>
                                {delta !== null && delta !== 0 && (
                                  <span className={cn("ml-1 text-[10px] font-bold inline-flex items-center", delta < 0 ? "text-emerald-500" : "text-orange-400")}>
                                    {delta < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                                    {Math.abs(delta)}
                                  </span>
                                )}
                                {delta === 0 && <Minus className="w-3 h-3 inline ml-1 text-slate-600" />}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Measurement trend chart */}
            {measurements.length >= 2 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <LineChartIcon className="w-5 h-5 text-cyan-500" />
                    {t('profile.trends') || 'Trends'}
                  </h3>
                  <select
                    value={chartField}
                    onChange={e => setChartField(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg py-1.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {MEASUREMENT_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </div>
                {measurementChartData.length < 2 ? (
                  <p className="text-sm text-slate-500 italic py-8 text-center">{t('profile.trendEmpty') || 'Log this measurement at least twice to see a trend.'}</p>
                ) : (
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={measurementChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} domain={['auto', 'auto']} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px' }} />
                        <Line type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={3} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* Progress photos */}
            {photosAvailable && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-pink-500" />
                    {t('profile.photos.title') || 'Progress Photos'}
                  </h3>
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-1.5 px-4 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" /> {uploadingPhoto ? '...' : (t('profile.photos.add') || 'Add')}
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); if (photoInputRef.current) photoInputRef.current.value = ''; }}
                  />
                </div>
                {photos.length === 0 ? (
                  <p className="text-sm text-slate-500 italic py-4 text-center">{t('profile.photos.empty') || 'No photos yet. Track your visual progress over time.'}</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {photos.map(p => (
                      <div key={p.id} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-800">
                        <img src={p.url} alt={p.note || 'progress'} className="w-full h-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                          <span className="text-[10px] font-bold text-white">{new Date(p.taken_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                        </div>
                        <button
                          onClick={() => deletePhoto(p.id)}
                          className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-red-600 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Dumbbell className="w-5 h-5 text-purple-500" />
                  {t('profile.myEquipment') || 'My Equipment'}
                </h3>
                <button 
                  onClick={saveEquipment}
                  disabled={savingEq}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-1.5 px-4 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> {savingEq ? '...' : t('profile.saveEq') || 'Save'}
                </button>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                {t('profile.equipmentDesc') || 'Select the equipment you have available to filter exercises and plans.'}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {allEquipment.map(eq => (
                  <button
                    key={eq.id}
                    onClick={() => toggleEquipment(eq.id)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                      userEquipmentIds.includes(eq.id) 
                        ? "bg-blue-600/20 border-blue-500 text-white" 
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                    )}
                  >
                    <div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors", userEquipmentIds.includes(eq.id) ? "bg-blue-500 border-blue-500" : "border-slate-600")}>
                      {userEquipmentIds.includes(eq.id) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className="text-sm font-semibold leading-tight">{eq.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="font-semibold text-white">{t('profile.retakeTitle')}</h4>
                <p className="text-sm text-slate-400">{t('profile.retakeDesc')}</p>
              </div>
              <button 
                onClick={handleRetakeWizard}
                className="bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 px-6 rounded-xl transition-colors flex items-center gap-2 shrink-0"
              >
                <RotateCcw className="w-4 h-4" /> {t('profile.retakeBtn')}
              </button>
            </div>

            <div className="bg-red-950/10 border border-red-900/20 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
              <div>
                <h4 className="font-semibold text-red-500">{t('profile.logoutTitle')}</h4>
                <p className="text-sm text-slate-400">{t('profile.logoutDesc')}</p>
              </div>
              <button 
                onClick={() => {
                  window.location.href = '/auth/logout';
                }}
                className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2.5 px-6 rounded-xl transition-colors flex items-center gap-2 shrink-0"
              >
                <LogOut className="w-4 h-4" /> {t('profile.logoutBtn')}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center text-slate-500 shadow-sm">
            <Settings className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-semibold text-slate-300">{t('profile.noData')}</p>
            <button 
              onClick={handleRetakeWizard}
              className="mt-6 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 px-6 rounded-xl transition-colors"
            >
              {t('profile.retakeBtn')}
            </button>
          </div>
        )}

      </div>
    </Layout>
  );
}
