import React, { useState } from 'react';
import { authStore, validatePassword } from '../services/authStore';
import type { User, UserRole } from '../services/authStore';
import {
  UserPlus,
  Users,
  Shield,
  Check,
  X,
  Eye,
  EyeOff,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Settings2,
  ChevronDown,
  Search
} from 'lucide-react';

const roleBadge: Record<UserRole, string> = {
  ADMIN: 'bg-red-50 text-red-700 border-red-200',
  OPERATOR: 'bg-blue-50 text-blue-700 border-blue-200',
  ANALYST: 'bg-purple-50 text-purple-700 border-purple-200',
};

const PasswordRequirement: React.FC<{ met: boolean; label: string }> = ({ met, label }) => (
  <div className={`flex items-center space-x-2 text-xs font-semibold transition-colors ${met ? 'text-emerald-700' : 'text-slate-400'}`}>
    {met ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5 text-slate-300" />}
    <span>{label}</span>
  </div>
);

export const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'USERS' | 'REGISTER' | 'CONFIG'>('USERS');
  const [users, setUsers] = useState<User[]>(authStore.listUsers());
  const [searchTerm, setSearchTerm] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Registration form state
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    username: '',
    organization: '',
    employeeId: '',
    role: 'OPERATOR' as UserRole,
    password: '',
    confirmPassword: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);

  const pwV = validatePassword(form.password);

  // Config params
  const [config, setConfig] = useState({
    minGreen: 12,
    maxGreen: 55,
    yellowTime: 4,
    greenWaveOffsetJ1J3: 25,
    greenWaveOffsetJ2J3: 22,
    greenWaveOffsetJ3J4: 28,
    maxCycleTime: 120,
  });

  const setField = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const filteredUsers = users.filter(u =>
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.organization.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (!form.fullName || !form.username || !form.organization || !form.employeeId) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    const result = authStore.registerUser({
      username: form.username,
      fullName: form.fullName,
      phone: form.phone,
      organization: form.organization,
      employeeId: form.employeeId,
      role: form.role,
      password: form.password,
    });
    if (result.success) {
      setSuccessMsg(`User "${form.fullName}" registered successfully.`);
      setUsers(authStore.listUsers());
      setForm({ fullName: '', phone: '', username: '', organization: '', employeeId: '', role: 'OPERATOR', password: '', confirmPassword: '' });
      setTimeout(() => { setActiveTab('USERS'); setSuccessMsg(''); }, 2000);
    } else {
      setErrorMsg(result.error ?? 'Registration failed.');
    }
  };

  const handleDeactivate = (id: string) => {
    authStore.deactivateUser(id);
    setUsers(authStore.listUsers());
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      authStore.deleteUser(id);
      setUsers(authStore.listUsers());
    }
  };

  return (
    <div className="flex-1 bg-[#f8fafc] overflow-y-auto">
      <div className="bg-white border-b border-slate-200 px-6 py-3.5 shadow-xs sticky top-0 z-30">
        <h1 className="text-lg font-black text-slate-900">Admin Management Center</h1>
        <p className="text-xs text-slate-500 font-medium">Manage users, roles, and system configurations.</p>
      </div>

      <div className="p-6">
        {/* Tabs */}
        <div className="flex items-center space-x-1 bg-slate-200/60 p-1 rounded-xl border border-slate-300/50 w-fit mb-6">
          {([
            { id: 'USERS', label: 'User Directory', icon: Users },
            { id: 'REGISTER', label: 'Register New User', icon: UserPlus },
            { id: 'CONFIG', label: 'System Configuration', icon: Settings2 },
          ] as const).map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setErrorMsg(''); setSuccessMsg(''); }}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── USER DIRECTORY TAB ─────────────────────────────────────────── */}
        {activeTab === 'USERS' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="font-black text-slate-900 text-sm">Registered Users</span>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {users.length}
                </span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    {['Full Name', 'Username', 'Organization', 'Employee ID', 'Role', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2.5">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white text-xs font-bold flex-shrink-0">
                            {u.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900">{u.fullName}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{u.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-700 font-bold">{u.username}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-medium">{u.organization}</td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-500">{u.employeeId}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleBadge[u.role]}`}>{u.role}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${u.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1">
                          <button onClick={() => handleDeactivate(u.id)} title={u.isActive ? 'Deactivate' : 'Activate'} className={`p-1.5 rounded-lg transition-all ${u.isActive ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}>
                            {u.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          </button>
                          <button onClick={() => handleDelete(u.id)} title="Delete" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── REGISTER USER TAB ──────────────────────────────────────────── */}
        {activeTab === 'REGISTER' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center space-x-3 mb-5 pb-4 border-b border-slate-100">
                <div className="p-2 rounded-xl bg-blue-50 border border-blue-100">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">Register New User</h2>
                  <p className="text-xs text-slate-500 font-medium">Fill in all fields to create a new platform account.</p>
                </div>
              </div>

              <form onSubmit={handleRegister} className="space-y-5">
                {/* Personal Information */}
                <div>
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
                    <span className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[10px] font-black">1</span>
                    <span>Personal Information</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Full Name <span className="text-red-500">*</span></label>
                      <input value={form.fullName} onChange={setField('fullName')} placeholder="Enter your full name" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Phone Number</label>
                      <input value={form.phone} onChange={setField('phone')} placeholder="Enter your phone number" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                    </div>
                  </div>
                </div>

                {/* Organization Details */}
                <div>
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
                    <span className="w-5 h-5 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black">2</span>
                    <span>Organization Details</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Username <span className="text-red-500">*</span></label>
                      <input value={form.username} onChange={setField('username')} placeholder="Choose a username" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Organization / Department <span className="text-red-500">*</span></label>
                      <input value={form.organization} onChange={setField('organization')} placeholder="Enter your organization or department" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Employee ID <span className="text-red-500">*</span></label>
                      <input value={form.employeeId} onChange={setField('employeeId')} placeholder="Enter your employee ID" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Role <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <select value={form.role} onChange={setField('role')} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium appearance-none cursor-pointer">
                          <option value="OPERATOR">Traffic Operator</option>
                          <option value="ANALYST">Traffic Analyst</option>
                          <option value="ADMIN">Administrator</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Create Password */}
                <div>
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
                    <span className="w-5 h-5 flex items-center justify-center rounded-full bg-purple-100 text-purple-700 text-[10px] font-black">3</span>
                    <span>Create Password</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Password <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <input
                          type={showPw ? 'text' : 'password'}
                          value={form.password}
                          onChange={setField('password')}
                          placeholder="Create a strong password"
                          className="w-full px-3 pr-10 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                        />
                        <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Confirm Password <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <input
                          type={showCpw ? 'text' : 'password'}
                          value={form.confirmPassword}
                          onChange={setField('confirmPassword')}
                          placeholder="Re-enter your password"
                          className={`w-full px-3 pr-10 py-2.5 text-sm border rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium ${
                            form.confirmPassword && form.password !== form.confirmPassword
                              ? 'border-red-300 bg-red-50'
                              : 'border-slate-200'
                          }`}
                        />
                        <button type="button" onClick={() => setShowCpw(!showCpw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                          {showCpw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Password Requirements */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
                      Password Requirements
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <PasswordRequirement met={pwV.minLength} label="At least 8 characters" />
                      <PasswordRequirement met={pwV.hasUppercase} label="One uppercase letter" />
                      <PasswordRequirement met={pwV.hasNumber} label="One number" />
                      <PasswordRequirement met={pwV.hasSpecial} label="One special character" />
                    </div>
                  </div>
                </div>

                {/* Messages */}
                {errorMsg && (
                  <div className="flex items-center space-x-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold">
                    <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
                {successMsg && (
                  <div className="flex items-center space-x-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold">
                    <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-blue-600 text-white font-black text-sm shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center justify-center space-x-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Register User Account</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── CONFIG TAB ────────────────────────────────────────────────── */}
        {activeTab === 'CONFIG' && (
          <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center space-x-3 mb-5 pb-4 border-b border-slate-100">
              <div className="p-2 rounded-xl bg-purple-50 border border-purple-100">
                <Settings2 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900">AI System Configuration</h2>
                <p className="text-xs text-slate-500 font-medium">Adjust global signal timing constraints and green wave parameters.</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Signal Timing */}
              <div>
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
                  <Shield className="w-3.5 h-3.5 text-blue-600" />
                  <span>Signal Timing Constraints</span>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { key: 'minGreen', label: 'Min Green (s)', color: 'blue' },
                    { key: 'maxGreen', label: 'Max Green (s)', color: 'emerald' },
                    { key: 'yellowTime', label: 'Yellow Time (s)', color: 'amber' },
                    { key: 'maxCycleTime', label: 'Max Cycle (s)', color: 'purple' },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="block text-xs font-bold text-slate-600 mb-1">{field.label}</label>
                      <input
                        type="number"
                        value={config[field.key as keyof typeof config]}
                        onChange={e => setConfig(prev => ({ ...prev, [field.key]: Number(e.target.value) }))}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono font-bold text-center"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Green Wave Offsets */}
              <div>
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Green Wave Coordination Offsets</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { key: 'greenWaveOffsetJ1J3', label: 'J1 → J3 Offset (s)' },
                    { key: 'greenWaveOffsetJ2J3', label: 'J2 → J3 Offset (s)' },
                    { key: 'greenWaveOffsetJ3J4', label: 'J3 → J4 Offset (s)' },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="block text-xs font-bold text-slate-600 mb-1">{field.label}</label>
                      <input
                        type="number"
                        value={config[field.key as keyof typeof config]}
                        onChange={e => setConfig(prev => ({ ...prev, [field.key]: Number(e.target.value) }))}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono font-bold text-center"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button className="w-full py-3 rounded-xl bg-blue-600 text-white font-black text-sm shadow-md hover:bg-blue-700 transition-all flex items-center justify-center space-x-2">
                <Check className="w-4 h-4" />
                <span>Save System Configuration</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
