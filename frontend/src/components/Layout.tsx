import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Activity, CalendarDays, TrendingUp, Search, 
  Settings, Dumbbell, FilePlus, User, Globe, ClipboardList, Apple, Menu, X, Plus
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useUser } from '../contexts/UserContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useUser();
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

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
