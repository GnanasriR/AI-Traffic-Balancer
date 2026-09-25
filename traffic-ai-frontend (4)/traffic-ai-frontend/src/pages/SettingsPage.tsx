import React, { useState } from 'react';
import type { UserProfile } from '../types/signalsync';

interface SettingsPageProps {
  user: UserProfile;
  onUpdateUser: (updated: UserProfile) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ user, onUpdateUser }) => {
  const [name, setName] = useState(user.name || 'Dharshini R');
  const [email, setEmail] = useState(user.email || 'ops@signalsync.city');
  const [role, setRole] = useState(user.role || 'Traffic operator');
  const [dept, setDept] = useState(user.dept || 'Coimbatore City Traffic Police & Municipal Corp');
  const [empId, setEmpId] = useState(user.empId || 'EMP-7178');
  const [phone, setPhone] = useState(user.phone || '+91 98401 23456');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserProfile = {
      name,
      email,
      role,
      dept,
      empId,
      phone,
    };
    onUpdateUser(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <>
      {saved && <div className="toast">User details saved successfully</div>}

      <div>
        <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Account Settings</h2>
        <p className="muted">Operator profile and user credentials for the traffic management platform.</p>
      </div>

      <div style={{ maxWidth: '680px', marginTop: '16px' }}>
        <div className="card">
          <div className="panelhead">
            <div className="row" style={{ gap: '10px' }}>
              <span className="avatar" style={{ width: '36px', height: '36px', fontSize: '14px' }}>
                {(name || 'OP').slice(0, 2).toUpperCase()}
              </span>
              <div>
                <strong style={{ fontSize: '15px' }}>{name || 'Traffic Operator'}</strong>
                <p className="muted" style={{ fontSize: '12px' }}>
                  {role} &middot; {dept}
                </p>
              </div>
            </div>
            <span className="tag g">&check; Active Account</span>
          </div>

          <form className="pad" onSubmit={handleSave}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="field" style={{ marginTop: 0 }}>
                <label htmlFor="pName">Full Name</label>
                <input
                  id="pName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="field" style={{ marginTop: 0 }}>
                <label htmlFor="pEmail">Work Email</label>
                <input
                  id="pEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '14px' }}>
              <div className="field" style={{ marginTop: 0 }}>
                <label htmlFor="pRole">Role / Designation</label>
                <select id="pRole" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option>Traffic operator</option>
                  <option>Signal engineer</option>
                  <option>Operations Manager</option>
                  <option>Read-only observer</option>
                </select>
              </div>
              <div className="field" style={{ marginTop: 0 }}>
                <label htmlFor="pDept">Department / Organization</label>
                <input
                  id="pDept"
                  value={dept}
                  onChange={(e) => setDept(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '14px' }}>
              <div className="field" style={{ marginTop: 0 }}>
                <label htmlFor="pEmpId">Employee ID / Badge</label>
                <input
                  id="pEmpId"
                  value={empId}
                  onChange={(e) => setEmpId(e.target.value)}
                />
              </div>
              <div className="field" style={{ marginTop: 0 }}>
                <label htmlFor="pPhone">Contact Phone</label>
                <input
                  id="pPhone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="divider" style={{ margin: '20px 0 16px' }} />

            <div className="between">
              <span className="muted" style={{ fontSize: '12px' }}>
                Profile changes take effect immediately across all sessions.
              </span>
              <button type="submit" className="btn small">
                Save User Details
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};
