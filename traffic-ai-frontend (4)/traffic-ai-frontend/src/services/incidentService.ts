export interface IncidentItem {
  id: string;
  direction: string;
  type: string;
  title: string;
  description: string;
  lane?: number;
  capacityImpact: number;
  durationSeconds?: number;
  status: 'ACTIVE' | 'CLEARED' | 'EXPIRED';
  active: boolean;
  createdAt?: string;
}

export interface EmergencyOverrideState {
  active: boolean;
  direction: string | null;
  durationSeconds: number;
  remainingSeconds: number;
}

export interface IncidentStatusResponse {
  message: string;
  timestamp: string;
  totalActive: number;
  activeIncidents: IncidentItem[];
  emergencyOverride: EmergencyOverrideState;
  blockedApproaches: string[];
}

const PRIMARY_URL = (import.meta as any).env?.VITE_INCIDENT_API_URL || (import.meta as any).env?.VITE_GATEWAY_URL || 'http://localhost:8080';
const DIRECT_URL = 'http://localhost:8084';

async function fetchWithFallback(path: string, options?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(path, { ...options, signal: AbortSignal.timeout(2500) });
    if (res.ok) return res;
  } catch {}
  try {
    const res = await fetch(`${PRIMARY_URL}${path}`, { ...options, signal: AbortSignal.timeout(2500) });
    if (res.ok) return res;
  } catch {}
  return fetch(`${DIRECT_URL}${path}`, { ...options, signal: AbortSignal.timeout(2500) });
}

export const incidentApi = {
  baseUrl: PRIMARY_URL,

  async getStatus(): Promise<IncidentStatusResponse | null> {
    try {
      const res = await fetchWithFallback('/api/incidents');
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async toggleIncident(direction: string, type: string = 'COLLISION', description?: string): Promise<IncidentStatusResponse | null> {
    try {
      const res = await fetchWithFallback('/api/incidents/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction, type, description })
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async dispatchAmbulance(direction: string = 'NORTH', duration: number = 30): Promise<IncidentStatusResponse | null> {
    try {
      const res = await fetchWithFallback('/api/incidents/ambulance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dir: direction,
          direction,
          targetArm: direction,
          duration,
          durationSeconds: duration,
          priorityDurationSeconds: duration
        })
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async createIncident(req: {
    direction: string;
    type: string;
    title: string;
    description: string;
    lane?: number;
    capacityImpact?: number;
    durationSeconds?: number;
  }): Promise<IncidentStatusResponse | null> {
    try {
      const res = await fetchWithFallback('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req)
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async clearIncident(id: string): Promise<IncidentStatusResponse | null> {
    try {
      const res = await fetchWithFallback(`/api/incidents/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async clearEmergency(): Promise<IncidentStatusResponse | null> {
    try {
      const res = await fetchWithFallback('/api/incidents/emergency', {
        method: 'DELETE'
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetchWithFallback('/actuator/health');
      return res.ok;
    } catch {
      return false;
    }
  }
};
