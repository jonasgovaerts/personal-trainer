import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Activity, CalendarDays, TrendingUp, Search, 
  Settings, Dumbbell, FilePlus, User, Globe, ClipboardList, Apple, Menu, X, Plus,
  Sparkles, Trash2, Loader2, FileText, Paperclip, Send
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useUser } from '../contexts/UserContext';
import { useUI } from '../contexts/UIContext';

const renderMessageText = (text: string) => {
  if (!text) return null;
  const boldParts = text.split(/\*\*([^*]+)\*\*/g);
  return boldParts.map((part, index) => {
    if (index % 2 === 1) {
      return <strong key={index} className="font-bold text-white">{part}</strong>;
    }
    const lineParts = part.split('\n');
    return lineParts.map((line, lineIdx) => (
      <span key={lineIdx}>
        {lineIdx > 0 && <br />}
        {line}
      </span>
    ));
  });
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useUser();
  const { toast, confirm } = useUI();
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // AI Coach Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [chatMessages, setChatMessages] = useState<{role: 'user'|'ai', text: string, file?: string}[]>([
    { role: 'ai', text: "Hey! I'm your AI fitness coach. Ask me anything about your workouts or nutrition! You can also upload .gpx or .tcx files from Strava/Garmin for analysis." }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const fileChatRef = useRef<HTMLInputElement>(null);

  const handleSendMessage = async () => {
    if ((!chatInput.trim() && !selectedFile) || isChatLoading) return;

    const userMsg = chatInput.trim();
    const fileName = selectedFile?.name;
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg || (fileName ? `Analyzed file: ${fileName}` : ''), file: fileName }]);

    const formData = new FormData();
    formData.append('message', userMsg);
    if (selectedFile) {
      formData.append('file', selectedFile);
    }

    setChatInput('');
    setSelectedFile(null);
    setIsChatLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Chat failed');
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'ai', text: data.reply }]);

      // If AI found burned calories, notify pages to refresh their data
      if (data.burned_calories) {
        toast(`Logged ${data.burned_calories} kcal from ${data.activity_name || 'workout'}!`, 'success');
        window.dispatchEvent(new CustomEvent('refreshData'));
      }
    } catch (err) {
      console.error(err);
      toast('Failed to get coach response', 'error');
    } finally {
      setIsChatLoading(false);
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language.startsWith('en') ? 'nl' : 'en';
    i18n.changeLanguage(newLang);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsStartMenuOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userName = user?.name || '';
  const initial = userName ? userName.charAt(0).toUpperCase() : null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Sidebar Navigation - Desktop Only */}
      <aside className="hidden lg:flex w-64 border-r border-slate-800 bg-slate-950 flex-col z-20 shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 text-blue-500">
            <Dumbbell className="h-6 w-6" />
            <span className="text-xl font-bold tracking-tight text-white uppercase">{t('app.title')}</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          <NavItem to="/" icon={<Activity />} label={t('nav.overview')} />
          <NavItem to="/history" icon={<CalendarDays />} label={t('nav.history')} />
          <NavItem to="/analytics" icon={<TrendingUp />} label={t('nav.progress')} />
          <NavItem to="/nutrition" icon={<Apple />} label={t('nav.nutrition')} />
          <div className="pt-6 pb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2">{t('nav.training')}</p>
          </div>
          <NavItem to="/plans" icon={<ClipboardList />} label={t('nav.predefined')} />
          <NavItem to="/workout-builder" icon={<FilePlus />} label={t('nav.workoutBuilder')} />
          <NavItem to="/exercises" icon={<Dumbbell />} label={t('nav.exercises')} />
        </div>
        
        <div className="p-4 border-t border-slate-800 shrink-0">
          <button 
            onClick={() => navigate('/profile')}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-800/50 transition-colors text-left group"
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
              {initial ? initial : <User className="w-4 h-4" />}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{userName || t('nav.profile')}</p>
              <p className="text-xs text-slate-400 truncate">{t('nav.settings')}</p>
            </div>
            <Settings className="w-4 h-4 text-slate-500 group-hover:text-white shrink-0 transition-colors" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-4 lg:px-8 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md z-10 shrink-0 gap-4">
          {/* Mobile Menu Button & Search Toggle */}
          <div className="flex items-center lg:hidden">
            <button 
              onClick={() => setIsMobileMobileMenuOpen(true)}
              className={cn("p-2 text-slate-400 hover:text-white transition-colors", isSearchOpen && "hidden")}
            >
              <Menu className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="p-2 text-slate-400 hover:text-white transition-colors"
            >
              {isSearchOpen ? <X className="w-6 h-6" /> : <Search className="w-6 h-6" />}
            </button>
          </div>

          {!isSearchOpen && (
            <div className="flex items-center gap-2 lg:hidden text-blue-500 flex-1 justify-center animate-in fade-in duration-300">
              <Dumbbell className="h-5 w-5" />
              <span className="text-sm font-bold tracking-tight text-white uppercase">{t('app.title')}</span>
            </div>
          )}

          {/* Desktop Search & Mobile Search Input */}
          <div className={cn(
            "flex-1 max-w-xl transition-all duration-300",
            isSearchOpen ? "block" : "hidden lg:block"
          )}>
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                value={headerSearch}
                onChange={(e) => setHeaderSearch(e.target.value)}
                placeholder={t('header.search')}
                className="w-full bg-slate-900 border border-slate-800 rounded-full py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                autoFocus={isSearchOpen}
              />
            </div>
          </div>
          
          <div className={cn(
            "flex items-center gap-2 lg:gap-4 shrink-0",
            isSearchOpen && "hidden sm:flex"
          )}>
            <button 
              onClick={toggleLanguage}
              className="flex items-center gap-2 p-1.5 lg:p-2 text-slate-400 hover:text-white transition-colors bg-slate-900 rounded-full border border-slate-800"
              title="Toggle Language"
            >
              <Globe className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              <span className="text-[10px] lg:text-xs font-bold uppercase">{i18n.language.split('-')[0]}</span>
            </button>
            
            {/* Start Workout Dropdown */}
            <div className="relative" ref={menuRef}>
              <button 
                onClick={() => setIsStartMenuOpen(!isStartMenuOpen)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs lg:text-sm font-medium py-1.5 lg:py-2 px-3 lg:px-4 rounded-full flex items-center gap-1.5 lg:gap-2 transition-all shadow-lg shadow-blue-600/20"
              >
                <Plus className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                <span className="hidden sm:inline">{t('header.startWorkout')}</span>
                <span className="sm:hidden">Start</span>
              </button>
              
              {isStartMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden py-2 z-50">
                  <button 
                    onClick={() => { setIsStartMenuOpen(false); navigate('/plans'); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-left"
                  >
                    <ClipboardList className="w-4 h-4 text-blue-500" />
                    {t('header.startMenu.plans')}
                  </button>
                  <button 
                    onClick={() => { setIsStartMenuOpen(false); navigate('/workout-builder'); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-left"
                  >
                    <FilePlus className="w-4 h-4 text-purple-500" />
                    {t('header.startMenu.custom')}
                  </button>
                  <button 
                    onClick={() => { setIsStartMenuOpen(false); navigate('/exercises'); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-left"
                  >
                    <Dumbbell className="w-4 h-4 text-emerald-500" />
                    {t('header.startMenu.exercises')}
                  </button>
                </div>
              )}
            </div>

            <button 
              onClick={() => navigate('/profile')}
              className="lg:hidden w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 overflow-hidden"
            >
              {initial ? <span className="text-xs font-bold text-white">{initial}</span> : <User className="w-4 h-4 text-slate-400" />}
            </button>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 relative">
          {children}
        </div>

        {/* Bottom Navigation - Mobile Only */}
        <nav className="lg:hidden h-16 bg-slate-950 border-t border-slate-800 flex items-center justify-around px-2 z-20 pb-safe shrink-0">
          <BottomNavItem to="/" icon={<Activity />} label={t('nav.overview')} />
          <BottomNavItem to="/history" icon={<CalendarDays />} label={t('nav.history')} />
          <BottomNavItem to="/analytics" icon={<TrendingUp />} label={t('nav.progress')} />
          <BottomNavItem to="/nutrition" icon={<Apple />} label={t('nav.nutrition')} />
        </nav>
      </main>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[60] lg:hidden">
          <div 
            ref={mobileMenuRef}
            className="absolute inset-y-0 left-0 w-72 bg-slate-900 border-r border-slate-800 shadow-2xl flex flex-col p-6 animate-in slide-in-from-left duration-300"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2 text-blue-500">
                <Dumbbell className="h-6 w-6" />
                <span className="text-xl font-bold tracking-tight text-white uppercase">{t('app.title')}</span>
              </div>
              <button onClick={() => setIsMobileMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto -mx-2 px-2">
              <NavItem to="/" icon={<Activity />} label={t('nav.overview')} onClick={() => setIsMobileMobileMenuOpen(false)} />
              <NavItem to="/history" icon={<CalendarDays />} label={t('nav.history')} onClick={() => setIsMobileMobileMenuOpen(false)} />
              <NavItem to="/analytics" icon={<TrendingUp />} label={t('nav.progress')} onClick={() => setIsMobileMobileMenuOpen(false)} />
              <NavItem to="/nutrition" icon={<Apple />} label={t('nav.nutrition')} onClick={() => setIsMobileMobileMenuOpen(false)} />
              
              <div className="pt-6 pb-2 px-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('nav.training')}</p>
              </div>
              <NavItem to="/plans" icon={<ClipboardList />} label={t('nav.predefined')} onClick={() => setIsMobileMobileMenuOpen(false)} />
              <NavItem to="/workout-builder" icon={<FilePlus />} label={t('nav.workoutBuilder')} onClick={() => setIsMobileMobileMenuOpen(false)} />
              <NavItem to="/exercises" icon={<Dumbbell />} label={t('nav.exercises')} onClick={() => setIsMobileMobileMenuOpen(false)} />
            </div>

            <div className="mt-auto pt-6 border-t border-slate-800">
              <button 
                onClick={() => { setIsMobileMobileMenuOpen(false); navigate('/profile'); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                  {initial ? initial : <User className="w-5 h-5" />}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-medium text-white truncate">{userName || t('nav.profile')}</p>
                  <p className="text-xs text-slate-400 truncate">{t('nav.settings')}</p>
                </div>
                <Settings className="w-5 h-5 text-slate-500" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Coach Chat Section - Floating Widget */}
      <div className={cn(
        "fixed transition-all duration-500 z-[60] ease-in-out",
        isChatOpen 
          ? "bottom-24 right-4 left-4 top-20 lg:left-auto lg:top-auto lg:w-96 lg:h-[500px] opacity-100 translate-y-0 scale-100" 
          : "bottom-24 right-6 w-12 h-12 opacity-0 translate-y-20 scale-95 pointer-events-none"
      )}>
        <div className="bg-slate-900 border border-blue-500/30 rounded-2xl overflow-hidden shadow-2xl h-full flex flex-col ring-1 ring-white/10">
          <div className="bg-blue-600 p-4 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30">
                    <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">AI Coach</h3>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                      <span className="text-[10px] text-blue-100 font-bold uppercase">Online</span>
                    </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => {
                    confirm("Clear your chat history?", () => {
                      setChatMessages([{ role: 'ai', text: "Chat cleared! How else can I help?" }]);
                    });
                  }} 
                  className="text-white/70 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg" 
                  title="Clear Chat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={() => setIsChatOpen(false)} className="text-white/70 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/40 custom-scrollbar">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={cn("flex animate-in fade-in slide-in-from-bottom-2 duration-300", msg.role === 'user' ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[85%] p-3.5 rounded-2xl text-sm shadow-md",
                      msg.role === 'user' 
                        ? "bg-blue-600 text-white rounded-tr-none" 
                        : "bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700/50"
                    )}>
                      {renderMessageText(msg.text)}
                      {msg.file && (
                        <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-2 text-[10px] font-bold opacity-80 uppercase">
                           <FileText className="w-3 h-3" /> {msg.file}
                        </div>
                      )}
                    </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start animate-pulse">
                    <div className="bg-slate-800 border border-slate-700/50 p-3 rounded-2xl rounded-tl-none flex items-center gap-3">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                      <span className="text-xs text-slate-400 font-medium">Coach is thinking...</span>
                    </div>
                </div>
              )}
          </div>

          <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
              {selectedFile && (
                <div className="mb-3 p-2 bg-blue-600/10 border border-blue-500/20 rounded-xl flex items-center justify-between animate-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-2 overflow-hidden px-1">
                    <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="text-[10px] font-bold text-blue-400 truncate uppercase">{selectedFile.name}</span>
                  </div>
                  <button onClick={() => setSelectedFile(null)} className="text-slate-500 hover:text-red-500 transition-colors p-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                className="flex items-center gap-2"
              >
                <input 
                  type="file" 
                  ref={fileChatRef} 
                  className="hidden" 
                  accept=".gpx,.tcx" 
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
                <button 
                  type="button"
                  onClick={() => fileChatRef.current?.click()}
                  className={cn(
                    "p-3 rounded-xl transition-all border",
                    selectedFile ? "bg-blue-600/20 border-blue-500/40 text-blue-400" : "bg-slate-950 border-slate-700 text-slate-500 hover:text-slate-300"
                  )}
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input 
                    type="text" 
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder="Ask or upload .gpx/.tcx..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
                />
                <button 
                    type="submit"
                    disabled={(!chatInput.trim() && !selectedFile) || isChatLoading}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white p-3 rounded-xl transition-all shadow-lg shadow-blue-600/20"
                >
                    <Send className="w-5 h-5" />
                </button>
              </form>
          </div>
        </div>
      </div>

      {/* Global FAB for AI Coach */}
      {!isChatOpen && (
        <button 
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-24 right-6 w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-2xl shadow-blue-600/40 hover:shadow-blue-500/60 hover:scale-110 hover:bg-blue-500 transition-all duration-300 z-50 border-4 border-slate-950 group"
        >
          <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-950 animate-pulse" />
        </button>
      )}
    </div>
  );
}

function NavItem({ to, icon, label, onClick }: { to: string, icon: React.ReactNode, label: string, onClick?: () => void }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <NavLink 
      to={to} 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all group",
        isActive 
          ? "bg-blue-600/10 text-blue-500" 
          : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
      )}
    >
      {React.cloneElement(icon as React.ReactElement, { 
        className: cn("w-5 h-5", isActive ? "text-blue-500" : "text-slate-500 group-hover:text-slate-300") 
      })}
      {label}
    </NavLink>
  )
}

function BottomNavItem({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <NavLink 
      to={to} 
      className={cn(
        "flex flex-col items-center justify-center gap-1 flex-1 py-1 rounded-xl transition-all",
        isActive ? "text-blue-500" : "text-slate-500"
      )}
    >
      <div className={cn(
        "p-1 rounded-lg transition-all",
        isActive ? "bg-blue-500/10" : ""
      )}>
        {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5" })}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </NavLink>
  )
}
