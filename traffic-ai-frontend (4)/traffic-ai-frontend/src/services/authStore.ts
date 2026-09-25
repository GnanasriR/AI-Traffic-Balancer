// ─────────────────────────────────────────────
// Auth Store — User management & localStorage
// ─────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'OPERATOR' | 'ANALYST';

export interface User {
  id: string;
  username: string;
  fullName: string;
  phone: string;
  organization: string;
  employeeId: string;
  role: UserRole;
  passwordHash: string; // We store as plain for demo; in prod use bcrypt
  isActive: boolean;
  createdAt: string;
}

export interface PasswordValidation {
  minLength: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  isValid: boolean;
}

const STORAGE_KEY = 'transitflow_users';
const SESSION_KEY = 'transitflow_session';

// ── Default seed accounts ──────────────────────────────────────────────────
const DEFAULT_USERS: User[] = [
  {
    id: 'usr_admin_001',
    username: 'admin',
    fullName: 'System Administrator',
    phone: '+91 98765 43210',
    organization: 'Traffic Control Authority',
    employeeId: 'TCA-ADM-001',
    role: 'ADMIN',
    passwordHash: 'Admin@123',
    isActive: true,
    createdAt: '2024-01-15T09:00:00.000Z',
  },
  {
    id: 'usr_op_001',
    username: 'operator',
    fullName: 'Ravi Kumar',
    phone: '+91 91234 56789',
    organization: 'Central Traffic Division',
    employeeId: 'CTD-OPR-001',
    role: 'OPERATOR',
    passwordHash: 'Operator@123',
    isActive: true,
    createdAt: '2024-02-10T10:00:00.000Z',
  },
  {
    id: 'usr_an_001',
    username: 'analyst',
    fullName: 'Priya Sharma',
    phone: '+91 98888 11223',
    organization: 'Smart City Analytics',
    employeeId: 'SCA-ANL-001',
    role: 'ANALYST',
    passwordHash: 'Analyst@123',
    isActive: true,
    createdAt: '2024-03-05T08:30:00.000Z',
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────
function loadUsers(): User[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as User[];
  } catch { /* ignore */ }
  // Seed defaults
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
  return DEFAULT_USERS;
}

function saveUsers(users: User[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

// ── Password Validator ───────────────────────────────────────────────────────
export function validatePassword(pw: string): PasswordValidation {
  const minLength = pw.length >= 8;
  const hasUppercase = /[A-Z]/.test(pw);
  const hasNumber = /[0-9]/.test(pw);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw);
  return {
    minLength,
    hasUppercase,
    hasNumber,
    hasSpecial,
    isValid: minLength && hasUppercase && hasNumber && hasSpecial,
  };
}

// ── Auth API ─────────────────────────────────────────────────────────────────
export const authStore = {
  // Returns logged-in user or null
  getCurrentUser(): User | null {
    try {
      const id = sessionStorage.getItem(SESSION_KEY);
      if (!id) return null;
      const users = loadUsers();
      return users.find(u => u.id === id) ?? null;
    } catch {
      return null;
    }
  },

  login(username: string, password: string): { success: boolean; user?: User; error?: string } {
    const users = loadUsers();
    const user = users.find(
      u => u.username.toLowerCase() === username.toLowerCase() && u.passwordHash === password
    );
    if (!user) return { success: false, error: 'Invalid username or password.' };
    if (!user.isActive) return { success: false, error: 'Account is deactivated. Contact admin.' };
    sessionStorage.setItem(SESSION_KEY, user.id);
    return { success: true, user };
  },

  getJwtToken(): string | null {
    try {
      return sessionStorage.getItem('transitflow_jwt');
    } catch {
      return null;
    }
  },

  async loginAsync(username: string, password: string): Promise<{ success: boolean; user?: User; token?: string; error?: string }> {
    const candidates = [
      '/api/v1/auth/login',
      'http://localhost:8081/api/v1/auth/login',
      'http://localhost:8080/api/v1/auth/login',
    ];

    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          const data = await res.json();
          const role = (data.role?.replace('ROLE_', '') || 'OPERATOR') as UserRole;
          const jwtToken = data.token || data.accessToken || '';
          const loggedUser: User = {
            id: data.id ? String(data.id) : `usr_${username}`,
            username: data.username,
            fullName: data.fullName || username,
            phone: data.phone || '',
            organization: data.organization || 'Traffic Control Authority',
            employeeId: data.employeeId || 'EMP-001',
            role,
            passwordHash: '',
            isActive: true,
            createdAt: new Date().toISOString(),
          };
          if (jwtToken) {
            sessionStorage.setItem('transitflow_jwt', jwtToken);
          }
          sessionStorage.setItem(SESSION_KEY, loggedUser.id);
          const localUsers = loadUsers();
          const existIdx = localUsers.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
          if (existIdx >= 0) {
            localUsers[existIdx] = { ...localUsers[existIdx], ...loggedUser };
          } else {
            localUsers.push(loggedUser);
          }
          saveUsers(localUsers);
          return { success: true, user: loggedUser, token: jwtToken };
        } else if (res.status === 401 || res.status === 403) {
          const errJson = await res.json().catch(() => null);
          return { success: false, error: errJson?.message || 'Invalid username or password.' };
        }
      } catch {
        // Try next candidate endpoint
      }
    }
    // Backend/gateway offline or network error: fall back to local authentication
    return this.login(username, password);
  },

  logout(): void {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem('transitflow_jwt');
  },

  listUsers(): User[] {
    return loadUsers();
  },

  registerUser(data: {
    username: string;
    fullName: string;
    phone: string;
    organization: string;
    employeeId: string;
    role: UserRole;
    password: string;
  }): { success: boolean; error?: string; user?: User } {
    const users = loadUsers();
    if (users.find(u => u.username.toLowerCase() === data.username.toLowerCase())) {
      return { success: false, error: 'Username already exists.' };
    }
    const validation = validatePassword(data.password);
    if (!validation.isValid) {
      return { success: false, error: 'Password does not meet security requirements.' };
    }
    const newUser: User = {
      id: `usr_${Date.now()}`,
      username: data.username,
      fullName: data.fullName,
      phone: data.phone,
      organization: data.organization,
      employeeId: data.employeeId,
      role: data.role,
      passwordHash: data.password,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    saveUsers(users);
    return { success: true, user: newUser };
  },

  updateUser(id: string, data: Partial<Omit<User, 'id' | 'createdAt'>>): { success: boolean; error?: string } {
    const users = loadUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return { success: false, error: 'User not found.' };
    users[idx] = { ...users[idx], ...data };
    saveUsers(users);
    return { success: true };
  },

  deactivateUser(id: string): void {
    const users = loadUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx !== -1) {
      users[idx].isActive = !users[idx].isActive;
      saveUsers(users);
    }
  },

  deleteUser(id: string): void {
    const users = loadUsers().filter(u => u.id !== id);
    saveUsers(users);
  },

  changePassword(userId: string, currentPw: string, newPw: string): { success: boolean; error?: string } {
    const users = loadUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return { success: false, error: 'User not found.' };
    if (user.passwordHash !== currentPw) return { success: false, error: 'Current password is incorrect.' };
    const v = validatePassword(newPw);
    if (!v.isValid) return { success: false, error: 'New password does not meet requirements.' };
    user.passwordHash = newPw;
    saveUsers(users);
    return { success: true };
  },
};
