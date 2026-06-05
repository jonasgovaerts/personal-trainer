import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Activity, CalendarDays, TrendingUp, Search, Bell, 
  Settings, Dumbbell, FilePlus, User, Globe, ClipboardList, ChevronDown, Apple
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useUser } from '../contexts/UserContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useUser();
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleLanguage = () => {
    const newLang = i18n.language.startsWith('en') ? 'nl' : 'en';
    i18n.changeLanguage(newLang);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsStartMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userName = user?.name || '';
  const initial = userName ? userName.charAt(0).toUpperCase() : null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-slate-800 bg-slate-950 flex flex-col z-20">
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
        <header className="h-16 flex items-center justify-between px-8 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md z-10 shrink-0">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder={t('header.search')}
              className="w-full bg-slate-900 border border-slate-800 rounded-full py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleLanguage}
              className="flex items-center gap-2 p-2 text-slate-400 hover:text-white transition-colors bg-slate-900 rounded-full border border-slate-800"
              title="Toggle Language"
            >
              <Globe className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">{i18n.language.split('-')[0]}</span>
            </button>
            <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            
            {/* Start Workout Dropdown */}
            <div className="relative" ref={menuRef}>
              <button 
                onClick={() => setIsStartMenuOpen(!isStartMenuOpen)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2 px-4 rounded-full flex items-center gap-2 transition-colors"
              >
                <Activity className="w-4 h-4" />
                {t('header.startWorkout')}
                <ChevronDown className="w-4 h-4 ml-1" />
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
            
          </div>
        </header>

        {/* Scrollable Page Content */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <NavLink 
      to={to} 
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
