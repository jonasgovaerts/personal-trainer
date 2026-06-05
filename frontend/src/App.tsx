import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Dashboard from './pages/Dashboard'
import Analytics from './pages/Analytics'
import WorkoutBuilder from './pages/WorkoutBuilder'
import Exercises from './pages/Exercises'
import PredefinedWorkouts from './pages/PredefinedWorkouts'
import ActiveWorkout from './pages/ActiveWorkout'
import History from './pages/History'
import Nutrition from './pages/Nutrition'
import Profile from './pages/Profile'
import SetupWizard from './components/SetupWizard'
import { UIProvider } from './contexts/UIContext'
import { UserProvider, useUser } from './contexts/UserContext'

function AppContent() {
  const { user, loading, refreshUser } = useUser();
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user || !user.name) {
        setShowSetup(true);
      } else {
        setShowSetup(false);
      }
    }
  }, [user, loading]);

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans relative">
      {showSetup && (
        <SetupWizard onComplete={() => { setShowSetup(false); refreshUser(); }} />
      )}
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/history" element={<History />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/workout-builder" element={<WorkoutBuilder />} />
        <Route path="/exercises" element={<Exercises />} />
        <Route path="/plans" element={<PredefinedWorkouts />} />
        <Route path="/active-workout" element={<ActiveWorkout />} />
        <Route path="/nutrition" element={<Nutrition />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <UIProvider>
      <UserProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppContent />
        </Router>
      </UserProvider>
    </UIProvider>
  )
}

export default App
