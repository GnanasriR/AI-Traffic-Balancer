import React from 'react';
import type { UserProfile } from '../types/signalsync';
import {
  IcoGrid,
  IcoSignal,
  IcoNet,
  IcoWave,
  IcoSliders,
  IcoChart,
  IcoAlert,
  IcoCog,
  IcoOut,
} from './Icons';
import { SyncDebugPanel } from './SyncDebugPanel';

export type PageId =
  | 'dashboard'
  | 'junction'
  | 'compare'
  | 'corridor'
  | 'predict'
  | 'plans'
  | 'analytics'
  | 'incidents'
  | 'settings';

interface ShellProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  user: UserProfile;
  onSignOut: () => void;
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({
  currentPage,
  onNavigate,
  user,
  onSignOut,
  children,
}) => {
  const navItems: { id: PageId; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <IcoGrid /> },
    { id: 'junction', label: 'Junction view', icon: <IcoSignal /> },
    { id: 'compare', label: 'Compare A/B', icon: <IcoSliders /> },
    { id: 'corridor', label: 'Corridor', icon: <IcoNet /> },
    { id: 'predict', label: 'Predictions', icon: <IcoWave /> },
    { id: 'plans', label: 'Signal plans', icon: <IcoSliders /> },
    { id: 'analytics', label: 'Analytics', icon: <IcoChart /> },
    { id: 'incidents', label: 'Incidents', icon: <IcoAlert /> },
  ];

  return (
    <div className="shell">
      {/* Left Sidebar */}
      <aside className="side">
        <div className="brandmark" style={{ cursor: 'pointer' }} onClick={() => onNavigate('dashboard')}>
          SignalSync
        </div>
        {navItems.map((item) => (
          <div
            key={item.id}
            className={`navitem ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </div>
        ))}
        <div className="grouplbl">Account</div>
        <div
          className={`navitem ${currentPage === 'settings' ? 'active' : ''}`}
          onClick={() => onNavigate('settings')}
        >
          <IcoCog />
          <span>Settings</span>
        </div>
        <div className="spacer" />
        <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '9px' }}>
          <span className="avatar">{(user.name || 'OP').slice(0, 2).toUpperCase()}</span>
          <div style={{ lineHeight: 1.2, minWidth: 0, overflow: 'hidden' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {user.name || 'Operator'}
            </div>
            <div className="muted" style={{ fontSize: '11px' }}>{user.role || 'Traffic operator'}</div>
          </div>
        </div>
        <div className="navitem" onClick={onSignOut} style={{ marginTop: '4px' }}>
          <IcoOut />
          <span>Sign out</span>
        </div>
      </aside>

      {/* Main Container */}
      <div className="main">
        {/* Mobile Navigation */}
        <div className="mobnav">
          {navItems.concat([{ id: 'settings', label: 'Settings', icon: <IcoCog /> }]).map((item) => (
            <div
              key={item.id}
              className={`navitem ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Dynamic Content */}
        <div className="content">{children}</div>
      </div>

      {/* Authoritative Python Synchronization & Diagnostics Panel */}
      <SyncDebugPanel />
    </div>
  );
};
