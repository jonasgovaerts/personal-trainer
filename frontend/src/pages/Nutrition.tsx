import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Camera, ScanBarcode, Plus, Apple, CupSoda, Target,
  Sparkles, Activity, X, Trash2, Calendar, ChevronLeft, ChevronRight, Search as SearchIcon, Loader2, Utensils, AlertTriangle, Check, Pencil
} from 'lucide-react';
import Layout from '../components/Layout';
import { cn } from '../lib/utils';
import { useUI } from '../contexts/UIContext';
import { useUser } from '../contexts/UserContext';
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, 
  isSameDay, isToday, subMonths, addMonths, parseISO
} from 'date-fns';
import { Html5Qrcode } from "html5-qrcode";

interface LogItem {
  id: string;
  barcode?: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  type: 'food' | 'drink';
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  timestamp: Date;
  portionGrams?: number;
}

interface StagedItem {
  barcode?: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  portionGrams?: number;
  type?: 'food' | 'drink';
  brand?: string;
  image?: string;
}

interface SuggestionItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  type: 'food' | 'drink';
  brand?: string;
}

const MEAL_SUGGESTIONS: Record<'breakfast' | 'lunch' | 'dinner' | 'snack', SuggestionItem[]> = {
  breakfast: [
    { name: 'Oatmeal with Honey & Milk', calories: 120, protein: 4.2, carbs: 21, fat: 2.5, fiber: 2.0, type: 'food', brand: 'Popular Suggestion' },
    { name: 'Scrambled Eggs (2 large)', calories: 143, protein: 12.6, carbs: 0.8, fat: 9.5, fiber: 0, type: 'food', brand: 'Popular Suggestion' },
    { name: 'Whole Wheat Toast (2 slices)', calories: 240, protein: 9.0, carbs: 46.0, fat: 2.0, fiber: 4.0, type: 'food', brand: 'Popular Suggestion' },
    { name: 'Greek Yogurt (Plain, Low Fat)', calories: 73, protein: 10.0, carbs: 3.6, fat: 2.0, fiber: 0, type: 'food', brand: 'Popular Suggestion' },
    { name: 'Banana (1 medium)', calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, type: 'food', brand: 'Popular Suggestion' },
    { name: 'Whey Protein Shake (1 scoop)', calories: 120, protein: 24.0, carbs: 3.0, fat: 1.5, fiber: 0, type: 'drink', brand: 'Popular Suggestion' }
  ],
  lunch: [
    { name: 'Grilled Chicken Breast', calories: 165, protein: 31.0, carbs: 0.0, fat: 3.6, fiber: 0, type: 'food', brand: 'Popular Suggestion' },
    { name: 'White Rice (Cooked)', calories: 130, protein: 2.7, carbs: 28.0, fat: 0.3, fiber: 0.4, type: 'food', brand: 'Popular Suggestion' },
    { name: 'Turkey & Cheese Sandwich', calories: 320, protein: 18.0, carbs: 34.0, fat: 12.0, fiber: 2.0, type: 'food', brand: 'Popular Suggestion' },
    { name: 'Mixed Greens Salad (with Olive Oil)', calories: 110, protein: 1.0, carbs: 4.0, fat: 10.0, fiber: 1.5, type: 'food', brand: 'Popular Suggestion' },
    { name: 'Canned Tuna (in water)', calories: 116, protein: 26.0, carbs: 0.0, fat: 1.0, fiber: 0, type: 'food', brand: 'Popular Suggestion' }
  ],
  dinner: [
    { name: 'Baked Salmon Fillet', calories: 206, protein: 22.0, carbs: 0.0, fat: 12.0, fiber: 0, type: 'food', brand: 'Popular Suggestion' },
    { name: 'Steamed Broccoli', calories: 34, protein: 2.8, carbs: 7.0, fat: 0.4, fiber: 2.6, type: 'food', brand: 'Popular Suggestion' },
    { name: 'Beef Sirloin Steak', calories: 244, protein: 24.0, carbs: 0.0, fat: 16.0, fiber: 0, type: 'food', brand: 'Popular Suggestion' },
    { name: 'Baked Sweet Potato', calories: 86, protein: 1.6, carbs: 20.0, fat: 0.1, fiber: 3.0, type: 'food', brand: 'Popular Suggestion' },
    { name: 'Brown Rice (Cooked)', calories: 111, protein: 2.6, carbs: 23.0, fat: 0.9, fiber: 1.8, type: 'food', brand: 'Popular Suggestion' }
  ],
  snack: [
    { name: 'Almonds (Handful, 28g)', calories: 580, protein: 21.0, carbs: 22.0, fat: 49.0, fiber: 12.5, type: 'food', brand: 'Popular Suggestion' },
    { name: 'Apple (with 1 tbsp Peanut Butter)', calories: 190, protein: 4.5, carbs: 25.0, fat: 8.5, fiber: 3.5, type: 'food', brand: 'Popular Suggestion' },
    { name: 'Rice Cakes (2 plain)', calories: 70, protein: 1.5, carbs: 15.0, fat: 0.6, fiber: 0.4, type: 'food', brand: 'Popular Suggestion' },
    { name: 'Dark Chocolate (70% Cocoa, 30g)', calories: 170, protein: 2.0, carbs: 13.0, fat: 12.0, fiber: 3.0, type: 'food', brand: 'Popular Suggestion' },
    { name: 'Cottage Cheese (Low Fat)', calories: 82, protein: 11.0, carbs: 3.4, fat: 2.3, fiber: 0, type: 'food', brand: 'Popular Suggestion' }
  ]
};

const getDefaultMealForTime = (): 'breakfast' | 'lunch' | 'dinner' | 'snack' => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 18) return 'snack';
  if (hour >= 18 && hour < 22) return 'dinner';
  return 'snack';
};

export default function Nutrition() {
  const { t } = useTranslation();
  const { toast, confirm } = useUI();
  const { user } = useUser();
  
  const [goal, setGoal] = useState(user?.goal_calories || 2500);
  const proteinGoal = user?.goal_protein || 150;
  const carbsGoal = user?.goal_carbs || 250;
  const fatGoal = user?.goal_fat || 80;

  const [logs, setLogs] = useState<LogItem[]>([]);
  const [historyLogs, setHistoryLogs] = useState<LogItem[]>([]);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [healthActivities, setHealthActivities] = useState<any[]>([]);
  const [savedMeals, setSavedMeals] = useState<any[]>([]);
  const [waterLogs, setWaterLogs] = useState<{ id: number; ml: number }[]>([]);
  const [mealServings, setMealServings] = useState<Record<number, number>>({});
  const [loggingMealId, setLoggingMealId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'manual' | 'ai' | 'barcode' | 'search' | 'meals'>('search');
  const [selectedMeal, setSelectedMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>(getDefaultMealForTime());
  const [viewMode, setViewMode] = useState<'today' | 'week' | 'month'>('today');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Meal Builder State
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);

  // Verification Modal State
  const [verificationItem, setVerificationItem] = useState<StagedItem | null>(null);
  const [portionGrams, setPortionGrams] = useState<string>('100');

  // Edit Modal State
  const [editingLog, setEditingLog] = useState<LogItem | null>(null);
  const [originalLog, setOriginalLog] = useState<LogItem | null>(null);

  useEffect(() => {
    if (user?.goal_calories) {
      setGoal(user.goal_calories);
    }
  }, [user]);

  // Fetch today's logs
  const fetchTodayLogs = () => {
    const localDate = format(selectedDate, 'yyyy-MM-dd');
    fetch(`/api/nutrition?user_id=me&date=${localDate}&_t=${Date.now()}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data)) {
          const formattedData = data.map((item: any) => ({
            id: item.id.toString(),
            name: item.name,
            calories: item.calories,
            protein: item.protein || 0,
            carbs: item.carbs || 0,
            fat: item.fat || 0,
            fiber: item.fiber || 0,
            type: item.type as 'food' | 'drink',
            meal: item.meal as 'breakfast' | 'lunch' | 'dinner' | 'snack',
            timestamp: new Date(item.timestamp),
            portionGrams: item.portion_grams
          }));
          setLogs(formattedData);
        }
      })
      .catch(err => console.error("Failed to fetch today's nutrition logs:", err));
  };

  // Fetch month's logs
  const fetchMonthLogs = () => {
    const start = startOfMonth(currentMonth);
    const startDate = new Date(start);
    startDate.setDate(startDate.getDate() - 10); // go back 10 days before start of month to cover weekly charts
    
    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    fetch(`/api/nutrition?user_id=me&start_date=${startStr}&end_date=${endStr}&_t=${Date.now()}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data)) {
          const formattedData = data.map((item: any) => ({
            id: item.id.toString(),
            name: item.name,
            calories: item.calories,
            protein: item.protein || 0,
            carbs: item.carbs || 0,
            fat: item.fat || 0,
            fiber: item.fiber || 0,
            type: item.type as 'food' | 'drink',
            meal: item.meal as 'breakfast' | 'lunch' | 'dinner' | 'snack',
            timestamp: new Date(item.timestamp),
            portionGrams: item.portion_grams
          }));
          setHistoryLogs(formattedData);
        }
      })
      .catch(err => console.error("Failed to fetch history nutrition logs:", err));
  };

  const fetchSavedMeals = () => {
    fetch('/api/meals')
      .then(res => res.json())
      .then(data => setSavedMeals(Array.isArray(data) ? data : []))
      .catch(err => console.error("Failed to fetch saved meals:", err));
  };

  const fetchWater = () => {
    const localDate = format(selectedDate, 'yyyy-MM-dd');
    fetch(`/api/water?date=${localDate}`)
      .then(res => res.json())
      .then(data => setWaterLogs(Array.isArray(data) ? data : []))
      .catch(err => console.error("Failed to fetch water:", err));
  };

  const fetchWorkouts = () => {
    fetch(`/api/workouts/history?user_id=me&_t=${Date.now()}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        setWorkouts(Array.isArray(data) ? data : []);
      })
      .catch(err => console.error("Failed to fetch workouts:", err));
  };

  const fetchHealthActivities = () => {
    fetch(`/api/health/activities?_t=${Date.now()}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        setHealthActivities(Array.isArray(data) ? data : []);
      })
      .catch(err => console.error("Failed to fetch health activities:", err));
  };

  useEffect(() => {
    fetchWorkouts();
    fetchHealthActivities();
    fetchSavedMeals();
    fetchWater();

    // Auto-refresh every 10 seconds to keep stats and lists up to date
    const interval = setInterval(() => {
      fetchTodayLogs();
      fetchMonthLogs();
      fetchWorkouts();
      fetchHealthActivities();
      fetchWater();
    }, 10000);

    const handleRefresh = () => {
      fetchTodayLogs();
      fetchMonthLogs();
      fetchWorkouts();
      fetchHealthActivities();
      fetchWater();
    };
    window.addEventListener('refreshData', handleRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('refreshData', handleRefresh);
    };
  }, []);

  useEffect(() => {
    fetchTodayLogs();
    fetchWater();
  }, [selectedDate]);

  useEffect(() => {
    fetchMonthLogs();
  }, [currentMonth]);
  
  // Manual Entry State
  const [manualName, setManualName] = useState('');
  const [manualCal, setManualCal] = useState('');
  const [manualP, setManualP] = useState('');
  const [manualC, setManualC] = useState('');
  const [manualF, setManualF] = useState('');
  const [manualFiber, setManualFiber] = useState('');
  const [manualType, setManualType] = useState<'food' | 'drink'>('food');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Barcode State
  const [barcodeInput, setBarcodeInput] = useState('');

  // AI & Camera State
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Calculate today's burned calories from workouts
  const activeDateStr = format(selectedDate, 'yyyy-MM-dd');
  const workoutBurned = workouts
    .filter(w => format(new Date(w.date), 'yyyy-MM-dd') === activeDateStr)
    .reduce((sum, item) => sum + (item.calories_burned || 0), 0);

  const healthBurned = healthActivities
    .filter(ha => format(parseISO(ha.start), 'yyyy-MM-dd') === activeDateStr)
    .reduce((sum, item) => sum + (item.active_energy_kcal || 0), 0);

  const burnedCals = Math.round(workoutBurned + healthBurned);

  const consumed = logs.reduce((sum, item) => sum + item.calories, 0);
  const consumedP = Number(logs.reduce((sum, item) => sum + item.protein, 0).toFixed(2));
  const consumedC = Number(logs.reduce((sum, item) => sum + item.carbs, 0).toFixed(2));
  const consumedF = Number(logs.reduce((sum, item) => sum + item.fat, 0).toFixed(2));
  const consumedFiber = Number(logs.reduce((sum, item) => sum + item.fiber, 0).toFixed(2));

  const netConsumed = Math.max(0, consumed - burnedCals);
  const remaining = goal - netConsumed;
  const progressPercent = Math.min(100, Math.max(0, (netConsumed / goal) * 100));

  // Hydration (first-class, via /api/water)
  const loggedWater = waterLogs.reduce((sum, l) => sum + (l.ml || 0), 0);
  const waterTarget = user?.goal_water_ml || 2500;
  const waterProgress = Math.min(100, (loggedWater / waterTarget) * 100);

  const logWater = async (amount: number) => {
    try {
      const res = await fetch('/api/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ml: amount, timestamp: getLogTimestamp() }),
      });
      if (!res.ok) throw new Error('failed');
      fetchWater();
    } catch (err) {
      console.error(err);
      toast('Error logging water', 'error');
    }
  };

  const undoLastWater = async () => {
    if (waterLogs.length === 0) return;
    try {
      await fetch(`/api/water/${waterLogs[0].id}`, { method: 'DELETE' });
      fetchWater();
    } catch (err) {
      console.error(err);
    }
  };

  // Personalized Suggestions based on past history (excluding water)
  const personalizedSuggestions = (): SuggestionItem[] => {
    const mealLogs = historyLogs.filter(log => log.meal === selectedMeal && log.name.toLowerCase().trim() !== 'water');
    const counts: Record<string, { count: number; log: LogItem }> = {};
    mealLogs.forEach(log => {
      const key = log.name.toLowerCase().trim();
      if (!counts[key]) {
        counts[key] = { count: 0, log };
      }
      counts[key].count += 1;
    });

    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(item => ({
        name: item.log.name,
        calories: item.log.calories,
        protein: item.log.protein,
        carbs: item.log.carbs,
        fat: item.log.fat,
        fiber: item.log.fiber,
        type: item.log.type,
        brand: 'Frequently Logged'
      }));
  };

  // --- Barcode Scanner Logic ---
  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    
    // Use a small delay to ensure the DOM element "reader" is painted
    const timeoutId = setTimeout(() => {
      if (activeTab === 'barcode' && isCameraOpen) {
        try {
          html5QrCode = new Html5Qrcode("reader");
          html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 150 },
            },
            (decodedText) => {
              setBarcodeInput(decodedText);
              if (html5QrCode && html5QrCode.isScanning) {
                html5QrCode.stop().then(() => {
                  html5QrCode?.clear();
                }).catch(e => console.error("Failed to stop scanner", e));
              }
              setIsCameraOpen(false);
              toast('Barcode captured! Click Lookup to search.', 'info');
            },
            () => {
              // parse error, ignore
            }
          ).catch((err) => {
            console.error("Camera start failed", err);
            toast("Failed to start camera. Check permissions.", "error");
            setIsCameraOpen(false);
          });
        } catch (e) {
          console.error("Scanner initialization failed", e);
        }
      }
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (html5QrCode) {
        try {
          if (html5QrCode.isScanning) {
            html5QrCode.stop().then(() => {
              html5QrCode?.clear();
            }).catch(e => console.warn("Scanner stop error", e));
          } else {
            html5QrCode.clear();
          }
        } catch (e) {
          console.warn("Scanner clear error", e);
        }
      }
    };
  }, [activeTab, isCameraOpen]);

  // Attach the stream to the video element for AI Cam
  useEffect(() => {
    if (activeTab === 'ai' && isCameraOpen && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [activeTab, isCameraOpen, cameraStream]);

  // Cleanup camera stream when component unmounts
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const getLogTimestamp = () => {
    const now = new Date();
    const logDate = new Date(selectedDate);
    logDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    return logDate.toISOString();
  };

  const addLog = async (name: string, calories: number, protein: number, carbs: number, fat: number, fiber: number, type: 'food' | 'drink' = 'food', barcode?: string, portionGrams?: number) => {
    try {
      const res = await fetch('/api/nutrition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.id,
          barcode,
          name,
          calories,
          protein,
          carbs,
          fat,
          fiber,
          portion_grams: portionGrams,
          type,
          meal: selectedMeal,
          timestamp: getLogTimestamp()
        })
      });

      if (!res.ok) throw new Error('Failed to save log to database');

      const savedItem = await res.json();

      const newItem: LogItem = {
        id: savedItem.id.toString(),
        barcode: savedItem.barcode,
        name: savedItem.name,
        calories: savedItem.calories,
        protein: savedItem.protein || 0,
        carbs: savedItem.carbs || 0,
        fat: savedItem.fat || 0,
        fiber: savedItem.fiber || 0,
        type: itemType(type),
        meal: itemMeal(selectedMeal),
        timestamp: new Date(savedItem.timestamp),
        portionGrams: savedItem.portion_grams
      };
      
      setLogs(prev => [newItem, ...prev]);
      setHistoryLogs(prev => [newItem, ...prev]);
    } catch (err) {
      console.error(err);
      toast('Failed to save nutrition log.', 'error');
    }
  };

  const itemType = (val: string): 'food' | 'drink' => (val === 'drink' ? 'drink' : 'food');
  const itemMeal = (val: string): 'breakfast' | 'lunch' | 'dinner' | 'snack' => {
     if (['breakfast', 'lunch', 'dinner', 'snack'].includes(val)) return val as any;
     return 'breakfast';
  };

  const logMeal = async () => {
    if (stagedItems.length === 0) return;
    
    confirm(`Log all ${stagedItems.length} items to ${selectedMeal}?`, async () => {
      for (const item of stagedItems) {
        await addLog(item.name, item.calories, item.protein, item.carbs, item.fat, item.fiber, item.type || 'food', item.barcode, item.portionGrams);
      }
      setStagedItems([]);
      toast('Meal logged successfully!', 'success');
    });
  };

  const logSavedMeal = async (meal: any) => {
    if (!meal.items || meal.items.length === 0 || loggingMealId) return;
    // The meal's items represent (meal.servings) servings; scale to the chosen amount.
    const chosen = mealServings[meal.id] ?? 1;
    const base = meal.servings && meal.servings > 0 ? meal.servings : 1;
    const factor = chosen / base;
    setLoggingMealId(meal.id);
    try {
      for (const item of meal.items) {
        await addLog(
          item.name,
          Math.round(item.calories * factor),
          Number((item.protein * factor).toFixed(1)),
          Number((item.carbs * factor).toFixed(1)),
          Number((item.fat * factor).toFixed(1)),
          Number(((item.fiber || 0) * factor).toFixed(1)),
          item.type || 'food',
          item.barcode,
          Number(((item.portion_grams || 0) * factor).toFixed(1)),
        );
      }
      toast(`${meal.name} (${chosen}×) logged to ${selectedMeal}!`, 'success');
    } finally {
      setLoggingMealId(null);
    }
  };

  const deleteLog = async (id: string) => {
    confirm(
      t('nutrition.confirmDelete') || 'Are you sure you want to delete this item?', 
      async () => {
        try {
          const res = await fetch(`/api/nutrition/${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Failed to delete log');
          setLogs(prev => prev.filter(log => log.id !== id));
          setHistoryLogs(prev => prev.filter(log => log.id !== id));
          toast('Item deleted', 'success');
        } catch (err) {
          console.error(err);
          toast('Failed to delete nutrition log.', 'error');
        }
      }
    );
  };

  const updateLog = async (updated: LogItem) => {
    try {
      const res = await fetch(`/api/nutrition/${updated.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: parseInt(updated.id, 10),
          user_id: user?.id,
          barcode: updated.barcode,
          name: updated.name,
          calories: updated.calories,
          protein: updated.protein,
          carbs: updated.carbs,
          fat: updated.fat,
          fiber: updated.fiber,
          portion_grams: updated.portionGrams,
          type: updated.type,
          meal: updated.meal,
          timestamp: updated.timestamp
        })
      });

      if (!res.ok) throw new Error('Failed to update log');

      const savedItem = await res.json();
      const mapped: LogItem = {
        id: savedItem.id.toString(),
        barcode: savedItem.barcode,
        name: savedItem.name,
        calories: savedItem.calories,
        protein: savedItem.protein || 0,
        carbs: savedItem.carbs || 0,
        fat: savedItem.fat || 0,
        fiber: savedItem.fiber || 0,
        type: itemType(savedItem.type),
        meal: itemMeal(savedItem.meal),
        timestamp: new Date(savedItem.timestamp),
        portionGrams: savedItem.portion_grams
      };

      setLogs(prev => prev.map(item => item.id === mapped.id ? mapped : item));
      setHistoryLogs(prev => prev.map(item => item.id === mapped.id ? mapped : item));
      setEditingLog(null);
      toast('Item updated successfully', 'success');
    } catch (err) {
      console.error(err);
      toast('Failed to update nutrition log.', 'error');
    }
  };

  const handleManualAdd = () => {
    if (!manualName || !manualCal) return;
    addLog(manualName, parseInt(manualCal, 10), parseFloat(manualP) || 0, parseFloat(manualC) || 0, parseFloat(manualF) || 0, parseFloat(manualFiber) || 0, manualType);
    setManualName('');
    setManualCal('');
    setManualP('');
    setManualC('');
    setManualF('');
    setManualFiber('');
    toast(`${manualName} logged!`, 'success');
  };

  const handleSearch = async () => {
    if (!searchQuery || isSearching) return;
    setIsSearching(true);
    setHasSearched(true);
    setSearchResults([]); // Clear previous results to show loading state clearly
    try {
      const res = await fetch(`/api/nutrition/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast('Search failed', 'error');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleBarcodeLookup = async (code: string) => {
    if (!code || isProcessing) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/nutrition/barcode?barcode=${code}`);
      if (!res.ok) throw new Error('Product not found');
      const data = await res.json();
      
      const item: StagedItem = {
        barcode: code,
        name: data.name || 'Unknown',
        calories: Number(data.calories) || 0,
        protein: Number(data.protein) || 0,
        carbs: Number(data.carbs) || 0,
        fat: Number(data.fat) || 0,
        fiber: Number(data.fiber) || 0,
        brand: data.brand,
        image: data.image
      };
      
      setVerificationItem(item);
      setPortionGrams('100');
    } catch (err) {
      console.error(err);
      toast('Barcode not recognized. Try AI Cam!', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerVerification = (item: any) => {
    const safeItem: StagedItem = {
      barcode: item.barcode,
      name: item.name || 'Unknown',
      calories: Number(item.calories) || 0,
      protein: Number(item.protein) || 0,
      carbs: Number(item.carbs) || 0,
      fat: Number(item.fat) || 0,
      fiber: Number(item.fiber) || 0,
      type: item.type || 'food',
      brand: item.brand,
      image: item.image
    };
    setVerificationItem(safeItem);
    setPortionGrams('100');
  };

  const finalizeLogging = (mode: 'meal' | 'quick') => {
    if (!verificationItem) return;
    
    const grams = parseFloat(portionGrams) || 100;
    const factor = grams / 100;
    
    const finalItem: StagedItem = {
      ...verificationItem,
      calories: Math.round(verificationItem.calories * factor),
      protein: Number((verificationItem.protein * factor).toFixed(2)),
      carbs: Number((verificationItem.carbs * factor).toFixed(2)),
      fat: Number((verificationItem.fat * factor).toFixed(2)),
      fiber: Number((verificationItem.fiber * factor).toFixed(2)),
      portionGrams: grams
    };

    if (mode === 'meal') {
      setStagedItems([...stagedItems, finalItem]);
      toast(`Added ${finalItem.name} to meal builder`, 'info');
    } else {
      addLog(finalItem.name, finalItem.calories, finalItem.protein, finalItem.carbs, finalItem.fat, finalItem.fiber, finalItem.type || 'food', finalItem.barcode, grams);
      toast(`${finalItem.name} logged!`, 'success');
    }

    setVerificationItem(null);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processFile = async (file: File | Blob) => {
    if (isProcessing) return;
    setIsProcessing(true);
    const formData = new FormData();
    formData.append('image', file, 'capture.jpg');
    if (aiPrompt) {
      formData.append('prompt', aiPrompt);
    }

    try {
      const res = await fetch(`/api/nutrition/analyze?mode=ai`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to analyze image');
      }

      const data = await res.json();
      
      triggerVerification({
        name: data.name || 'Unknown Item',
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fat: data.fat,
        fiber: data.fiber || 0,
        type: data.type || 'food'
      });
      toast('Analysis complete! Please verify.', 'success');
      setAiPrompt(''); // Clear prompt after success
    } catch (err: any) {
      console.error(err);
      toast(err.message || 'Error processing image.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const startCamera = async () => {
    if (activeTab === 'barcode') {
       setIsCameraOpen(true);
       return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setCameraStream(stream);
      setIsCameraOpen(true);
    } catch (err) {
      console.error("Camera access denied or unavailable", err);
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (blob) {
            stopCamera();
            processFile(blob);
          }
        }, 'image/jpeg');
      }
    }
  };

  // --- Calendar Logic ---
  const monthDays = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  const getDayCalories = (date: Date) => {
    return historyLogs
      .filter(l => isSameDay(new Date(l.timestamp), date))
      .reduce((sum, l) => sum + l.calories, 0);
  };

  const getDayBurnedCalories = (date: Date) => {
    const dayStr = format(date, 'yyyy-MM-dd');

    const workoutBurned = workouts
      .filter(w => format(new Date(w.date), 'yyyy-MM-dd') === dayStr)
      .reduce((sum, item) => sum + (item.calories_burned || 0), 0);

    const healthBurned = healthActivities
      .filter(ha => format(parseISO(ha.start), 'yyyy-MM-dd') === dayStr)
      .reduce((sum, item) => sum + (item.active_energy_kcal || 0), 0);

    return Math.round(workoutBurned + healthBurned);
  };

  const getSelectedDateLabel = () => {
    if (isToday(selectedDate)) {
      return 'Today';
    }
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (isSameDay(selectedDate, yesterday)) {
      return 'Yesterday';
    }
    return format(selectedDate, 'EEEE, d MMMM yyyy');
  };

  const handlePrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
  };

  const handleNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
  };

  // Last 7 days of nutrition, oldest → newest, for the weekly trend view.
  const getWeekData = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const dayLogs = historyLogs.filter(l => isSameDay(new Date(l.timestamp), d));
      days.push({
        label: format(d, 'EEE'),
        calories: Math.round(dayLogs.reduce((s, l) => s + l.calories, 0)),
        protein: Math.round(dayLogs.reduce((s, l) => s + (l.protein || 0), 0)),
        carbs: Math.round(dayLogs.reduce((s, l) => s + (l.carbs || 0), 0)),
        fat: Math.round(dayLogs.reduce((s, l) => s + (l.fat || 0), 0)),
      });
    }
    return days;
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8 pb-32">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">{t('nutrition.title')}</h1>
            <p className="text-slate-400 mt-1">{t('nutrition.subtitle')}</p>
          </div>
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => setViewMode('today')}
              className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", viewMode === 'today' ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300")}
            >
              {t('nutrition.view.today') || 'TODAY'}
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", viewMode === 'week' ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300")}
            >
              {t('nutrition.view.week') || 'WEEK'}
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", viewMode === 'month' ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300")}
            >
              {t('nutrition.view.month') || 'MONTHLY'}
            </button>
          </div>
        </div>

        {viewMode === 'today' ? (
          <>
            {/* Date Selector Navigation Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <button 
                onClick={handlePrevDay}
                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <div className="flex flex-col items-center">
                <span className="text-sm font-bold text-white uppercase tracking-wider">
                  {getSelectedDateLabel()}
                </span>
                {!isToday(selectedDate) && (
                  <span className="text-[10px] text-slate-400 mt-0.5 font-semibold">
                    {format(selectedDate, 'yyyy-MM-dd')}
                  </span>
                )}
              </div>
              
              <div className="flex gap-2">
                {!isToday(selectedDate) && (
                  <button 
                    onClick={() => setSelectedDate(new Date())}
                    className="px-3 py-1 text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg uppercase tracking-wider transition-colors flex items-center gap-1"
                  >
                    Today
                  </button>
                )}
                <button 
                  onClick={handleNextDay}
                  disabled={isToday(selectedDate)}
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            {/* Dashboard Top */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-6">
                {/* Circular Progress */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center relative">
                  <div className="relative w-32 h-32 lg:w-40 lg:h-40 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" className="text-slate-800 stroke-current" strokeWidth="8" fill="transparent" />
                      <circle cx="50" cy="50" r="40" className={cn("stroke-current transition-all duration-1000", remaining < 0 ? "text-red-500" : "text-emerald-500")} strokeWidth="8" fill="transparent" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * progressPercent) / 100} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl lg:text-3xl font-bold text-white">{netConsumed}</span>
                      <span className="text-[10px] lg:text-xs font-semibold text-slate-500 uppercase tracking-wider">KCAL</span>
                    </div>
                  </div>

                  <div className="mt-6 w-full flex justify-between text-center px-2 lg:px-4">
                    <div>
                      <p className="text-[10px] lg:text-xs font-semibold text-slate-500 uppercase">{t('nutrition.goal')}</p>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <Target className="w-3 h-3 text-blue-500" />
                        <input 
                          type="number" 
                          inputMode="numeric"
                          value={goal}
                          onChange={(e) => setGoal(parseInt(e.target.value) || 0)}
                          className="w-12 lg:w-16 bg-transparent text-white font-bold text-base lg:text-lg text-center focus:outline-none border-b border-dashed border-slate-600 focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] lg:text-xs font-semibold text-slate-500 uppercase">{t('nutrition.remaining')}</p>
                      <p className={cn("font-bold text-base lg:text-lg mt-1", remaining < 0 ? "text-red-500" : "text-emerald-500")}>
                        {Math.abs(remaining)}
                      </p>
                    </div>
                  </div>

                  {burnedCals > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-800/50 w-full flex justify-around text-[10px] font-medium text-slate-400">
                      <div>Food: <span className="font-semibold text-white">{consumed} kcal</span></div>
                      <div>Active: <span className="font-semibold text-orange-400">-{burnedCals} kcal</span></div>
                    </div>
                  )}

                  {/* Macros Section */}
                  <div className="mt-8 w-full grid grid-cols-2 lg:grid-cols-1 gap-2 lg:gap-4 px-1 lg:px-2">
                    <div className="text-center lg:text-left">
                      <div className="flex flex-col lg:flex-row lg:justify-between text-[9px] lg:text-[10px] font-bold uppercase mb-1 gap-0.5 lg:gap-0">
                        <span className="text-blue-500">Prot</span>
                        <span className="text-slate-400 whitespace-nowrap">{consumedP}g / {proteinGoal}g</span>
                      </div>
                      <div className="h-1.5 lg:h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${Math.min(100, (consumedP / proteinGoal) * 100)}%` }} />
                      </div>
                    </div>
                    <div className="text-center lg:text-left">
                      <div className="flex flex-col lg:flex-row lg:justify-between text-[9px] lg:text-[10px] font-bold uppercase mb-1 gap-0.5 lg:gap-0">
                        <span className="text-orange-500">Carbs</span>
                        <span className="text-slate-400 whitespace-nowrap">{consumedC}g / {carbsGoal}g</span>
                      </div>
                      <div className="h-1.5 lg:h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${Math.min(100, (consumedC / carbsGoal) * 100)}%` }} />
                      </div>
                    </div>
                    <div className="text-center lg:text-left">
                      <div className="flex flex-col lg:flex-row lg:justify-between text-[9px] lg:text-[10px] font-bold uppercase mb-1 gap-0.5 lg:gap-0">
                        <span className="text-emerald-500">Fat</span>
                        <span className="text-slate-400 whitespace-nowrap">{consumedF}g / {fatGoal}g</span>
                      </div>
                      <div className="h-1.5 lg:h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min(100, (consumedF / fatGoal) * 100)}%` }} />
                      </div>
                    </div>
                    <div className="text-center lg:text-left">
                      <div className="flex flex-col lg:flex-row lg:justify-between text-[9px] lg:text-[10px] font-bold uppercase mb-1 gap-0.5 lg:gap-0">
                        <span className="text-purple-500">Fiber</span>
                        <span className="text-slate-400 whitespace-nowrap">{consumedFiber}g / 25g</span>
                      </div>
                      <div className="h-1.5 lg:h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${Math.min(100, (consumedFiber / 25) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hydration Tracker */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <CupSoda className="w-5 h-5 text-blue-500" />
                      <h3 className="font-semibold text-base text-white">Hydration</h3>
                    </div>
                    <span className="text-xs font-bold text-blue-400">{loggedWater} / {waterTarget} ml</span>
                  </div>

                  <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden mb-6 relative">
                    <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${waterProgress}%` }} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => logWater(250)}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl transition-all"
                    >
                      <Plus className="w-3.5 h-3.5 text-blue-500" /> +250ml {t('nutrition.water.glass') || 'Glass'}
                    </button>
                    <button
                      onClick={() => logWater(500)}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl transition-all"
                    >
                      <Plus className="w-3.5 h-3.5 text-blue-500" /> +500ml {t('nutrition.water.bottle') || 'Bottle'}
                    </button>
                  </div>
                  {waterLogs.length > 0 && (
                    <button onClick={undoLastWater} className="mt-3 text-[10px] font-bold text-slate-500 hover:text-red-400 uppercase tracking-wider transition-colors">
                      {t('nutrition.water.undo') || 'Undo last'}
                    </button>
                  )}
                </div>
              </div>

              {/* Logging Interface */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 lg:p-6 shadow-sm flex flex-col">
                <h3 className="font-semibold text-lg text-white mb-4">{t('nutrition.logTitle')}</h3>
                
                {/* Meal Selector */}
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 mb-6 shrink-0">
                  {['breakfast', 'lunch', 'dinner', 'snack'].map(m => (
                    <button
                      key={m}
                      onClick={() => setSelectedMeal(m as any)}
                      className={cn("flex-1 py-1 text-sm font-semibold capitalize transition-all rounded-lg", selectedMeal === m ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-300")}
                    >
                      {t(`nutrition.meal.${m}`)}
                    </button>
                  ))}
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 mb-6 shrink-0 overflow-x-auto no-scrollbar">
                  <button
                    onClick={() => setActiveTab('search')}
                    className={cn("flex-1 flex items-center justify-center gap-1.5 lg:gap-2 py-2 px-3 rounded-lg text-xs lg:text-sm font-semibold transition-all whitespace-nowrap", activeTab === 'search' ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300")}
                  >
                    <SearchIcon className="w-3.5 h-3.5" /> Search
                  </button>
                  <button
                    onClick={() => setActiveTab('meals')}
                    className={cn("flex-1 flex items-center justify-center gap-1.5 lg:gap-2 py-2 px-3 rounded-lg text-xs lg:text-sm font-semibold transition-all whitespace-nowrap", activeTab === 'meals' ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300")}
                  >
                    <Utensils className="w-3.5 h-3.5" /> Meals
                  </button>
                  <button
                    onClick={() => setActiveTab('barcode')}
                    className={cn("flex-1 flex items-center justify-center gap-1.5 lg:gap-2 py-2 px-3 rounded-lg text-xs lg:text-sm font-semibold transition-all whitespace-nowrap", activeTab === 'barcode' ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300")}
                  >
                    <ScanBarcode className="w-3.5 h-3.5" /> Barcode
                  </button>
                  <button
                    onClick={() => setActiveTab('ai')}
                    className={cn("flex-1 flex items-center justify-center gap-1.5 lg:gap-2 py-2 px-3 rounded-lg text-xs lg:text-sm font-semibold transition-all whitespace-nowrap", activeTab === 'ai' ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300")}
                  >
                    <Camera className="w-3.5 h-3.5" /> {t('nutrition.tab.camera') || "AI"}
                  </button>
                  <button
                    onClick={() => setActiveTab('manual')}
                    className={cn("flex-1 flex items-center justify-center gap-1.5 lg:gap-2 py-2 px-3 rounded-lg text-xs lg:text-sm font-semibold transition-all whitespace-nowrap", activeTab === 'manual' ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300")}
                  >
                    <Plus className="w-3.5 h-3.5" /> Manual
                  </button>
                </div>

                {/* Tab Contents */}
                <div className="flex-1 flex flex-col">
                  {activeTab === 'search' && (
                    <div className="space-y-4">
                      <div className="relative">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input 
                          type="text" 
                          value={searchQuery}
                          disabled={isSearching}
                          onChange={e => setSearchQuery(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSearch()}
                          placeholder="Search food (e.g. Cooked Potatoes)"
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                        />
                        <button 
                          onClick={handleSearch}
                          disabled={isSearching || !searchQuery}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {isSearching && <Loader2 className="w-3 h-3 animate-spin" />}
                          {isSearching ? '...' : 'Find'}
                        </button>
                      </div>

                      <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {isSearching ? (
                          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
                        ) : !hasSearched ? (
                          <div className="space-y-4 pt-2">
                            {/* Personalized Suggestions Row */}
                            {personalizedSuggestions().length > 0 && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-400">
                                  <Activity className="w-4 h-4" />
                                  <span>Frequently Logged</span>
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                  {personalizedSuggestions().map((item, idx) => (
                                    <div key={`fav-${idx}`} className="bg-blue-950/25 border border-blue-900/30 rounded-xl p-3 flex items-center justify-between group hover:border-blue-800 transition-colors">
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                          {item.type === 'drink' ? <CupSoda className="w-5 h-5 text-blue-500" /> : <Apple className="w-5 h-5 text-blue-400" />}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-sm font-bold text-white truncate">{item.name}</p>
                                          <p className="text-[10px] text-slate-500 uppercase font-bold">
                                            {Math.round(item.calories)} kcal / 100{item.type === 'drink' ? 'ml' : 'g'} • P:{item.protein}g C:{item.carbs}g F:{item.fat}g
                                          </p>
                                        </div>
                                      </div>
                                      <button onClick={() => triggerVerification(item)} className="bg-blue-900/50 hover:bg-blue-600 p-2 rounded-lg text-blue-400 hover:text-white transition-all ml-4 shrink-0">
                                        <Plus className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Popular Suggestions Row */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                                <Sparkles className="w-4 h-4 text-amber-500" />
                                <span>Suggested for {t(`nutrition.meal.${selectedMeal}`)}</span>
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                {MEAL_SUGGESTIONS[selectedMeal]?.map((item, idx) => (
                                  <div key={idx} className="bg-slate-950/50 border border-slate-800 rounded-xl p-3 flex items-center justify-between group hover:border-slate-700 transition-colors">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="w-10 h-10 rounded-lg bg-slate-800/80 flex items-center justify-center shrink-0">
                                        {item.type === 'drink' ? <CupSoda className="w-5 h-5 text-blue-500" /> : <Apple className="w-5 h-5 text-emerald-500" />}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-sm font-bold text-white truncate">{item.name}</p>
                                        <p className="text-[10px] text-slate-500 uppercase font-bold">
                                          {Math.round(item.calories)} kcal / 100{item.type === 'drink' ? 'ml' : 'g'} • P:{item.protein}g C:{item.carbs}g F:{item.fat}g
                                        </p>
                                      </div>
                                    </div>
                                    <button onClick={() => triggerVerification(item)} className="bg-slate-800 p-2 rounded-lg text-blue-500 hover:bg-blue-600 hover:text-white transition-all ml-4 shrink-0">
                                      <Plus className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : searchResults.length === 0 ? (
                          <p className="text-center text-slate-500 py-8 text-sm italic">No items found. Try a different name.</p>
                        ) : (
                          searchResults.map((item, idx) => (
                            <div key={idx} className="bg-slate-950/50 border border-slate-800 rounded-xl p-3 flex items-center justify-between group hover:border-slate-700 transition-colors">
                              <div className="flex items-center gap-3 min-w-0">
                                {item.image ? <img src={item.image} className="w-10 h-10 rounded-lg object-cover shrink-0" alt="" /> : <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0"><Apple className="w-5 h-5 text-slate-600" /></div>}
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-white truncate">{item.name}</p>
                                  <p className="text-[10px] text-slate-500 uppercase font-bold">{Math.round(Number(item.calories) || 0)} kcal / 100{item.type === 'drink' ? 'ml' : 'g'} • {item.brand || 'No Brand'}</p>
                                </div>
                              </div>
                              <button onClick={() => triggerVerification(item)} className="bg-slate-800 p-2 rounded-lg text-blue-500 hover:bg-blue-600 hover:text-white transition-all ml-4 shrink-0">
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'meals' && (
                    <div className="space-y-3">
                      {savedMeals.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center p-8 bg-slate-950/50 border border-dashed border-slate-700 rounded-xl">
                          <Utensils className="w-10 h-10 text-slate-700 mb-3" />
                          <p className="text-slate-400 text-sm mb-4">No saved meals yet. Build reusable meals once and log them here in one tap.</p>
                          <a href="/meals" className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-6 rounded-xl transition-colors text-sm">
                            Open Meal Builder
                          </a>
                        </div>
                      ) : (
                        <>
                          <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {savedMeals.map(meal => {
                              const totalCals = meal.items?.reduce((s: number, i: any) => s + i.calories, 0) || 0;
                              const totalP = Number((meal.items?.reduce((s: number, i: any) => s + i.protein, 0) || 0).toFixed(1));
                              return (
                                <div key={meal.id} className="bg-slate-950/50 border border-slate-800 rounded-xl p-3 flex items-center justify-between group hover:border-slate-700 transition-colors">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                      <Utensils className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-white truncate">{meal.name}</p>
                                      <p className="text-[10px] text-slate-500 uppercase font-bold truncate">
                                        {meal.items?.length || 0} items • {totalCals} kcal • {totalP}g P
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 ml-3 shrink-0">
                                    <input
                                      type="number"
                                      step="0.5"
                                      min="0.5"
                                      inputMode="decimal"
                                      value={mealServings[meal.id] ?? 1}
                                      onChange={e => setMealServings(prev => ({ ...prev, [meal.id]: parseFloat(e.target.value) || 1 }))}
                                      title={t('nutrition.servings') || 'Servings'}
                                      className="w-14 bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-center text-sm text-white focus:outline-none focus:border-blue-500"
                                    />
                                    <button
                                      onClick={() => logSavedMeal(meal)}
                                      disabled={loggingMealId !== null}
                                      className="bg-slate-800 p-2 rounded-lg text-blue-500 hover:bg-blue-600 hover:text-white disabled:opacity-50 transition-all shrink-0"
                                      title={`Log to ${selectedMeal}`}
                                    >
                                      {loggingMealId === meal.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <a href="/meals" className="block text-center text-xs font-bold text-blue-500 hover:text-blue-400 uppercase tracking-wider py-2">
                            Manage meals →
                          </a>
                        </>
                      )}
                    </div>
                  )}

                  {activeTab === 'barcode' && (
                    <div className="space-y-4">
                      <div className="relative">
                        <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input 
                          type="text" 
                          value={barcodeInput}
                          disabled={isProcessing}
                          onChange={e => setBarcodeInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleBarcodeLookup(barcodeInput)}
                          placeholder="Enter barcode number..."
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                        />
                        <button 
                          onClick={() => handleBarcodeLookup(barcodeInput)}
                          disabled={isProcessing || !barcodeInput}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {isProcessing && <Loader2 className="w-3 h-3 animate-spin" />}
                          {isProcessing ? '...' : 'Lookup'}
                        </button>
                      </div>
                      
                      <div className="flex flex-col items-center justify-center text-center p-6 bg-slate-950/50 border border-dashed border-slate-700 rounded-xl min-h-[140px] relative">
                         {isProcessing ? (
                            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                         ) : isCameraOpen ? (
                            <div className="w-full max-w-sm mx-auto overflow-hidden rounded-xl bg-slate-950">
                               <div id="reader" className="w-full"></div>
                               <button onClick={stopCamera} className="w-full bg-red-500/10 text-red-500 py-3 font-bold text-xs uppercase tracking-widest border-t border-red-500/20">Cancel Scan</button>
                            </div>
                         ) : (
                           <>
                            <p className="text-slate-400 text-xs mb-4">Open food scanner for barcodes</p>
                            <button onClick={startCamera} className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 px-6 rounded-xl transition-colors flex items-center gap-2 text-sm">
                              <Camera className="w-4 h-4" /> Start Scanner
                            </button>
                           </>
                         )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'manual' && (
                    <div className="space-y-4">
                      <div className="flex gap-2 p-1 bg-slate-950 border border-slate-800 rounded-xl mb-2">
                        <button 
                          onClick={() => setManualType('food')}
                          className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-all", manualType === 'food' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-400")}
                        >
                          FOOD (g)
                        </button>
                        <button 
                          onClick={() => setManualType('drink')}
                          className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-all", manualType === 'drink' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-400")}
                        >
                          DRINK (ml)
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                        <div className="sm:col-span-3">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t('nutrition.manual.name')}</label>
                          <input 
                            type="text" 
                            value={manualName}
                            onChange={e => setManualName(e.target.value)}
                            placeholder={manualType === 'food' ? "e.g. Chicken" : "e.g. Orange Juice"}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t('nutrition.manual.calories')}</label>
                          <input 
                            type="number" 
                            inputMode="numeric"
                            value={manualCal}
                            onChange={e => setManualCal(e.target.value)}
                            placeholder="0"
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <label className="text-[10px] lg:text-xs font-bold text-blue-500 uppercase tracking-wider mb-1 block">Prot (g)</label>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={manualP}
                            onChange={e => setManualP(e.target.value)}
                            placeholder="0"
                            className="w-full bg-slate-950 border border-blue-900/50 rounded-xl p-2.5 lg:p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] lg:text-xs font-bold text-orange-500 uppercase tracking-wider mb-1 block">Carb (g)</label>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={manualC}
                            onChange={e => setManualC(e.target.value)}
                            placeholder="0"
                            className="w-full bg-slate-950 border border-orange-900/50 rounded-xl p-2.5 lg:p-3 text-sm text-white focus:outline-none focus:border-orange-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] lg:text-xs font-bold text-emerald-500 uppercase tracking-wider mb-1 block">Fat (g)</label>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={manualF}
                            onChange={e => setManualF(e.target.value)}
                            placeholder="0"
                            className="w-full bg-slate-950 border border-emerald-900/50 rounded-xl p-2.5 lg:p-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] lg:text-xs font-bold text-purple-500 uppercase tracking-wider mb-1 block">Fiber (g)</label>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={manualFiber}
                            onChange={e => setManualFiber(e.target.value)}
                            placeholder="0"
                            className="w-full bg-slate-950 border border-purple-900/50 rounded-xl p-2.5 lg:p-3 text-sm text-white focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => triggerVerification({ name: manualName, calories: manualCal, protein: manualP, carbs: manualC, fat: manualF, fiber: manualFiber, type: manualType })} disabled={!manualName || !manualCal} className="flex-1 bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold py-3 rounded-xl transition-colors text-sm uppercase tracking-wider">
                           Add to Meal
                        </button>
                        <button 
                          onClick={handleManualAdd}
                          disabled={!manualName || !manualCal}
                          className="flex-[1.5] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors text-sm uppercase tracking-wider"
                        >
                          Quick Log
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'ai' && (
                    <div className="flex flex-col items-center justify-center text-center p-6 bg-slate-950/50 border border-dashed border-slate-700 rounded-xl overflow-hidden relative min-h-[200px]">
                      {isProcessing ? (
                        <>
                          <Activity className="w-12 h-12 animate-spin mb-4 text-blue-500" />
                          <p className="font-semibold text-blue-400">{t('nutrition.ai.processing')}</p>
                        </>
                      ) : isCameraOpen ? (
                        <div className="absolute inset-0 z-20 flex flex-col bg-slate-950">
                          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                          <canvas ref={canvasRef} className="hidden" />
                          <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-6 z-30">
                            <button onClick={stopCamera} className="bg-red-500/80 hover:bg-red-500 text-white p-3 rounded-full backdrop-blur-sm transition-colors"><X className="w-6 h-6" /></button>
                            <button onClick={capturePhoto} className="bg-white hover:bg-slate-200 text-slate-900 p-4 rounded-full shadow-lg transition-colors border-4 border-slate-300"><Camera className="w-8 h-8" /></button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <Sparkles className="w-12 h-12 text-blue-500 mb-4" />
                          <p className="text-slate-400 text-sm mb-4 max-w-sm">{t('nutrition.ai.prompt')}</p>
                          
                          <div className="w-full max-w-md mb-6 relative">
                            <input 
                              type="text"
                              value={aiPrompt}
                              onChange={e => setAiPrompt(e.target.value)}
                              placeholder="Add details: e.g. Subway sandwich, 500ml soda..."
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-blue-500"
                            />
                            <SearchIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          </div>

                          <div className="flex gap-4">
                            <button onClick={startCamera} className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center gap-2"><Camera className="w-5 h-5" /> Take Photo</button>
                            <button onClick={() => fileInputRef.current?.click()} className="bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold py-3 px-6 rounded-xl transition-colors flex items-center gap-2"><Plus className="w-5 h-5" /> Upload File</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  
                  <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                </div>
              </div>
            </div>

            {/* Verification Modal */}
            {verificationItem && (
              <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="bg-blue-600 p-6 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3 text-white">
                       <Check className="w-6 h-6" />
                       <h2 className="text-xl font-bold">Review Food Data</h2>
                    </div>
                    <button onClick={() => setVerificationItem(null)} className="text-blue-100 hover:text-white transition-colors">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
                    <div className="flex gap-2 p-1 bg-slate-950 border border-slate-800 rounded-2xl">
                      <button 
                        onClick={() => setVerificationItem(verificationItem ? {...verificationItem, type: 'food'} : null)}
                        className={cn("flex-1 py-2 text-[10px] font-bold rounded-xl transition-all", verificationItem?.type === 'food' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-400")}
                      >
                        FOOD (g)
                      </button>
                      <button 
                        onClick={() => setVerificationItem(verificationItem ? {...verificationItem, type: 'drink'} : null)}
                        className={cn("flex-1 py-2 text-[10px] font-bold rounded-xl transition-all", verificationItem?.type === 'drink' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-400")}
                      >
                        DRINK (ml)
                      </button>
                    </div>

                    <div className="flex items-center gap-4">
                       {verificationItem.image ? (
                          <img src={verificationItem.image} className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-800 shadow-md shrink-0" alt="" />
                       ) : (
                          <div className="w-20 h-20 rounded-2xl bg-blue-500/10 border-2 border-slate-800 flex items-center justify-center shrink-0">
                             <Apple className="w-10 h-10 text-blue-500" />
                          </div>
                       )}
                       <div className="flex-1 min-w-0">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Food Name</label>
                          <input 
                            type="text" 
                            value={verificationItem.name}
                            onChange={e => setVerificationItem({...verificationItem, name: e.target.value})}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-bold focus:border-blue-500 focus:outline-none"
                          />
                       </div>
                    </div>

                    <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 space-y-4">
                       <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Values per 100{verificationItem.type === 'drink' ? 'ml' : 'g'}</p>
                       </div>
                       
                       <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Calories (kcal)</label>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={verificationItem.calories || ''}
                              placeholder="0"
                              onChange={e => setVerificationItem({...verificationItem, calories: parseInt(e.target.value) || 0})}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:border-blue-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-blue-500 uppercase mb-1 block">Protein (g)</label>
                            <input
                              type="number"
                              step="0.1"
                              inputMode="decimal"
                              value={verificationItem.protein || ''}
                              placeholder="0"
                              onChange={e => setVerificationItem({...verificationItem, protein: parseFloat(e.target.value) || 0})}
                              className="w-full bg-slate-900 border border-blue-900/30 rounded-xl p-3 text-white focus:border-blue-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-orange-500 uppercase mb-1 block">Carbs (g)</label>
                            <input
                              type="number"
                              step="0.1"
                              inputMode="decimal"
                              value={verificationItem.carbs || ''}
                              placeholder="0"
                              onChange={e => setVerificationItem({...verificationItem, carbs: parseFloat(e.target.value) || 0})}
                              className="w-full bg-slate-900 border border-orange-900/30 rounded-xl p-3 text-white focus:border-orange-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-emerald-500 uppercase mb-1 block">Fat (g)</label>
                            <input
                              type="number"
                              step="0.1"
                              inputMode="decimal"
                              value={verificationItem.fat || ''}
                              placeholder="0"
                              onChange={e => setVerificationItem({...verificationItem, fat: parseFloat(e.target.value) || 0})}
                              className="w-full bg-slate-900 border border-emerald-900/30 rounded-xl p-3 text-white focus:border-emerald-500 focus:outline-none"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] font-bold text-purple-500 uppercase mb-1 block">Fiber (g)</label>
                            <input
                              type="number"
                              step="0.1"
                              inputMode="decimal"
                              value={verificationItem.fiber || ''}
                              placeholder="0"
                              onChange={e => setVerificationItem({...verificationItem, fiber: parseFloat(e.target.value) || 0})}
                              className="w-full bg-slate-900 border border-purple-900/30 rounded-xl p-3 text-white focus:border-purple-500 focus:outline-none"
                            />
                          </div>
                       </div>
                    </div>

                    <div className="bg-blue-600/5 border border-blue-600/20 rounded-2xl p-5">
                       <label className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2 block text-center">How much did you {verificationItem.type === 'drink' ? 'drink' : 'eat'}?</label>
                       <div className="flex items-center justify-center gap-4">
                          <input 
                            type="number" 
                            inputMode="decimal"
                            value={portionGrams}
                            onChange={e => setPortionGrams(e.target.value)}
                            className="w-32 bg-slate-950 border border-blue-500/50 rounded-2xl p-4 text-2xl font-bold text-white text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                          <span className="text-2xl font-bold text-slate-500 uppercase text-sm">{verificationItem.type === 'drink' ? 'ml' : 'grams'}</span>
                       </div>
                       <div className="mt-4 flex justify-between px-2 text-xs font-bold uppercase">
                          <span className="text-slate-500">Resulting:</span>
                          <span className="text-white">{Math.round(verificationItem.calories * (parseFloat(portionGrams) || 0) / 100)} kcal</span>
                       </div>
                    </div>
                  </div>

                  <div className="p-6 bg-slate-950/50 border-t border-slate-800 flex gap-3 shrink-0">
                    <button 
                      onClick={() => finalizeLogging('meal')}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold py-4 rounded-2xl transition-all uppercase tracking-widest text-[10px] lg:text-xs"
                    >
                      Add to Meal
                    </button>
                    <button 
                      onClick={() => finalizeLogging('quick')}
                      className="flex-[1.5] bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-blue-600/20 uppercase tracking-widest text-[10px] lg:text-xs"
                    >
                      Quick Log
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Modal */}
            {editingLog && (
              <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="bg-blue-600 p-6 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3 text-white">
                       <Pencil className="w-6 h-6" />
                       <h2 className="text-xl font-bold">{t('nutrition.editTitle') || 'Edit Food & Drink'}</h2>
                    </div>
                    <button onClick={() => setEditingLog(null)} className="text-blue-100 hover:text-white transition-colors">
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
                    <div className="flex gap-2 p-1 bg-slate-950 border border-slate-800 rounded-2xl">
                      <button
                        onClick={() => setEditingLog({ ...editingLog, type: 'food' })}
                        className={cn("flex-1 py-2 text-[10px] font-bold rounded-xl transition-all", editingLog.type === 'food' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-400")}
                      >
                        FOOD
                      </button>
                      <button
                        onClick={() => setEditingLog({ ...editingLog, type: 'drink' })}
                        className={cn("flex-1 py-2 text-[10px] font-bold rounded-xl transition-all", editingLog.type === 'drink' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-400")}
                      >
                        DRINK
                      </button>
                    </div>

                    <div className="flex items-center gap-4">
                       <div className={cn("w-16 h-16 rounded-2xl border-2 border-slate-800 flex items-center justify-center shrink-0", editingLog.type === 'food' ? "bg-orange-500/10 text-orange-500" : "bg-blue-500/10 text-blue-500")}>
                          {editingLog.type === 'food' ? <Apple className="w-8 h-8" /> : <CupSoda className="w-8 h-8" />}
                       </div>
                       <div className="flex-1 min-w-0">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t('nutrition.manual.name') || 'Item Name'}</label>
                          <input
                            type="text"
                            value={editingLog.name}
                            onChange={e => setEditingLog({...editingLog, name: e.target.value})}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-bold focus:border-blue-500 focus:outline-none"
                          />
                       </div>
                    </div>

                    <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 space-y-4">
                       <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">{t('nutrition.manual.calories') || 'Calories (kcal)'}</label>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={editingLog.calories || ''}
                              onChange={e => setEditingLog({...editingLog, calories: parseInt(e.target.value) || 0})}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:border-blue-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-blue-500 uppercase mb-1 block">Protein (g)</label>
                            <input
                              type="number"
                              step="0.1"
                              inputMode="decimal"
                              value={editingLog.protein || ''}
                              onChange={e => setEditingLog({...editingLog, protein: parseFloat(e.target.value) || 0})}
                              className="w-full bg-slate-900 border border-blue-900/30 rounded-xl p-3 text-white focus:border-blue-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-orange-500 uppercase mb-1 block">Carbs (g)</label>
                            <input
                              type="number"
                              step="0.1"
                              inputMode="decimal"
                              value={editingLog.carbs || ''}
                              onChange={e => setEditingLog({...editingLog, carbs: parseFloat(e.target.value) || 0})}
                              className="w-full bg-slate-900 border border-orange-900/30 rounded-xl p-3 text-white focus:border-orange-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-emerald-500 uppercase mb-1 block">Fat (g)</label>
                            <input
                              type="number"
                              step="0.1"
                              inputMode="decimal"
                              value={editingLog.fat || ''}
                              onChange={e => setEditingLog({...editingLog, fat: parseFloat(e.target.value) || 0})}
                              className="w-full bg-slate-900 border border-emerald-900/30 rounded-xl p-3 text-white focus:border-emerald-500 focus:outline-none"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] font-bold text-purple-500 uppercase mb-1 block">Fiber (g)</label>
                            <input
                              type="number"
                              step="0.1"
                              inputMode="decimal"
                              value={editingLog.fiber || ''}
                              onChange={e => setEditingLog({...editingLog, fiber: parseFloat(e.target.value) || 0})}
                              className="w-full bg-slate-900 border border-purple-900/30 rounded-xl p-3 text-white focus:border-purple-500 focus:outline-none"
                            />
                          </div>
                       </div>
                    </div>

                    <div className="bg-blue-600/5 border border-blue-600/20 rounded-2xl p-5">
                       <label className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2 block text-center">Portion</label>
                       <div className="flex items-center justify-center gap-4">
                          <input 
                            type="number" 
                            inputMode="decimal"
                            value={editingLog.portionGrams || ''}
                            onChange={e => {
                              const newPortion = parseFloat(e.target.value) || 0;
                              const oldPortion = originalLog?.portionGrams || 0;
                              if (oldPortion > 0) {
                                const ratio = newPortion / oldPortion;
                                setEditingLog({
                                  ...editingLog,
                                  portionGrams: newPortion,
                                  calories: Math.round((originalLog?.calories || 0) * ratio),
                                  protein: Math.round(((originalLog?.protein || 0) * ratio) * 10) / 10,
                                  carbs: Math.round(((originalLog?.carbs || 0) * ratio) * 10) / 10,
                                  fat: Math.round(((originalLog?.fat || 0) * ratio) * 10) / 10,
                                  fiber: Math.round(((originalLog?.fiber || 0) * ratio) * 10) / 10
                                });
                              } else {
                                setEditingLog({
                                  ...editingLog,
                                  portionGrams: newPortion
                                });
                              }
                            }}
                            className="w-32 bg-slate-950 border border-blue-500/50 rounded-2xl p-4 text-2xl font-bold text-white text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                          <span className="text-xl font-bold text-slate-500 uppercase">{editingLog.type === 'drink' ? 'ml' : 'g'}</span>
                       </div>
                    </div>
                  </div>

                  <div className="p-6 bg-slate-950/50 border-t border-slate-800 flex shrink-0">
                    <button 
                      onClick={() => updateLog(editingLog)}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-blue-600/20 uppercase tracking-widest text-sm"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Meal Builder Floating Panel */}
            {stagedItems.length > 0 && (
              <div className="fixed bottom-24 lg:bottom-8 left-4 right-4 sm:left-auto sm:right-8 sm:w-80 bg-slate-900 border border-blue-500/30 rounded-2xl shadow-2xl z-[40] overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
                 <div className="bg-blue-600 px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-white">
                       <Utensils className="w-4 h-4" />
                       <span className="font-bold text-sm">Meal Builder</span>
                       <span className="bg-white/20 text-[10px] px-2 py-0.5 rounded-full">{stagedItems.length}</span>
                    </div>
                    <button onClick={() => confirm(t('nutrition.confirmDeleteMeal') || 'Delete this meal?', () => setStagedItems([]))} className="text-blue-100 hover:text-white"><Trash2 className="w-4 h-4" /></button>
                 </div>
                 <div className="p-3 space-y-2 max-h-48 overflow-y-auto custom-scrollbar bg-slate-950/30">
                    {stagedItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center group bg-slate-900/50 p-2 rounded-lg border border-slate-800/50">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{item.name}</p>
                          <p className="text-[10px] text-slate-500 uppercase font-bold">{item.calories} kcal • {item.protein}g P • {item.carbs}g C • {item.fat}g F{item.fiber > 0 ? ` • ${item.fiber}g Fi` : ''}</p>
                        </div>
                        <button onClick={() => setStagedItems(stagedItems.filter((_, i) => i !== idx))} className="text-slate-600 hover:text-red-500 transition-colors ml-2"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                 </div>
                 <div className="p-4 border-t border-slate-800 bg-slate-900">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider px-1">
                       <span>Total: {stagedItems.reduce((s, i) => s + i.calories, 0)} kcal</span>
                       <div className="flex gap-2.5">
                          <span className="text-blue-500">{stagedItems.reduce((s, i) => s + i.protein, 0)}g P</span>
                          <span className="text-orange-500">{stagedItems.reduce((s, i) => s + i.carbs, 0)}g C</span>
                          <span className="text-red-500">{stagedItems.reduce((s, i) => s + i.fat, 0)}g F</span>
                          <span className="text-purple-400">{stagedItems.reduce((s, i) => s + i.fiber, 0)}g Fi</span>
                       </div>
                    </div>
                    <button onClick={logMeal} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-600/20 uppercase tracking-widest text-xs">
                       Log to {selectedMeal}
                    </button>
                 </div>
              </div>
            )}

            {/* Today's Log Items */}
            <div className="space-y-6">
              {['breakfast', 'lunch', 'dinner', 'snack'].map(meal => {
                const mealLogs = logs.filter(l => l.meal === meal);
                const mealCals = mealLogs.reduce((sum, item) => sum + item.calories, 0);
                return (
                  <div key={meal} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                      <h3 className="font-semibold text-white capitalize">{t(`nutrition.meal.${meal}`)}</h3>
                      <span className="text-sm text-slate-400 font-medium">{mealCals} kcal</span>
                    </div>
                    <div className="p-2">
                      {mealLogs.length === 0 ? (
                        <p className="text-center text-slate-600 py-6 text-sm">{t('nutrition.empty')}</p>
                      ) : (
                        <div className="divide-y divide-slate-800/50">
                          {mealLogs.map(log => (
                            <div key={log.id} className="p-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors rounded-xl">
                              <div className="flex items-center gap-4 min-w-0">
                                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", log.type === 'food' ? "bg-orange-500/10 text-orange-500" : "bg-blue-500/10 text-blue-500")}>
                                  {log.type === 'food' ? <Apple className="w-4 h-4" /> : <CupSoda className="w-4 h-4" />}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm text-white leading-tight truncate">{log.name}</p>
                                  <div className="flex items-center gap-3 mt-1 text-[10px] uppercase font-bold tracking-wider">
                                    <span className="text-blue-500">{log.protein}g P</span>
                                    <span className="text-orange-500">{log.carbs}g C</span>
                                    <span className="text-red-500">{log.fat}g F</span>
                                    {log.fiber > 0 && <span className="text-purple-400">{log.fiber}g Fi</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center justify-end gap-1 pl-4 shrink-0">
                                <div className="text-right mr-2">
                                  <p className="font-bold text-sm text-white whitespace-nowrap">{log.calories} <span className="text-xs text-slate-500 font-normal">kcal</span></p>
                                </div>
                                <button onClick={() => { setEditingLog(log); setOriginalLog(log); }} className="text-slate-500 hover:text-blue-500 transition-colors p-1.5 rounded-lg hover:bg-slate-800"><Pencil className="w-4 h-4" /></button>
                                <button onClick={() => deleteLog(log.id)} className="text-slate-500 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : viewMode === 'week' ? (
          /* Weekly Trend View */
          (() => {
            const week = getWeekData();
            const maxCal = Math.max(goal, ...week.map(d => d.calories), 1);
            const daysWithData = week.filter(d => d.calories > 0).length || 1;
            const avg = {
              calories: Math.round(week.reduce((s, d) => s + d.calories, 0) / daysWithData),
              protein: Math.round(week.reduce((s, d) => s + d.protein, 0) / daysWithData),
              carbs: Math.round(week.reduce((s, d) => s + d.carbs, 0) / daysWithData),
              fat: Math.round(week.reduce((s, d) => s + d.fat, 0) / daysWithData),
            };
            return (
              <div className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
                  <h3 className="font-semibold text-lg text-white mb-6">{t('nutrition.week.title') || 'Last 7 Days'}</h3>
                  <div className="flex items-end justify-between gap-2 h-48">
                    {week.map((d, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                        <span className="text-[10px] font-bold text-slate-400">{d.calories > 0 ? d.calories : ''}</span>
                        <div
                          className={cn("w-full rounded-t-lg transition-all", d.calories > goal ? "bg-red-500/70" : "bg-blue-500/70")}
                          style={{ height: `${Math.max(2, (d.calories / maxCal) * 100)}%` }}
                          title={`${d.calories} kcal`}
                        />
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{d.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-2 text-[10px] text-slate-500">
                    <span className="w-3 h-0.5 bg-slate-600" /> {t('nutrition.week.goalLine') || 'Goal'}: {goal} kcal/day
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
                  <h3 className="font-semibold text-lg text-white mb-1">{t('nutrition.week.avgTitle') || 'Daily Average'}</h3>
                  <p className="text-xs text-slate-500 mb-5">{t('nutrition.week.avgSub') || 'Averaged over days with logged food'}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: t('profile.calories') || 'Calories', val: avg.calories, unit: 'kcal', goalV: goal, color: 'text-white' },
                      { label: t('profile.protein') || 'Protein', val: avg.protein, unit: 'g', goalV: user?.goal_protein, color: 'text-blue-400' },
                      { label: t('profile.carbs') || 'Carbs', val: avg.carbs, unit: 'g', goalV: user?.goal_carbs, color: 'text-orange-400' },
                      { label: t('profile.fat') || 'Fat', val: avg.fat, unit: 'g', goalV: user?.goal_fat, color: 'text-emerald-400' },
                    ].map((m, i) => (
                      <div key={i} className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{m.label}</p>
                        <p className={cn("text-xl font-bold", m.color)}>{m.val}<span className="text-[10px] text-slate-500 font-normal"> {m.unit}</span></p>
                        {m.goalV ? <p className="text-[10px] text-slate-600 mt-1">/ {m.goalV} {m.unit}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
          /* Monthly Calendar View */
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 lg:p-8 shadow-sm overflow-x-auto no-scrollbar">
            <div className="flex items-center justify-between mb-8 min-w-[320px]">
              <div className="flex items-center gap-3">
                <Calendar className="w-6 h-6 text-blue-500" />
                <h2 className="text-xl font-bold text-white">{format(currentMonth, 'MMMM yyyy')}</h2>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-slate-800 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5 text-slate-400" /></button>
                <button onClick={() => setCurrentMonth(new Date())} className="px-3 py-1 text-xs font-bold text-slate-400 hover:text-white uppercase tracking-wider">Today</button>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-slate-800 rounded-lg transition-colors"><ChevronRight className="w-5 h-5 text-slate-400" /></button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 lg:gap-2 min-w-[320px]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{d}</div>
              ))}
              
              {/* Padding for start of month */}
              {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
                <div key={`pad-${i}`} className="h-16 lg:h-24" />
              ))}

              {monthDays.map(day => {
                const dayCals = getDayCalories(day);
                const dayBurned = getDayBurnedCalories(day);
                const netCals = Math.max(0, dayCals - dayBurned);
                const isUnder = dayCals > 0 && netCals <= goal;
                const hasData = dayCals > 0;

                return (
                  <div 
                    key={day.toString()} 
                    className={cn(
                      "h-16 lg:h-24 rounded-lg lg:rounded-xl border p-1 lg:p-2 flex flex-col justify-between transition-all",
                      isToday(day) ? "border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/20" : "border-slate-800 bg-slate-950/50",
                      hasData && "hover:border-slate-600"
                    )}
                  >
                    <span className={cn("text-[10px] lg:text-xs font-bold", isToday(day) ? "text-blue-400" : "text-slate-500")}>
                      {format(day, 'd')}
                    </span>
                    
                    {hasData ? (
                      <div className="space-y-0.5 lg:space-y-1">
                        <div className={cn(
                          "px-1 py-0.5 rounded text-[8px] lg:text-[10px] font-bold text-center leading-none",
                          isUnder ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                        )}>
                          {netCals}
                        </div>
                        {dayBurned > 0 && (
                          <div className="text-[7px] lg:text-[8px] text-orange-400 font-bold text-center leading-none">
                            🔥 -{dayBurned}
                          </div>
                        )}
                        <div className="flex justify-center">
                           <div className={cn("w-1 h-1 lg:w-1.5 lg:h-1.5 rounded-full", isUnder ? "bg-emerald-500" : "bg-red-500")} />
                        </div>
                      </div>
                    ) : (
                      <div className="h-2 lg:h-4" />
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="mt-8 flex items-center justify-center gap-8 text-xs font-medium text-slate-500 min-w-[320px]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span>Goal Met</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>Exceeded</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-800" />
                <span>No Data</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
