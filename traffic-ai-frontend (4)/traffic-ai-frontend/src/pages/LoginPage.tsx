import React, { useState } from 'react';
import type { UserProfile } from '../types/signalsync';
import { AuthCanvas } from '../components/AuthCanvas';
import { authStore } from '../services/authStore';

interface LoginPageProps {
  onLoginSuccess: (user: UserProfile) => void;
  onBack: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onBack }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError(true);
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const cleanUsername = username.trim();
    const authRes = await authStore.loginAsync(cleanUsername, password);
    setLoading(false);

    if (!authRes.success) {
      setError(true);
      setErrorMessage(authRes.error || 'Authentication failed');
      return;
    }

    const serverRole = authRes.user?.role || 'OPERATOR';
    const name = authRes.user?.fullName || cleanUsername;

    onLoginSuccess({
      name: name,
      email: `${cleanUsername}@signalsync.city`,
      role: serverRole,
      dept: authRes.user?.organization || 'Coimbatore City Traffic Police & Municipal Corp',
      empId: authRes.user?.employeeId || 'EMP-7178',
      phone: authRes.user?.phone || '+91 98401 23456',
    });
  };

  return (
    <div className="auth">
      {/* Ambient Animated Aside */}
      <div className="aside">
        <AuthCanvas />
        <div className="inner">
          <div className="brandmark" style={{ color: '#fff', fontSize: '19px', cursor: 'pointer' }} onClick={onBack}>
            SignalSync
          </div>
          <h2 style={{ marginTop: '42px' }}>The corridor is already running.</h2>
          <p>
            Sign in to see every approach, read what the model expects next, and change a plan without
            leaving the room.
          </p>
        </div>
        <p className="quote">Four junctions · eleven approaches · responsive plans since 04:12</p>
      </div>

      {/* Auth Box Form */}
      <div className="authbox">
        <form className="form" onSubmit={handleSubmit}>
          <h2 style={{ fontSize: '28px' }}>Sign in</h2>
          <p className="muted" style={{ marginTop: '6px' }}>
            Operator access to the Coimbatore control room.
          </p>

          <div className="field">
            <label htmlFor="un">Username</label>
            <input
              id="un"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(false);
              }}
              autoComplete="username"
            />
          </div>

          <div className="field">
            <label htmlFor="pw">Password</label>
            <input
              id="pw"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              autoComplete="current-password"
            />
          </div>

          {error && <div className="err">{errorMessage || 'Enter a username and password to continue.'}</div>}

          <button
            type="submit"
            className="btn"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: '20px', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          <p className="muted" style={{ marginTop: '18px' }}>
            <button
              type="button"
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'inherit',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              Back to the overview
            </button>
          </p>
        </form>
      </div>
    </div>
  );
};
