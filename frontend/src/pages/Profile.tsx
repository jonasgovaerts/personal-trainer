import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Target, Settings, RotateCcw, Dumbbell, Save } from 'lucide-react';
import Layout from '../components/Layout';
import { cn } from '../lib/utils';
import { useUI } from '../contexts/UIContext';
import { useUser } from '../contexts/UserContext';

export default function Profile() {
  const { t } = useTranslation();
  const { toast } = useUI();
  const { user } = useUser();
  
  const [profile, setProfile] = useState<any>(null);
  const [goals, setGoals] = useState<any>(null);
  const [userName, setUserName] = useState<string>('');
  
  const [allEquipment, setAllEquipment] = useState<any[]>([]);
  const [userEquipmentIds, setUserEquipmentIds] = useState<number[]>([]);
  const [savingEq, setSavingEq] = useState(false);

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
        fat: user.goal_fat
      });
    }

    // Fetch equipment data
    Promise.all([
      fetch('/api/equipment').then(res => res.json()),
      fetch('/api/user/1').then(res => res.json())
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

  }, []);

  const handleRetakeWizard = () => {
    localStorage.removeItem('setup_complete');
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
              </div>
            </div>

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
