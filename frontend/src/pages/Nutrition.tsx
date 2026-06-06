import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Camera, ScanBarcode, Plus, Apple, CupSoda, Target, 
  Sparkles, Activity, X, Trash2, Calendar, ChevronLeft, ChevronRight, Search as SearchIcon, Loader2, Utensils
} from 'lucide-react';
import Layout from '../components/Layout';
import { cn } from '../lib/utils';
import { useUI } from '../contexts/UIContext';
import { useUser } from '../contexts/UserContext';
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, 
  isSameDay, isToday, subMonths, addMonths 
} from 'date-fns';
import { Html5QrcodeScanner } from "html5-qrcode";

interface LogItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  type: 'food' | 'drink';
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  timestamp: Date;
}

interface StagedItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  brand?: string;
  image?: string;
}

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
  const [activeTab, setActiveTab] = useState<'manual' | 'ai' | 'barcode' | 'search'>('search');
  const [selectedMeal, setSelectedMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('breakfast');
  const [viewMode, setViewMode] = useState<'today' | 'month'>('today');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Meal Builder State
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);

  useEffect(() => {
    if (user?.goal_calories) {
      setGoal(user.goal_calories);
    }
  }, [user]);

  // Fetch today's logs
  const fetchTodayLogs = () => {
    fetch('/api/nutrition?user_id=1')
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
            type: item.type as 'food' | 'drink',
            meal: item.meal as 'breakfast' | 'lunch' | 'dinner' | 'snack',
            timestamp: new Date(item.timestamp)
          }));
          setLogs(formattedData);
        }
      })
      .catch(err => console.error("Failed to fetch today's nutrition logs:", err));
  };

  // Fetch month's logs
  const fetchMonthLogs = () => {
    fetch('/api/nutrition?user_id=1&days=31')
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
            type: item.type as 'food' | 'drink',
            meal: item.meal as 'breakfast' | 'lunch' | 'dinner' | 'snack',
            timestamp: new Date(item.timestamp)
          }));
          setHistoryLogs(formattedData);
        }
      })
      .catch(err => console.error("Failed to fetch history nutrition logs:", err));
  };

  useEffect(() => {
    fetchTodayLogs();
    fetchMonthLogs();
  }, []);
  
  // Manual Entry State
  const [manualName, setManualName] = useState('');
  const [manualCal, setManualCal] = useState('');
  const [manualP, setManualP] = useState('');
  const [manualC, setManualC] = useState('');
  const [manualF, setManualF] = useState('');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Barcode State
  const [barcodeInput, setBarcodeInput] = useState('');

  // AI & Camera State
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [aiResult, setAiResult] = useState<StagedItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const consumed = logs.reduce((sum, item) => sum + item.calories, 0);
  const consumedP = logs.reduce((sum, item) => sum + item.protein, 0);
  const consumedC = logs.reduce((sum, item) => sum + item.carbs, 0);
  const consumedF = logs.reduce((sum, item) => sum + item.fat, 0);

  const remaining = goal - consumed;
  const progressPercent = Math.min(100, Math.max(0, (consumed / goal) * 100));

  // --- Barcode Scanner Logic ---
  useEffect(() => {
    if (activeTab === 'barcode' && isCameraOpen) {
      const scanner = new Html5QrcodeScanner(
        "reader", 
        { fps: 10, qrbox: { width: 250, height: 150 } }, 
        /* verbose= */ false
      );

      scanner.render((decodedText) => {
        handleBarcodeLookup(decodedText);
        scanner.clear();
        setIsCameraOpen(false);
      }, (_error) => {
        // scan error, usually safe to ignore
      });

      return () => {
        scanner.clear().catch(e => console.warn("Scanner clear error", e));
      };
    }
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

  const addLog = async (name: string, calories: number, protein: number, carbs: number, fat: number, type: 'food' | 'drink' = 'food') => {
    try {
      const res = await fetch('/api/nutrition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 1,
          name,
          calories,
          protein,
          carbs,
          fat,
          type,
          meal: selectedMeal
        })
      });

      if (!res.ok) throw new Error('Failed to save log to database');
      
      const savedItem = await res.json();
      
      const newItem: LogItem = {
        id: savedItem.id.toString(),
        name: savedItem.name,
        calories: savedItem.calories,
        protein: savedItem.protein || 0,
        carbs: savedItem.carbs || 0,
        fat: savedItem.fat || 0,
        type: savedItem.type as 'food' | 'drink',
        meal: savedItem.meal as 'breakfast' | 'lunch' | 'dinner' | 'snack',
        timestamp: new Date(savedItem.timestamp)
      };
      
      setLogs([newItem, ...logs]);
      setHistoryLogs([newItem, ...historyLogs]);
      toast(`${name} added!`, 'success');
    } catch (err) {
      console.error(err);
      toast('Failed to save nutrition log.', 'error');
    }
  };

  const logMeal = async () => {
    if (stagedItems.length === 0) return;
    
    confirm(`Log all ${stagedItems.length} items to ${selectedMeal}?`, async () => {
      for (const item of stagedItems) {
        await addLog(item.name, item.calories, item.protein, item.carbs, item.fat, 'food');
      }
      setStagedItems([]);
      toast('Meal logged successfully!', 'success');
    });
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

  const handleManualAdd = () => {
    if (!manualName || !manualCal) return;
    addLog(manualName, parseInt(manualCal, 10), parseFloat(manualP) || 0, parseFloat(manualC) || 0, parseFloat(manualF) || 0, 'food');
    setManualName('');
    setManualCal('');
    setManualP('');
    setManualC('');
    setManualF('');
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/nutrition/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data || []);
    } catch (err) {
      console.error(err);
      toast('Search failed', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleBarcodeLookup = async (code: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/nutrition/barcode?barcode=${code}`);
      if (!res.ok) throw new Error('Product not found');
      const data = await res.json();
      
      const item: StagedItem = {
        name: data.name || 'Unknown',
        calories: Math.round(data.calories || 0),
        protein: data.protein || 0,
        carbs: data.carbs || 0,
        fat: data.fat || 0,
        brand: data.brand,
        image: data.image
      };
      
      setAiResult(item);
      toast(`Found ${item.name}!`, 'success');
    } catch (err) {
      console.error(err);
      toast('Barcode not recognized', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const addToStage = (item: StagedItem) => {
    setStagedItems([...stagedItems, item]);
    toast(`Added ${item.name} to meal`, 'info');
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
    setIsProcessing(true);
    const formData = new FormData();
    formData.append('image', file, 'capture.jpg');

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
      
      setAiResult({ 
        name: data.name || 'Unknown Item', 
        calories: data.calories || 0, 
        protein: data.protein || 0, 
        carbs: data.carbs || 0, 
        fat: data.fat || 0 
      });
      toast('Analysis complete!', 'success');
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
              TODAY
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", viewMode === 'month' ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300")}
            >
              MONTHLY
            </button>
          </div>
        </div>

        {viewMode === 'today' ? (
          <>
            {/* Dashboard Top */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Circular Progress */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center relative">
                <div className="relative w-32 h-32 lg:w-40 lg:h-40 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" className="text-slate-800 stroke-current" strokeWidth="8" fill="transparent" />
                    <circle cx="50" cy="50" r="40" className={cn("stroke-current transition-all duration-1000", remaining < 0 ? "text-red-500" : "text-emerald-500")} strokeWidth="8" fill="transparent" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * progressPercent) / 100} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl lg:text-3xl font-bold text-white">{consumed}</span>
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

                {/* Macros Section */}
                <div className="mt-8 w-full grid grid-cols-3 lg:grid-cols-1 gap-4 lg:space-y-4 px-1 lg:px-2">
                  <div className="text-center lg:text-left">
                    <div className="flex flex-col lg:flex-row lg:justify-between text-[10px] font-bold uppercase mb-1 gap-0.5 lg:gap-0">
                      <span className="text-blue-500">Prot</span>
                      <span className="text-slate-400">{consumedP}g</span>
                    </div>
                    <div className="h-1.5 lg:h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${Math.min(100, (consumedP / proteinGoal) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="text-center lg:text-left">
                    <div className="flex flex-col lg:flex-row lg:justify-between text-[10px] font-bold uppercase mb-1 gap-0.5 lg:gap-0">
                      <span className="text-orange-500">Carbs</span>
                      <span className="text-slate-400">{consumedC}g</span>
                    </div>
                    <div className="h-1.5 lg:h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${Math.min(100, (consumedC / carbsGoal) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="text-center lg:text-left">
                    <div className="flex flex-col lg:flex-row lg:justify-between text-[10px] font-bold uppercase mb-1 gap-0.5 lg:gap-0">
                      <span className="text-emerald-500">Fat</span>
                      <span className="text-slate-400">{consumedF}g</span>
                    </div>
                    <div className="h-1.5 lg:h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min(100, (consumedF / fatGoal) * 100)}%` }} />
                    </div>
                  </div>
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
                    onClick={() => setActiveTab('barcode')}
                    className={cn("flex-1 flex items-center justify-center gap-1.5 lg:gap-2 py-2 px-3 rounded-lg text-xs lg:text-sm font-semibold transition-all whitespace-nowrap", activeTab === 'barcode' ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300")}
                  >
                    <ScanBarcode className="w-3.5 h-3.5" /> Barcode
                  </button>
                  <button
                    onClick={() => setActiveTab('ai')}
                    className={cn("flex-1 flex items-center justify-center gap-1.5 lg:gap-2 py-2 px-3 rounded-lg text-xs lg:text-sm font-semibold transition-all whitespace-nowrap", activeTab === 'ai' ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300")}
                  >
                    <Camera className="w-3.5 h-3.5" /> AI Cam
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
                          onChange={e => setSearchQuery(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSearch()}
                          placeholder="Search food (e.g. Cooked Potatoes)"
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                        <button 
                          onClick={handleSearch}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-bold"
                        >
                          Find
                        </button>
                      </div>

                      <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {isSearching ? (
                          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
                        ) : searchResults.length === 0 ? (
                          <p className="text-center text-slate-500 py-8 text-sm italic">Lookup foods based on name...</p>
                        ) : (
                          searchResults.map((item, idx) => (
                            <div key={idx} className="bg-slate-950/50 border border-slate-800 rounded-xl p-3 flex items-center justify-between group hover:border-slate-700 transition-colors">
                              <div className="flex items-center gap-3">
                                {item.image ? <img src={item.image} className="w-10 h-10 rounded-lg object-cover" alt="" /> : <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center"><Apple className="w-5 h-5 text-slate-600" /></div>}
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-white truncate">{item.name}</p>
                                  <p className="text-[10px] text-slate-500 uppercase font-bold">{Math.round(item.calories)} kcal / 100g • {item.brand || 'No Brand'}</p>
                                </div>
                              </div>
                              <button onClick={() => addToStage({ name: item.name, calories: item.calories, protein: item.protein, carbs: item.carbs, fat: item.fat, brand: item.brand, image: item.image })} className="bg-slate-800 p-2 rounded-lg text-blue-500 hover:bg-blue-600 hover:text-white transition-all">
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'barcode' && (
                    <div className="space-y-4">
                      <div className="relative">
                        <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input 
                          type="text" 
                          value={barcodeInput}
                          onChange={e => setBarcodeInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleBarcodeLookup(barcodeInput)}
                          placeholder="Enter barcode number..."
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                        <button 
                          onClick={() => handleBarcodeLookup(barcodeInput)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-bold"
                        >
                          Lookup
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
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                        <div className="sm:col-span-3">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t('nutrition.manual.name')}</label>
                          <input 
                            type="text" 
                            value={manualName}
                            onChange={e => setManualName(e.target.value)}
                            placeholder="e.g. Chicken"
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t('nutrition.manual.calories')}</label>
                          <input 
                            type="number" 
                            value={manualCal}
                            onChange={e => setManualCal(e.target.value)}
                            placeholder="0"
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-[10px] lg:text-xs font-bold text-blue-500 uppercase tracking-wider mb-1 block">Prot (g)</label>
                          <input 
                            type="number" 
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
                            value={manualF}
                            onChange={e => setManualF(e.target.value)}
                            placeholder="0"
                            className="w-full bg-slate-950 border border-emerald-900/50 rounded-xl p-2.5 lg:p-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => addToStage({ name: manualName, calories: parseInt(manualCal, 10) || 0, protein: parseFloat(manualP) || 0, carbs: parseFloat(manualC) || 0, fat: parseFloat(manualF) || 0 })} disabled={!manualName || !manualCal} className="flex-1 bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold py-3 rounded-xl transition-colors text-sm uppercase tracking-wider">
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
                          <p className="text-slate-400 text-sm mb-6 max-w-sm">{t('nutrition.ai.prompt')}</p>
                          <div className="flex gap-4">
                            <button onClick={startCamera} className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center gap-2"><Camera className="w-5 h-5" /> Take Photo</button>
                            <button onClick={() => fileInputRef.current?.click()} className="bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold py-3 px-6 rounded-xl transition-colors flex items-center gap-2"><Plus className="w-5 h-5" /> Upload File</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  
                  {/* Result Result Overlay */}
                  {aiResult && (
                    <div className="mt-4 p-4 bg-blue-600/10 border border-blue-500/20 rounded-xl animate-in fade-in zoom-in-95 duration-300">
                      <div className="flex items-center gap-4 mb-3">
                        {aiResult.image ? <img src={aiResult.image} className="w-12 h-12 rounded-lg object-cover" alt="" /> : <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-500"><Apple className="w-6 h-6" /></div>}
                        <div className="min-w-0">
                          <p className="font-bold text-white text-lg leading-tight truncate">{aiResult.name}</p>
                          {aiResult.brand && <p className="text-xs text-blue-400 font-bold uppercase truncate">{aiResult.brand}</p>}
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        <div className="bg-slate-900/50 p-2 rounded-lg text-center">
                          <p className="text-[10px] text-slate-500 uppercase font-bold">Kcal</p>
                          <p className="text-sm font-bold text-white">{Math.round(aiResult.calories)}</p>
                        </div>
                        <div className="bg-slate-900/50 p-2 rounded-lg text-center">
                          <p className="text-[10px] text-blue-500 uppercase font-bold">Prot</p>
                          <p className="text-sm font-bold text-white">{aiResult.protein}g</p>
                        </div>
                        <div className="bg-slate-900/50 p-2 rounded-lg text-center">
                          <p className="text-[10px] text-orange-500 uppercase font-bold">Carb</p>
                          <p className="text-sm font-bold text-white">{aiResult.carbs}g</p>
                        </div>
                        <div className="bg-slate-900/50 p-2 rounded-lg text-center">
                          <p className="text-[10px] text-emerald-500 uppercase font-bold">Fat</p>
                          <p className="text-sm font-bold text-white">{aiResult.fat}g</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setAiResult(null)} className="flex-1 py-2 text-slate-400 font-bold text-xs uppercase hover:text-white transition-colors">Cancel</button>
                        <button onClick={() => { addToStage(aiResult); setAiResult(null); }} className="flex-1 bg-slate-800 text-blue-400 py-2 rounded-lg font-bold text-xs uppercase hover:bg-slate-700 transition-colors">Add to Meal</button>
                        <button onClick={() => { addLog(aiResult.name, aiResult.calories, aiResult.protein, aiResult.carbs, aiResult.fat); setAiResult(null); }} className="flex-[1.5] bg-blue-600 text-white py-2 rounded-lg font-bold text-xs uppercase shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition-colors">Quick Log</button>
                      </div>
                    </div>
                  )}

                  <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                </div>
              </div>
            </div>

            {/* Meal Builder Floating Panel */}
            {stagedItems.length > 0 && (
              <div className="fixed bottom-24 lg:bottom-8 left-4 right-4 sm:left-auto sm:right-8 sm:w-80 bg-slate-900 border border-blue-500/30 rounded-2xl shadow-2xl z-[40] overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
                 <div className="bg-blue-600 px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-white">
                       <Utensils className="w-4 h-4" />
                       <span className="font-bold text-sm">Meal Builder</span>
                       <span className="bg-white/20 text-[10px] px-2 py-0.5 rounded-full">{stagedItems.length}</span>
                    </div>
                    <button onClick={() => setStagedItems([])} className="text-blue-100 hover:text-white"><Trash2 className="w-4 h-4" /></button>
                 </div>
                 <div className="p-3 space-y-2 max-h-48 overflow-y-auto custom-scrollbar bg-slate-950/30">
                    {stagedItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center group bg-slate-900/50 p-2 rounded-lg border border-slate-800/50">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{item.name}</p>
                          <p className="text-[10px] text-slate-500 uppercase font-bold">{item.calories} kcal • {item.protein}g P</p>
                        </div>
                        <button onClick={() => setStagedItems(stagedItems.filter((_, i) => i !== idx))} className="text-slate-600 hover:text-red-500 transition-colors ml-2"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                 </div>
                 <div className="p-4 border-t border-slate-800 bg-slate-900">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider px-1">
                       <span>Total: {stagedItems.reduce((s, i) => s + i.calories, 0)} kcal</span>
                       <span className="text-blue-500">{stagedItems.reduce((s, i) => s + i.protein, 0)}g P</span>
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
                              <div className="flex items-center gap-4">
                                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", log.type === 'food' ? "bg-orange-500/10 text-orange-500" : "bg-blue-500/10 text-blue-500")}>
                                  {log.type === 'food' ? <Apple className="w-4 h-4" /> : <CupSoda className="w-4 h-4" />}
                                </div>
                                <div>
                                  <p className="font-medium text-sm text-white leading-tight">{log.name}</p>
                                  <div className="flex items-center gap-2 mt-1 text-[10px] uppercase font-bold tracking-wider">
                                    <span className="text-blue-500">{log.protein}g P</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center justify-end gap-3 pl-4">
                                <div className="text-right">
                                  <p className="font-bold text-sm text-white whitespace-nowrap">{log.calories} <span className="text-xs text-slate-500 font-normal">kcal</span></p>
                                </div>
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
        ) : (
          /* Monthly Calendar View */
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
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

            <div className="grid grid-cols-7 gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{d}</div>
              ))}
              
              {/* Padding for start of month */}
              {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
                <div key={`pad-${i}`} className="h-16 lg:h-24" />
              ))}

              {monthDays.map(day => {
                const dayCals = getDayCalories(day);
                const isUnder = dayCals > 0 && dayCals <= goal;
                const hasData = dayCals > 0;

                return (
                  <div 
                    key={day.toString()} 
                    className={cn(
                      "h-16 lg:h-24 rounded-xl border p-1 lg:p-2 flex flex-col justify-between transition-all",
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
                          {dayCals}
                        </div>
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
            
            <div className="mt-8 flex items-center justify-center gap-8 text-xs font-medium text-slate-500">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span>Goal Met</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>Exceeded Goal</span>
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
