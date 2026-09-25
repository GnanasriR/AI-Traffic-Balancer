export interface PredictionItem {
  approach: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' | string;
  currentQueue: number;
  predictedQueue15Min: number;
  predictedQueue30Min: number;
  congestionSeverityIndex: number; // 0.0 to 1.0 (CSI)
  trendDirection: 'UPWARD_SURGE' | 'DECAYING' | 'STABLE' | string;
  estimatedSpillbackMinutes: number;
  recommendation: string;
}

const PRIMARY_URL = (import.meta as any).env?.VITE_GATEWAY_URL || 'http://localhost:8080';
const DIRECT_URL = 'http://localhost:8082';

async function fetchWithFallback(path: string, options?: RequestInit): Promise<Response> {
  // 1. Try same-origin via Vite proxy (avoids all browser CORS)
  try {
    const res = await fetch(path, { ...options, signal: AbortSignal.timeout(2000) });
    if (res.ok) return res;
  } catch {}

  // 2. Try API Gateway
  try {
    const res = await fetch(`${PRIMARY_URL}${path}`, { ...options, signal: AbortSignal.timeout(2000) });
    if (res.ok) return res;
  } catch {}

  // 3. Fallback to direct service URL
  return fetch(`${DIRECT_URL}${path}`, { ...options, signal: AbortSignal.timeout(2000) });
}

export const predictionApi = {
  async getLivePredictions(): Promise<PredictionItem[] | null> {
    try {
      const res = await fetchWithFallback('/api/optimizer/prediction/live');
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetchWithFallback('/api/optimizer/prediction/live');
      return res.ok;
    } catch {
      return false;
    }
  },
};
