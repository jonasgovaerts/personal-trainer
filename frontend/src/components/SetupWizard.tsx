import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check, Dumbbell } from 'lucide-react';
import { cn } from '../lib/utils';
import { useUser } from '../hooks/useUser';

interface SetupWizardProps {
  onComplete: () => void;
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const { t } = useTranslation();
  const { user } = useUser();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    gender: 'male',
    birthDate: '',
    height: '',
    currentWeight: '',
    targetWeight: '',
    activityLevel: '1.375' // Lightly active default
  });

  const [allEquipment, setAllEquipment] = useState<any[]>([]);
  const [userEquipmentIds, setUserEquipmentIds] = useState<number[]>([]);
  const [savingEq, setSavingEq] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        gender: user.gender || 'male',
        birthDate: user.birth_date || '',
        height: user.height ? user.height.toString() : '',
        currentWeight: user.current_weight ? user.current_weight.toString() : '',
        targetWeight: user.target_weight ? user.target_weight.toString() : '',
        activityLevel: user.activity_level || '1.375'
      });
      if (user.equipment) {
        setUserEquipmentIds(user.equipment.map((e: any) => e.id));
      }
    }
  }, [user]);

  useEffect(() => {
    fetch('/api/equipment')
      .then(res => res.json())
      .then(data => setAllEquipment(data || []))
      .catch(err => console.error("Failed to fetch equipment:", err));
  }, []);

  const toggleEquipment = (id: number) => {
    if (userEquipmentIds.includes(id)) {
      setUserEquipmentIds(userEquipmentIds.filter(eId => eId !== id));
    } else {
      setUserEquipmentIds([...userEquipmentIds, id]);
    }
  };

  const updateForm = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const calculateAge = (dob: string) => {
    if (!dob) return 30;
    const diff_ms = Date.now() - new Date(dob).getTime();
    const age_dt = new Date(diff_ms); 
  
    return Math.abs(age_dt.getUTCFullYear() - 1970);
  };

  const calculateGoalsAndComplete = async () => {
    setSavingEq(true);
    const weight = parseFloat(formData.currentWeight) || 80;
    const targetWeight = parseFloat(formData.targetWeight) || 80;
    const height = parseFloat(formData.height) || 180;
    const age = calculateAge(formData.birthDate);
    const activity = parseFloat(formData.activityLevel) || 1.375;

    // BMR Calculation (Mifflin-St Jeor)
    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr += formData.gender === 'male' ? 5 : -161;

    const tdee = bmr * activity;

    // Adjust for goals
    let calories = tdee;
    if (targetWeight < weight) calories -= 500; // Cutting
    else if (targetWeight > weight) calories += 500; // Bulking

    calories = Math.round(calories);

    // Macros
    // Protein: ~2.2g per kg of target weight
    const protein = Math.round(targetWeight * 2.2);
    // Fat: ~1g per kg of target weight
    const fat = Math.round(targetWeight * 1.0);
    // Carbs: Remaining calories
    const proteinCals = protein * 4;
    const fatCals = fat * 9;
    const remainingCals = calories - proteinCals - fatCals;
    const carbs = Math.max(0, Math.round(remainingCals / 4));

    localStorage.setItem('setup_complete', 'true');
    localStorage.setItem('user_name', formData.name);
    localStorage.setItem('nutrition_goal', calories.toString());
    localStorage.setItem('macro_protein', protein.toString());
    localStorage.setItem('macro_carbs', carbs.toString());
    localStorage.setItem('macro_fat', fat.toString());
    
    // Also save user profile stats for reference
    localStorage.setItem('user_profile', JSON.stringify(formData));

    try {
      // Save profile and goals to backend
      await fetch('/api/user/me/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          gender: formData.gender,
          birth_date: formData.birthDate,
          height: height,
          current_weight: weight,
          target_weight: targetWeight,
          activity_level: formData.activityLevel,
          goal_calories: calories,
          goal_protein: protein,
          goal_carbs: carbs,
          goal_fat: fat
        })
      });

      // Save equipment
      await fetch('/api/user/me/equipment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipment_ids: userEquipmentIds })
      });
    } catch (err) {
      console.error('Error saving data to database during setup:', err);
    }

    setSavingEq(false);
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        
        {/* Progress Bar */}
        <div className="flex h-2 w-full bg-slate-800 shrink-0">
          <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${(step / 4) * 100}%` }} />
        </div>

        <div className="p-6 md:p-12 overflow-y-auto flex-1">
          {step === 1 && (
            <div className="space-y-5 lg:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center mb-6 lg:mb-8">
                <Dumbbell className="w-10 h-10 lg:w-12 lg:h-12 text-blue-500 mx-auto mb-4" />
                <h2 className="text-2xl lg:text-3xl font-bold text-white mb-2">{t('wizard.welcome')}</h2>
                <p className="text-sm lg:text-base text-slate-400">{t('wizard.subtitle')}</p>
              </div>

              <div>
                <label className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">{t('wizard.name')}</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => updateForm('name', e.target.value)}
                  placeholder="e.g. Jonas"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 lg:p-4 text-white focus:outline-none focus:border-blue-500 text-base lg:text-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 lg:gap-4">
                <button 
                  onClick={() => updateForm('gender', 'male')}
                  className={cn("p-3.5 lg:p-4 rounded-xl border transition-all font-semibold text-sm lg:text-base", formData.gender === 'male' ? "bg-blue-600/20 border-blue-500 text-white" : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700")}
                >
                  {t('profile.gender.male')}
                </button>
                <button 
                  onClick={() => updateForm('gender', 'female')}
                  className={cn("p-3.5 lg:p-4 rounded-xl border transition-all font-semibold text-sm lg:text-base", formData.gender === 'female' ? "bg-blue-600/20 border-blue-500 text-white" : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700")}
                >
                  {t('profile.gender.female')}
                </button>
              </div>

              <div>
                <label className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">{t('wizard.birthDate')}</label>
                <input 
                  type="date" 
                  value={formData.birthDate}
                  onChange={e => updateForm('birthDate', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 lg:p-4 text-white focus:outline-none focus:border-blue-500 text-base lg:text-lg"
                />
              </div>

              <button 
                onClick={() => setStep(2)}
                disabled={!formData.name || !formData.birthDate}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3.5 lg:py-4 rounded-xl transition-colors flex items-center justify-center gap-2 mt-4"
              >
                {t('wizard.next')} <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 lg:space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-center mb-6 lg:mb-8">
                <h2 className="text-2xl lg:text-3xl font-bold text-white mb-2">Body Metrics</h2>
                <p className="text-sm lg:text-base text-slate-400">Base Metabolic Rate (BMR) calculation.</p>
              </div>

              <div>
                <label className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Height (cm)</label>
                <input 
                  type="number" 
                  inputMode="numeric"
                  value={formData.height}
                  onChange={e => updateForm('height', e.target.value)}
                  placeholder="e.g. 185"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 lg:p-4 text-white focus:outline-none focus:border-blue-500 text-base lg:text-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 lg:gap-4">
                <div>
                  <label className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Weight (kg)</label>
                  <input 
                    type="number" 
                    inputMode="decimal"
                    value={formData.currentWeight}
                    onChange={e => updateForm('currentWeight', e.target.value)}
                    placeholder="85"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 lg:p-4 text-white focus:outline-none focus:border-blue-500 text-base lg:text-lg"
                  />
                </div>
                <div>
                  <label className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Target (kg)</label>
                  <input 
                    type="number" 
                    inputMode="decimal"
                    value={formData.targetWeight}
                    onChange={e => updateForm('targetWeight', e.target.value)}
                    placeholder="80"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 lg:p-4 text-white focus:outline-none focus:border-blue-500 text-base lg:text-lg"
                  />
                </div>
              </div>

              <div className="flex gap-3 lg:gap-4 pt-4">
                <button 
                  onClick={() => setStep(1)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 lg:py-4 rounded-xl transition-colors text-sm lg:text-base"
                >
                  Back
                </button>
                <button 
                  onClick={() => setStep(3)}
                  disabled={!formData.height || !formData.currentWeight || !formData.targetWeight}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3.5 lg:py-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm lg:text-base"
                >
                  Next <ArrowRight className="w-4 h-4 lg:w-5 lg:h-5" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5 lg:space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-center mb-6 lg:mb-8">
                <h2 className="text-2xl lg:text-3xl font-bold text-white mb-2">Activity Level</h2>
                <p className="text-sm lg:text-base text-slate-400">Average daily activity.</p>
              </div>

              <div className="space-y-2.5 lg:space-y-3">
                {[
                  { value: '1.2', label: 'Sedentary', desc: 'Little to no exercise' },
                  { value: '1.375', label: 'Lightly Active', desc: '1-3 days/week' },
                  { value: '1.55', label: 'Moderately Active', desc: '3-5 days/week' },
                  { value: '1.725', label: 'Very Active', desc: '6-7 days/week' },
                  { value: '1.9', label: 'Extra Active', desc: 'Physical job' }
                ].map(level => (
                  <button
                    key={level.value}
                    onClick={() => updateForm('activityLevel', level.value)}
                    className={cn(
                      "w-full flex items-center justify-between p-3.5 lg:p-4 rounded-xl border transition-all text-left",
                      formData.activityLevel === level.value ? "bg-blue-600/20 border-blue-500" : "bg-slate-950 border-slate-800 hover:border-slate-700"
                    )}
                  >
                    <div>
                      <p className={cn("font-bold text-sm lg:text-base", formData.activityLevel === level.value ? "text-white" : "text-slate-300")}>{level.label}</p>
                      <p className="text-[10px] lg:text-xs text-slate-500 mt-0.5 lg:mt-1">{level.desc}</p>
                    </div>
                    {formData.activityLevel === level.value && <Check className="w-4 h-4 lg:w-5 lg:h-5 text-blue-500" />}
                  </button>
                ))}
              </div>

              <div className="flex gap-3 lg:gap-4 pt-4">
                <button 
                  onClick={() => setStep(2)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 lg:py-4 rounded-xl transition-colors text-sm lg:text-base"
                >
                  Back
                </button>
                <button 
                  onClick={() => setStep(4)}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 lg:py-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm lg:text-base"
                >
                  {t('wizard.next')} <ArrowRight className="w-4 h-4 lg:w-5 lg:h-5" />
                </button>
              </div>
            </div>
          )}

              {step === 4 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">{t('profile.myEquipment') || 'My Equipment'}</h2>
                <p className="text-slate-400">{t('profile.equipmentDesc') || 'Select the equipment you have available to filter exercises and plans.'}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
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

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setStep(3)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl transition-colors"
                >
                  Back
                </button>
                <button 
                  onClick={calculateGoalsAndComplete}
                  disabled={savingEq}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {savingEq ? '...' : t('wizard.complete') || 'Complete Setup'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
