import { useState, useEffect } from 'react';
import { Utensils, Plus, Trash2, X, Apple, CupSoda, Pencil, Save } from 'lucide-react';
import Layout from '../components/Layout';
import FoodPicker, { PickedFoodItem } from '../components/FoodPicker';
import { useUI } from '../contexts/UIContext';

interface MealItem {
  id?: number;
  barcode?: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  portion_grams: number;
  type: 'food' | 'drink';
}

interface Meal {
  id: number;
  name: string;
  items: MealItem[];
  created_at: string;
}

const mealTotals = (items: MealItem[]) => ({
  calories: items.reduce((s, i) => s + i.calories, 0),
  protein: Number(items.reduce((s, i) => s + i.protein, 0).toFixed(1)),
  carbs: Number(items.reduce((s, i) => s + i.carbs, 0).toFixed(1)),
  fat: Number(items.reduce((s, i) => s + i.fat, 0).toFixed(1)),
  fiber: Number(items.reduce((s, i) => s + i.fiber, 0).toFixed(1)),
});

export default function Meals() {
  const { toast, confirm } = useUI();

  const [meals, setMeals] = useState<Meal[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [editingMealId, setEditingMealId] = useState<number | null>(null);
  const [mealName, setMealName] = useState('');
  const [builderItems, setBuilderItems] = useState<MealItem[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchMeals = () => {
    fetch('/api/meals')
      .then(res => res.json())
      .then(data => setMeals(Array.isArray(data) ? data : []))
      .catch(err => console.error("Failed to fetch meals:", err));
  };

  useEffect(() => {
    fetchMeals();
  }, []);

  const startNewMeal = () => {
    setEditingMealId(null);
    setMealName('');
    setBuilderItems([]);
    setIsBuilding(true);
  };

  const startEditMeal = (meal: Meal) => {
    setEditingMealId(meal.id);
    setMealName(meal.name);
    setBuilderItems(meal.items.map(i => ({ ...i })));
    setIsBuilding(true);
  };

  const cancelBuilder = () => {
    setIsBuilding(false);
    setEditingMealId(null);
    setMealName('');
    setBuilderItems([]);
  };

  const addItemToBuilder = (item: PickedFoodItem) => {
    setBuilderItems(prev => [...prev, {
      barcode: item.barcode,
      name: item.name,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      fiber: item.fiber,
      portion_grams: item.portionGrams,
      type: item.type
    }]);
    toast(`Added ${item.name}`, 'info');
  };

  const saveMeal = async () => {
    if (!mealName.trim()) {
      toast('Give your meal a name', 'error');
      return;
    }
    if (builderItems.length === 0) {
      toast('Add at least one item', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: mealName.trim(),
        items: builderItems.map(({ id, ...rest }) => rest)
      };
      const res = await fetch(editingMealId ? `/api/meals/${editingMealId}` : '/api/meals', {
        method: editingMealId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to save meal');
      toast(editingMealId ? 'Meal updated!' : 'Meal saved!', 'success');
      cancelBuilder();
      fetchMeals();
    } catch (err) {
      console.error(err);
      toast('Error saving meal', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteMeal = (meal: Meal) => {
    confirm(`Delete "${meal.name}"?`, async () => {
      try {
        const res = await fetch(`/api/meals/${meal.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete');
        setMeals(prev => prev.filter(m => m.id !== meal.id));
        toast('Meal deleted', 'success');
      } catch (err) {
        console.error(err);
        toast('Error deleting meal', 'error');
      }
    });
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8 pb-32">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Meal Builder</h1>
            <p className="text-slate-400 mt-1">Build reusable meals and log them in one tap on the nutrition page.</p>
          </div>
          {!isBuilding && (
            <button
              onClick={startNewMeal}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-6 rounded-xl transition-colors flex items-center gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" /> New Meal
            </button>
          )}
        </div>

        {isBuilding ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Picker */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 lg:p-6 shadow-sm">
              <h3 className="font-semibold text-lg text-white mb-4">Add items</h3>
              <FoodPicker onConfirm={addItemToBuilder} confirmLabel="Add to Meal" />
            </div>

            {/* Builder panel */}
            <div className="bg-slate-900 border border-blue-500/30 rounded-2xl shadow-sm overflow-hidden flex flex-col h-fit">
              <div className="bg-blue-600 px-4 py-3 flex justify-between items-center">
                <div className="flex items-center gap-2 text-white">
                  <Utensils className="w-4 h-4" />
                  <span className="font-bold text-sm">{editingMealId ? 'Edit Meal' : 'New Meal'}</span>
                </div>
                <button onClick={cancelBuilder} className="text-blue-100 hover:text-white"><X className="w-4 h-4" /></button>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Meal name</label>
                  <input
                    type="text"
                    value={mealName}
                    onChange={e => setMealName(e.target.value)}
                    placeholder="e.g. Protein Breakfast"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                  {builderItems.length === 0 ? (
                    <p className="text-center text-slate-600 py-6 text-sm">No items yet. Use search, barcode, AI or manual entry to add some.</p>
                  ) : (
                    builderItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/50">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                            {item.type === 'drink' ? <CupSoda className="w-3.5 h-3.5 text-blue-500" /> : <Apple className="w-3.5 h-3.5 text-emerald-500" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{item.name}</p>
                            <p className="text-[10px] text-slate-500 uppercase font-bold">
                              {item.portion_grams}{item.type === 'drink' ? 'ml' : 'g'} • {item.calories} kcal • {item.protein}g P
                            </p>
                          </div>
                        </div>
                        <button onClick={() => setBuilderItems(builderItems.filter((_, i) => i !== idx))} className="text-slate-600 hover:text-red-500 transition-colors ml-2 shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {builderItems.length > 0 && (() => {
                  const totals = mealTotals(builderItems);
                  return (
                    <div className="flex flex-wrap justify-between gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 pt-2 border-t border-slate-800">
                      <span>Total: {totals.calories} kcal</span>
                      <div className="flex gap-2">
                        <span className="text-blue-500">{totals.protein}g P</span>
                        <span className="text-orange-500">{totals.carbs}g C</span>
                        <span className="text-red-500">{totals.fat}g F</span>
                        <span className="text-purple-400">{totals.fiber}g Fi</span>
                      </div>
                    </div>
                  );
                })()}

                <button
                  onClick={saveMeal}
                  disabled={saving || !mealName.trim() || builderItems.length === 0}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-600/20 uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" /> {saving ? 'Saving...' : editingMealId ? 'Update Meal' : 'Save Meal'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Saved meals list */
          <div className="space-y-4">
            {meals.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center text-slate-500 shadow-sm">
                <Utensils className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg font-semibold text-slate-300">No saved meals yet</p>
                <p className="text-sm text-slate-500 mt-1">Build a meal once, log it forever.</p>
                <button
                  onClick={startNewMeal}
                  className="mt-6 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 px-6 rounded-xl transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Build your first meal
                </button>
              </div>
            ) : (
              meals.map(meal => {
                const totals = mealTotals(meal.items);
                return (
                  <div key={meal.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                          <Utensils className="w-4.5 h-4.5 text-blue-500" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-white truncate">{meal.name}</h3>
                          <p className="text-[10px] text-slate-500 uppercase font-bold">
                            {totals.calories} kcal • {totals.protein}g P • {totals.carbs}g C • {totals.fat}g F • {totals.fiber}g Fi
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => startEditMeal(meal)} className="text-slate-500 hover:text-blue-500 transition-colors p-2 rounded-lg hover:bg-slate-800"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => deleteMeal(meal)} className="text-slate-500 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <div className="p-3 divide-y divide-slate-800/50">
                      {meal.items.map((item, idx) => (
                        <div key={idx} className="py-2 px-1 flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                              {item.type === 'drink' ? <CupSoda className="w-3.5 h-3.5 text-blue-500" /> : <Apple className="w-3.5 h-3.5 text-emerald-500" />}
                            </div>
                            <p className="text-sm text-white truncate">{item.name}</p>
                          </div>
                          <p className="text-xs text-slate-500 font-medium whitespace-nowrap pl-3">
                            {item.portion_grams}{item.type === 'drink' ? 'ml' : 'g'} • {item.calories} kcal
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
