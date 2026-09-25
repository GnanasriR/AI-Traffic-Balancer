import { useState, useEffect } from 'react';
import type { Snapshot } from '../types/signalsync';
import { signalSyncEngine } from '../services/signalsyncEngine';
import { trafficWsClient, type ConnectionStatus } from '../services/websocketClient';

export function useSignalSync(): {
  snapshot: Snapshot | null;
  history: typeof signalSyncEngine.history;
  command: (type: string, payload?: any) => void;
  connectionStatus: ConnectionStatus;
  endpoint: string;
} {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(signalSyncEngine.snapshot);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(trafficWsClient.currentStatus);

  useEffect(() => {
    const unsubscribeSnap = signalSyncEngine.subscribe((snap) => {
      setSnapshot({ ...snap });
    });
    const unsubscribeStatus = trafficWsClient.onStatusChange((status) => {
      setConnectionStatus(status);
    });
    return () => {
      unsubscribeSnap();
      unsubscribeStatus();
    };
  }, []);

  return {
    snapshot,
    history: signalSyncEngine.history,
    command: (type, payload) => signalSyncEngine.command(type, payload),
    connectionStatus,
    endpoint: trafficWsClient.currentEndpoint,
  };
}
