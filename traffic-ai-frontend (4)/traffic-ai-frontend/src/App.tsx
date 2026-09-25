import React, { useState, useEffect } from 'react';
import type { UserProfile } from './types/signalsync';
import { Shell } from './components/Shell';
import type { PageId } from './components/Shell';

import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { JunctionPage } from './pages/JunctionPage';
import { CorridorPage } from './pages/CorridorPage';
import { PredictionsPage } from './pages/PredictionsPage';
import { PlansPage } from './pages/PlansPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ComparePage } from './pages/ComparePage';

type AppRoute = 'landing' | 'login' | PageId;

const DEFAULT_USER: UserProfile = {
  name: 'Dharshini R',
  email: 'ops@signalsync.city',
  role: 'Traffic operator',
  dept: 'Coimbatore City Traffic Police & Municipal Corp',
  empId: 'EMP-7178',
  phone: '+91 98401 23456',
};

export const App: React.FC = () => {
  const [route, setRoute] = useState<AppRoute>('landing');
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('signalsync_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('signalsync_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('signalsync_user');
    }
  }, [user]);

  const handleLoginSuccess = (loggedInUser: UserProfile) => {
    setUser(loggedInUser);
    setRoute('dashboard');
  };

  const handleSignOut = () => {
    setUser(null);
    setRoute('landing');
  };

  const handleUpdateUser = (updated: UserProfile) => {
    setUser(updated);
  };

  // ── Unauthenticated Views ──────────────────────────────────────
  if (!user) {
    if (route === 'login') {
      return (
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onBack={() => setRoute('landing')}
        />
      );
    }
    return <LandingPage onNavigateToLogin={() => setRoute('login')} />;
  }

  // ── Authenticated Control Room Views ───────────────────────────
  const activePage: PageId =
    route === 'landing' || route === 'login' ? 'dashboard' : (route as PageId);

  return (
    <Shell
      currentPage={activePage}
      onNavigate={(page) => setRoute(page)}
      user={user || DEFAULT_USER}
      onSignOut={handleSignOut}
    >
      {activePage === 'dashboard' && <DashboardPage onNavigate={(page) => setRoute(page)} />}
      {activePage === 'junction' && <JunctionPage onNavigate={(page) => setRoute(page)} />}
      {activePage === 'compare' && <ComparePage />}
      {activePage === 'corridor' && <CorridorPage onNavigate={(page) => setRoute(page)} />}
      {activePage === 'predict' && <PredictionsPage />}
      {activePage === 'plans' && <PlansPage />}
      {activePage === 'analytics' && <AnalyticsPage />}
      {activePage === 'incidents' && <IncidentsPage onNavigate={(page) => setRoute(page)} />}
      {activePage === 'settings' && (
        <SettingsPage user={user || DEFAULT_USER} onUpdateUser={handleUpdateUser} />
      )}
    </Shell>
  );
};

export default App;
