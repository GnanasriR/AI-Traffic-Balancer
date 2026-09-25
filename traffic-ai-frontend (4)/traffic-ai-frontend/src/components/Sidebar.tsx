import React from 'react';
import type { UserRole, User } from '../services/authStore';
import {
  LayoutDashboard,
  Signal,
  Network,
  BarChart2,
  Map,
  ShieldCheck,
  Settings,
  LogOut,
  ChevronRight,
  Car
} from 'lucide-react';

type Page = 'dashboard' | 'signals' | 'network' | 'analytics' | 'roads' | 'admin' | 'settings';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  user: User;
  onLogout: () => void;
}

const navItems: { id: Page; label: string; icon: any; adminOnly?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'signals',   label: 'Signal Control', icon: Signal },
  { id: 'network',   label: 'Junction Network', icon: Network },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  { id: 'roads',     label: 'Road Conditions', icon: Map },
  { id: 'admin',     label: 'Admin Management', icon: ShieldCheck, adminOnly: true },
  { id: 'settings',  label: 'Settings', icon: Settings },
];

const roleBadgeColors: Record<UserRole, string> = {
  ADMIN: 'bg-red-100 text-red-700 border border-red-200',
  OPERATOR: 'bg-blue-100 text-blue-700 border border-blue-200',
  ANALYST: 'bg-purple-100 text-purple-700 border border-purple-200',
};

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, user, onLogout }) => {
  const visibleItems = navItems.filter(item => !item.adminOnly || user.role === 'ADMIN');

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-white border-r border-slate-200 shadow-sm flex-shrink-0">
      {/* Brand Header */}
      <div className="flex items-center space-x-3 px-5 py-4 border-b border-slate-100">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25">
          <Car className="w-5 h-5" />
        </div>
        <div>
          <div className="text-base font-black text-slate-900 leading-tight">
            Transit<span className="text-blue-600">Flow</span>
          </div>
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Traffic AI Platform
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 mb-2">
          Main Navigation
        </div>
        {visibleItems.slice(0, 5).map(item => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer group ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-600'}`} style={{ width: 18, height: 18 }} />
              <span className="flex-1 text-left">{item.label}</span>
              {isActive && <ChevronRight className="w-4 h-4 text-blue-200" />}
            </button>
          );
        })}

        {/* Divider + Admin & Settings section */}
        <div className="pt-4 pb-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 mb-2">
            {user.role === 'ADMIN' ? 'Administration' : 'Account'}
          </div>
          {visibleItems.slice(5).map(item => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer group ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-600'}`} style={{ width: 18, height: 18 }} />
                <span className="flex-1 text-left">{item.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 text-blue-200" />}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Current User & Logout */}
      <div className="border-t border-slate-100 px-3 py-3 space-y-2">
        <div className="flex items-center space-x-3 px-2 py-2 rounded-xl bg-slate-50 border border-slate-100">
          {/* Avatar */}
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white text-sm font-bold flex-shrink-0 shadow-sm">
            {user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-slate-900 truncate">{user.fullName}</div>
            <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${roleBadgeColors[user.role]}`}>
              {user.role}
            </div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-all cursor-pointer group border border-transparent hover:border-red-100"
        >
          <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
