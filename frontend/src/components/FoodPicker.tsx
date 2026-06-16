import { useState, useRef, useEffect } from 'react';
import {
  Camera, ScanBarcode, Plus, Apple, Sparkles, Activity, X,
  Search as SearchIcon, Loader2, AlertTriangle, Check
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useUI } from '../contexts/UIContext';
import { Html5Qrcode } from "html5-qrcode";

export interface PickedFoodItem {
  barcode?: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  portionGrams: number;
  type: 'food' | 'drink';
}

interface VerificationItem {
  barcode?: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  type?: 'food' | 'drink';
  brand?: string;
  image?: string;
}

interface FoodPickerProps {
  onConfirm: (item: PickedFoodItem) => void;
  confirmLabel?: string;
  // Optional second action in the verification modal (e.g. Quick Log on the nutrition page)
  secondaryLabel?: string;
  onSecondaryConfirm?: (item: PickedFoodItem) => void;
}

export default function FoodPicker({ onConfirm, confirmLabel = 'Add Item', secondaryLabel, onSecondaryConfirm }: FoodPickerProps) {
  const { toast } = useUI();

  const [activeTab, setActiveTab] = useState<'manual' | 'ai' | 'barcode' | 'search'>('search');

  // Verification Modal State
  const [verificationItem, setVerificationItem] = useState<VerificationItem | null>(null);
  const [portionGrams, setPortionGrams] = useState<string>('100');

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

  // --- Barcode Scanner Logic ---
  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;

    const timeoutId = setTimeout(() => {
      if (activeTab === 'barcode' && isCameraOpen) {
        try {
          html5QrCode = new Html5Qrcode("food-picker-reader");
          html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 150 } },
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

  const triggerVerification = (item: any) => {
    const safeItem: VerificationItem = {
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

  const finalizeItem = (secondary: boolean) => {
    if (!verificationItem) return;

    const grams = parseFloat(portionGrams) || 100;
    const factor = grams / 100;

    const finalItem: PickedFoodItem = {
      barcode: verificationItem.barcode,
      name: verificationItem.name,
      calories: Math.round(verificationItem.calories * factor),
      protein: Number((verificationItem.protein * factor).toFixed(2)),
      carbs: Number((verificationItem.carbs * factor).toFixed(2)),
      fat: Number((verificationItem.fat * factor).toFixed(2)),
      fiber: Number((verificationItem.fiber * factor).toFixed(2)),
      portionGrams: grams,
      type: verificationItem.type || 'food'
    };

    if (secondary && onSecondaryConfirm) {
      onSecondaryConfirm(finalItem);
    } else {
      onConfirm(finalItem);
    }
    setVerificationItem(null);
  };

  const handleSearch = async () => {
    if (!searchQuery || isSearching) return;
    setIsSearching(true);
    setHasSearched(true);
    setSearchResults([]);
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
      triggerVerification({ ...data, barcode: code });
    } catch (err) {
      console.error(err);
      toast('Barcode not recognized. Try AI Cam!', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualAdd = () => {
    if (!manualName || !manualCal) return;
    triggerVerification({
      name: manualName,
      calories: manualCal,
      protein: manualP,
      carbs: manualC,
      fat: manualF,
      fiber: manualFiber,
      type: manualType
    });
    setManualName('');
    setManualCal('');
    setManualP('');
    setManualC('');
    setManualF('');
    setManualFiber('');
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
      setAiPrompt('');
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

  return (
    <div className="flex flex-col">
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
          <Camera className="w-3.5 h-3.5" /> AI
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
                <p className="text-center text-slate-500 py-8 text-sm italic">Search the food database to add items.</p>
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
                  <div id="food-picker-reader" className="w-full"></div>
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
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Name</label>
                <input
                  type="text"
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  placeholder={manualType === 'food' ? "e.g. Chicken" : "e.g. Orange Juice"}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Calories / 100{manualType === 'drink' ? 'ml' : 'g'}</label>
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
            <button
              onClick={handleManualAdd}
              disabled={!manualName || !manualCal}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors text-sm uppercase tracking-wider"
            >
              Review & Add
            </button>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="flex flex-col items-center justify-center text-center p-6 bg-slate-950/50 border border-dashed border-slate-700 rounded-xl overflow-hidden relative min-h-[200px]">
            {isProcessing ? (
              <>
                <Activity className="w-12 h-12 animate-spin mb-4 text-blue-500" />
                <p className="font-semibold text-blue-400">Analyzing...</p>
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
                <p className="text-slate-400 text-sm mb-4 max-w-sm">Snap a photo of your food and let AI estimate the nutrition values.</p>

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
                  onClick={() => setVerificationItem({ ...verificationItem, type: 'food' })}
                  className={cn("flex-1 py-2 text-[10px] font-bold rounded-xl transition-all", verificationItem.type === 'food' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-400")}
                >
                  FOOD (g)
                </button>
                <button
                  onClick={() => setVerificationItem({ ...verificationItem, type: 'drink' })}
                  className={cn("flex-1 py-2 text-[10px] font-bold rounded-xl transition-all", verificationItem.type === 'drink' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-400")}
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
                    onChange={e => setVerificationItem({ ...verificationItem, name: e.target.value })}
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
                      value={verificationItem.calories}
                      onChange={e => setVerificationItem({ ...verificationItem, calories: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-blue-500 uppercase mb-1 block">Protein (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      inputMode="decimal"
                      value={verificationItem.protein}
                      onChange={e => setVerificationItem({ ...verificationItem, protein: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-blue-900/30 rounded-xl p-3 text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-orange-500 uppercase mb-1 block">Carbs (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      inputMode="decimal"
                      value={verificationItem.carbs}
                      onChange={e => setVerificationItem({ ...verificationItem, carbs: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-orange-900/30 rounded-xl p-3 text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-emerald-500 uppercase mb-1 block">Fat (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      inputMode="decimal"
                      value={verificationItem.fat}
                      onChange={e => setVerificationItem({ ...verificationItem, fat: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-emerald-900/30 rounded-xl p-3 text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-purple-500 uppercase mb-1 block">Fiber (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      inputMode="decimal"
                      value={verificationItem.fiber}
                      onChange={e => setVerificationItem({ ...verificationItem, fiber: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-purple-900/30 rounded-xl p-3 text-white focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-blue-600/5 border border-blue-600/20 rounded-2xl p-5">
                <label className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2 block text-center">Portion size</label>
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
                onClick={() => finalizeItem(false)}
                className={cn("bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-blue-600/20 uppercase tracking-widest text-[10px] lg:text-xs", secondaryLabel ? "flex-1" : "w-full")}
              >
                {confirmLabel}
              </button>
              {secondaryLabel && onSecondaryConfirm && (
                <button
                  onClick={() => finalizeItem(true)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold py-4 rounded-2xl transition-all uppercase tracking-widest text-[10px] lg:text-xs"
                >
                  {secondaryLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
