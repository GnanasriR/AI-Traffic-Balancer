export interface AnalyticsSummary {
  delayReductionPercentage: number;
  averageWaitTimeSeconds: number;
  totalClearedVehicles: number;
  completedCycles: number;
  controlMode: string;
  approachSavings: Record<string, number>;
}

export interface ApproachPerformance {
  code: string;
  name: string;
  currentQueue: number;
  averageWaitTime: number;
  vehiclesCleared: number;
  congestionScore: number | null;
  anomalyDetected: boolean;
}

export interface TrafficSession {
  sessionId: string;
  junctionId: string;
  controlMode: string;
  status: string;
  totalClearedVehicles: number;
  completedCycles: number;
  avgWaitTimeSeconds: number;
  delayReductionPercentage: number;
  startTime: string;
  endTime?: string;
}

const PRIMARY_URL = (import.meta as any).env?.VITE_ANALYTICS_API_URL || (import.meta as any).env?.VITE_GATEWAY_URL || 'http://localhost:8080';
const DIRECT_URL = 'http://localhost:8085';

async function fetchWithFallback(path: string, options?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(path, { ...options, signal: AbortSignal.timeout(2000) });
    if (res.ok) return res;
  } catch {}
  try {
    const res = await fetch(`${PRIMARY_URL}${path}`, { ...options, signal: AbortSignal.timeout(2000) });
    if (res.ok) return res;
  } catch {}
  return fetch(`${DIRECT_URL}${path}`, { ...options, signal: AbortSignal.timeout(2000) });
}

export const analyticsApi = {
  baseUrl: PRIMARY_URL,

  async getMetrics(sessionId?: string): Promise<AnalyticsSummary | null> {
    try {
      const q = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
      const res = await fetchWithFallback(`/api/analytics/metrics${q}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async getApproachPerformance(sessionId?: string): Promise<ApproachPerformance[] | null> {
    try {
      const q = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
      const res = await fetchWithFallback(`/api/analytics/approaches${q}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async getAllSessions(): Promise<TrafficSession[]> {
    try {
      const res = await fetchWithFallback('/api/analytics/sessions');
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  },

  getExportUrl(format: 'csv' | 'json', sessionId?: string): string {
    const q = new URLSearchParams({ format });
    if (sessionId) q.set('sessionId', sessionId);
    return `${PRIMARY_URL}/api/analytics/export?${q.toString()}`;
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
