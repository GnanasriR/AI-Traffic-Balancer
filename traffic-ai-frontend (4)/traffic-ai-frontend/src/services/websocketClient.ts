export type ConnectionStatus = 'PYTHON_CONNECTED' | 'CONNECTED' | 'CONNECTING' | 'PYTHON_OFFLINE' | 'DISCONNECTED';

export interface TrafficUpdateMessage {
  type: 'METRICS_UPDATE' | 'SIGNAL_CHANGE' | 'AI_RECOMMENDATION' | 'INCIDENT_ALERT';
  timestamp?: string | number;
  data: any;
}

export class TrafficWebSocketClient {
  public primaryUrl: string = (import.meta as any).env?.VITE_TRAFFIC_WS_URL || 'ws://localhost:8000/ws/traffic';
  public fallbackUrl: string = 'ws://localhost:8080/ws/traffic';
  public connectedUrl: string = (import.meta as any).env?.VITE_TRAFFIC_WS_URL || 'ws://localhost:8000/ws/traffic';
  private ws: WebSocket | null = null;
  private reconnectInterval = 2500;
  private reconnectTimer: any = null;
  private statusListeners: ((status: ConnectionStatus) => void)[] = [];
  private messageListeners: ((msg: TrafficUpdateMessage) => void)[] = [];
  public currentStatus: ConnectionStatus = 'PYTHON_OFFLINE';
  private hasReceivedInitialSnapshot = false;

  public get currentEndpoint(): string {
    return this.connectedUrl;
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.updateStatus('CONNECTING');
      console.log(`[WS] Connecting to authoritative Python Traffic Backend: ${this.connectedUrl}...`);
      this.ws = new WebSocket(this.connectedUrl);

      this.ws.onopen = () => {
        console.log(`[WS] WebSocket transport connected to ${this.connectedUrl}. Awaiting authoritative Python snapshot...`);
        // We remain in CONNECTING until a valid Python snapshot is verified
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const payload: TrafficUpdateMessage = JSON.parse(event.data);
          if (payload.type === 'METRICS_UPDATE' && payload.data) {
            if (!this.hasReceivedInitialSnapshot) {
              this.hasReceivedInitialSnapshot = true;
              console.log(`[WS] Verified Python backend stream active. Status: PYTHON_CONNECTED`);
              this.updateStatus('PYTHON_CONNECTED');
            }
            const d = payload.data;
            console.log(
              `[PYTHON SNAPSHOT] seq=${d.seq ?? '?'} active=${d.phase?.activeArm ?? 'None'} state=${d.phase?.state ?? '?'} rem=${d.phase?.remaining ?? '?'}s veh=${d.vehicles?.length ?? 0} amb=${d.vehicles?.filter((v: any) => v.isAmbulance)?.length ?? 0}`
            );
          } else {
            console.log('[COMMAND ← PYTHON]', payload);
          }
          this.messageListeners.forEach((listener) => listener(payload));
        } catch (e) {
          console.error('[WS ERROR] Error parsing Python traffic message:', e);
        }
      };

      this.ws.onerror = (err) => {
        console.warn(`[WS ERROR] WebSocket connection error on ${this.connectedUrl}:`, err);
        if (this.ws) {
          try { this.ws.close(); } catch {}
          this.ws = null;
        }
        this.hasReceivedInitialSnapshot = false;
        this.updateStatus('PYTHON_OFFLINE');
      };

      this.ws.onclose = () => {
        console.log(`[WS] WebSocket connection closed on ${this.connectedUrl}. Backend status: PYTHON_OFFLINE`);
        this.ws = null;
        this.hasReceivedInitialSnapshot = false;
        this.updateStatus('PYTHON_OFFLINE');
        this.scheduleReconnect();
      };
    } catch (err) {
      console.error(`[WS ERROR] Failed to instantiate WebSocket:`, err);
      this.ws = null;
      this.hasReceivedInitialSnapshot = false;
      this.updateStatus('PYTHON_OFFLINE');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        // Alternate between Gateway (8080) and Direct Python (8000) for high resilience
        this.connectedUrl = (this.connectedUrl === this.primaryUrl) ? this.fallbackUrl : this.primaryUrl;
        console.log(`[WS] Reconnecting to traffic stream (${this.connectedUrl})...`);
        this.connect();
      }, this.reconnectInterval);
    }
  }

  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.hasReceivedInitialSnapshot = false;
    this.updateStatus('PYTHON_OFFLINE');
  }

  public send(msg: any) {
    console.log('[COMMAND → PYTHON]', msg);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg));
      } catch (err) {
        console.warn('[WS ERROR] Failed sending command to Python backend:', err);
      }
    } else {
      console.warn(`[WS WARNING] Cannot send command: Python backend is offline (${this.currentStatus}). Command queued/dropped:`, msg);
    }
  }

  public onStatusChange(callback: (status: ConnectionStatus) => void) {
    this.statusListeners.push(callback);
    callback(this.currentStatus);
    return () => {
      this.statusListeners = this.statusListeners.filter((cb) => cb !== callback);
    };
  }

  public onMessage(callback: (msg: TrafficUpdateMessage) => void) {
    this.messageListeners.push(callback);
    return () => {
      this.messageListeners = this.messageListeners.filter((cb) => cb !== callback);
    };
  }

  private updateStatus(newStatus: ConnectionStatus) {
    this.currentStatus = newStatus;
    this.statusListeners.forEach((cb) => cb(newStatus));
  }
}

export const trafficWsClient = new TrafficWebSocketClient();
