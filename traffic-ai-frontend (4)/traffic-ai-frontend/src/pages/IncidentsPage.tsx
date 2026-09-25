import React, { useState, useEffect } from 'react';
import { useSignalSync } from '../hooks/useSignalSync';
import { IcoAlert, IcoCone, IcoBus, IcoCheck } from '../components/Icons';
import { DIRS, DIRNAME } from '../services/signalsyncEngine';
import { incidentApi, type IncidentStatusResponse } from '../services/incidentService';
import type { PageId } from '../components/Shell';

interface IncidentsPageProps {
  onNavigate: (page: PageId) => void;
}

export const IncidentsPage: React.FC<IncidentsPageProps> = ({ onNavigate }) => {
  const { snapshot, command } = useSignalSync();
  const s = snapshot;
  const [toastMsg, setToastMsg] = useState('');
  const [acknowledgedMap, setAcknowledgedMap] = useState<Record<string, boolean>>({});
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false);
  const [backendStatus, setBackendStatus] = useState<IncidentStatusResponse | null>(null);
  const [actionDir, setActionDir] = useState<'N' | 'S' | 'E' | 'W'>('N');
  const [actionType, setActionType] = useState<string>('COLLISION');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  useEffect(() => {
    let mounted = true;
    const pollIncidents = async () => {
      try {
        const healthy = await incidentApi.isHealthy();
        if (!mounted) return;
        setIsBackendOnline(healthy);

        if (healthy) {
          const status = await incidentApi.getStatus();
          if (mounted) setBackendStatus(status);
        }
      } catch {
        if (mounted) setIsBackendOnline(false);
      }
    };

    pollIncidents();
    const interval = setInterval(pollIncidents, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleAcknowledge = (id: string, title: string) => {
    setAcknowledgedMap((prev) => ({ ...prev, [id]: true }));
    showToast(`Acknowledged: ${title}`);
  };

  const handleViewOnMap = (target: 'junction' | 'corridor', label: string, incidentId?: string) => {
    if (incidentId === 'inc-collision' && !s?.incident?.active) {
      command('toggle_incident', { dir: 'N' });
    }
    showToast(`Opening ${label} & locating incident zone...`);
    setTimeout(() => onNavigate(target), 300);
  };

  // Check active anomalies across approaches
  const activeAnomalies = DIRS.filter((d) => s?.approaches[d]?.anomaly).map((d) => ({
    id: `anomaly-${d}`,
    type: 'r',
    isAuto: true,
    mapTarget: 'junction' as const,
    mapLabel: `J1 Gandhipuram (${DIRNAME[d]} Arm)`,
    icon: <IcoAlert />,
    title: `[AUTO-DETECTED ANOMALY] Unusual congestion spike on ${DIRNAME[d]} approach`,
    body: `${s?.approaches[d]?.anomalyReason || 'Queue and density deviated significantly from rolling baseline.'} Automatic split adjustment initiated.`,
    state: 'Active Anomaly',
    when: 'Just now',
  }));

  // Live incident from simulation
  const liveSimIncident = s?.incident?.active ? [{
    id: `sim-incident-${s.incident.dir}`,
    type: 'r',
    isAuto: false,
    mapTarget: 'junction' as const,
    mapLabel: `Junction Simulation (J1 ${DIRNAME[s.incident.dir]} Arm)`,
    icon: <IcoAlert />,
    title: s.incident.title || `Collision reported on ${DIRNAME[s.incident.dir]} approach`,
    body: s.incident.description || `Lane ${s.incident.lane + 1} blocked; signal controller switched to incident mitigation timing.`,
    state: 'Active Collision',
    when: 'Live Simulation',
  }] : [];

  // Live emergency preemption from simulation
  const liveEmergency = s?.emergency?.active ? [{
    id: `sim-emergency-${s.emergency.dir || 'unit'}`,
    type: 'r',
    isAuto: false,
    mapTarget: 'junction' as const,
    mapLabel: `Junction Simulation (J1 ${DIRNAME[s.emergency.dir || 'S']} Arm)`,
    icon: <IcoBus />,
    title: `Ambulance EVP Active on ${DIRNAME[s.emergency.dir || 'S']} approach`,
    body: `Emergency preemption active — ${s.emergency.remaining ? s.emergency.remaining.toFixed(0) : '0'}s remaining green corridor.`,
    state: 'Active EVP',
    when: 'Live Simulation',
  }] : [];

  // Recent historical incident events from simulation event log
  const recentEventIncidents = (s?.events || [])
    .filter((e) => e.kind === 'incident' || e.kind === 'emergency')
    .slice(0, 4)
    .map((e, idx) => ({
      id: `evt-${idx}-${e.ts}`,
      type: e.kind === 'emergency' ? 'r' : 'a',
      isAuto: false,
      mapTarget: 'junction' as const,
      mapLabel: 'J1 Gandhipuram',
      icon: e.kind === 'emergency' ? <IcoBus /> : <IcoCone />,
      title: e.text,
      body: `Log timestamp: ${new Date(e.ts).toLocaleTimeString()}`,
      state: 'Logged Event',
      when: new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));

  const handleToggleIncident = async (dir: 'N' | 'S' | 'E' | 'W') => {
    command('toggle_incident', { dir });
    if (isBackendOnline) {
      const res = await incidentApi.toggleIncident(dir, actionType, `${actionType} reported on ${DIRNAME[dir]} approach`);
      if (res) setBackendStatus(res);
      showToast(`Incident state toggled on ${DIRNAME[dir]} approach (Incident Service sync)`);
    } else {
      showToast(`Incident state toggled on ${DIRNAME[dir]} approach`);
    }
  };

  const handleDispatchAmbulance = async (dir: 'N' | 'S' | 'E' | 'W') => {
    command('dispatch_ambulance', { dir });
    if (isBackendOnline) {
      const res = await incidentApi.dispatchAmbulance(dir, 32);
      if (res) setBackendStatus(res);
      showToast(`Ambulance deployed on ${DIRNAME[dir]} corridor (Incident Service sync)`);
    } else {
      showToast(`Ambulance deployed on ${DIRNAME[dir]} corridor`);
    }
  };

  const handleClearBackendIncident = async (id: string) => {
    if (isBackendOnline) {
      const res = await incidentApi.clearIncident(id);
      if (res) setBackendStatus(res);
      showToast(`Cleared incident ${id} in Incident Service`);
    }
  };

  const allIncidents = [
    ...liveEmergency,
    ...liveSimIncident,
    ...(backendStatus?.activeIncidents || []).map((b) => ({
      id: b.id,
      type: 'r',
      isAuto: false,
      isBackend: true,
      mapTarget: 'junction' as const,
      mapLabel: `J1 Gandhipuram (${b.direction} Arm)`,
      icon: <IcoAlert />,
      title: b.title || `[INCIDENT] ${b.type} on ${b.direction}`,
      body: b.description || `Impact capacity: ${(b.capacityImpact * 100).toFixed(0)}%`,
      state: b.status,
      when: 'Live DB Record',
    })),
    ...activeAnomalies,
    ...recentEventIncidents,
  ];

  const hasActiveIncidents = liveSimIncident.length > 0 || liveEmergency.length > 0 || (backendStatus?.activeIncidents?.length ?? 0) > 0 || activeAnomalies.length > 0;

  const deptResponses = [
    { name: 'Traffic police', status: hasActiveIncidents ? 'Active Dispatch' : 'Monitoring', tag: hasActiveIncidents ? 'r' : 'g' },
    { name: 'Emergency Medical', status: s?.emergency?.active ? 'Corridor Preemption' : 'Standby', tag: s?.emergency?.active ? 'r' : 'g' },
    { name: 'Roads maintenance', status: s?.incident?.active ? 'Crews Deployed' : 'Standby', tag: s?.incident?.active ? 'a' : 'g' },
    { name: 'Corridor operator', status: 'Online (Continuous)', tag: 'b' },
    { name: 'Public alert feed', status: hasActiveIncidents ? 'Hazard Alert Live' : 'All Clear', tag: hasActiveIncidents ? 'a' : 'g' },
  ];

  return (
    <>
      {toastMsg && <div className="toast">{toastMsg}</div>}

      <div className="between" style={{ flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h3 style={{ fontSize: '21px', margin: 0 }}>Incidents & Anomaly Monitoring</h3>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '12px',
                background: isBackendOnline ? '#dcfce7' : '#fef3c7',
                color: isBackendOnline ? '#166534' : '#92400e',
                border: isBackendOnline ? '1px solid #bbf7d0' : '1px solid #fde68a',
              }}
            >
              {isBackendOnline ? '● Incident Service Online (Port 8084)' : '○ Simulation Feed Direct'}
            </span>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            {isBackendOnline
              ? `Real-time preemption & hazard management connected via Spring Boot Incident Service.`
              : `Corridor disruption events & automated AI anomaly monitoring streaming from simulation.`}
          </p>
        </div>

        {/* Hazard & Emergency Action Controls */}
        <div className="row" style={{ gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={actionDir}
            onChange={(e) => setActionDir(e.target.value as any)}
            style={{
              fontSize: '12px',
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--line-2, #e2e8f0)',
              background: 'white',
              fontWeight: 600,
            }}
          >
            <option value="N">North Approach</option>
            <option value="S">South Approach</option>
            <option value="E">East Approach</option>
            <option value="W">West Approach</option>
          </select>

          <select
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
            style={{
              fontSize: '12px',
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--line-2, #e2e8f0)',
              background: 'white',
            }}
          >
            <option value="COLLISION">Collision</option>
            <option value="ROADWORK">Roadwork</option>
            <option value="VEHICLE_BREAKDOWN">Breakdown</option>
            <option value="HAZARD">Hazard</option>
          </select>

          <button
            className="btn small"
            onClick={() => handleToggleIncident(actionDir)}
            title="Toggle lane closure/hazard on approach"
          >
            Toggle Hazard
          </button>

          <button
            className="btn small"
            style={{
              background: '#dc2626',
              color: 'white',
              borderColor: '#b91c1c',
              fontWeight: 700,
            }}
            onClick={() => handleDispatchAmbulance(actionDir)}
            title="Dispatch emergency medical preemption corridor"
          >
            🚑 Dispatch Ambulance
          </button>
        </div>
      </div>

      <div className="two">
        <div className="card">
          <div className="panelhead">
            <h3>Open and recent</h3>
            <span className="muted">{allIncidents.length} items ({activeAnomalies.length} auto-detected)</span>
          </div>
          {allIncidents.length === 0 ? (
            <div className="pad muted" style={{ textAlign: 'center', padding: '36px 16px' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>🟢</div>
              <strong style={{ fontSize: '15px', color: 'var(--ink)' }}>All 4 Approaches Clear</strong>
              <p style={{ fontSize: '12.5px', marginTop: '4px' }}>
                Zero active collisions, lane blockages, or emergency preemptions detected. The corridor is operating under normal green wave conditions.
              </p>
            </div>
          ) : (
            allIncidents.map((item) => {
            const isAck = !!acknowledgedMap[item.id];
            return (
              <div
                key={item.id}
                className="incident"
                style={{
                  background: item.isAuto && !isAck ? 'rgba(239, 68, 68, 0.04)' : undefined,
                  transition: 'background 0.2s ease',
                }}
              >
                <span
                  className="ic"
                  style={{
                    background:
                      isAck
                        ? 'var(--green-soft)'
                        : item.type === 'g'
                        ? 'var(--green-soft)'
                        : item.type === 'a'
                        ? 'var(--amber-soft)'
                        : item.type === 'r'
                        ? 'var(--red-soft)'
                        : 'var(--blue-soft)',
                  }}
                >
                  {isAck ? <IcoCheck /> : item.icon}
                </span>
                <div style={{ flex: 1 }}>
                  <div className="between">
                    <strong style={{ fontSize: '14.5px' }}>{item.title}</strong>
                    {isAck ? (
                      <span className="tag g" style={{ fontSize: '11px' }}>
                        <span className="dot" style={{ background: '#10B981' }} />
                        Acknowledged
                      </span>
                    ) : (
                      <span className={`tag ${item.type}`}>
                        {item.isAuto && <span className="dot pulse" style={{ background: '#DC2626' }} />}
                        {item.state}
                      </span>
                    )}
                  </div>
                  <p className="muted" style={{ marginTop: '4px' }}>
                    {item.body}
                  </p>
                  <div className="row" style={{ marginTop: '9px', gap: '8px' }}>
                    <button
                      className="btn ghost small"
                      onClick={() => handleViewOnMap(item.mapTarget, item.mapLabel, item.id)}
                      title={`Navigate to ${item.mapLabel}`}
                    >
                      View on map
                    </button>
                    {(item as any).isBackend ? (
                      <button
                        className="btn small"
                        style={{
                          background: '#fef2f2',
                          color: '#991b1b',
                          borderColor: '#fecaca',
                          fontSize: '11.5px',
                        }}
                        onClick={() => handleClearBackendIncident(item.id)}
                        title="Clear incident from Incident Service"
                      >
                        Clear Hazard
                      </button>
                    ) : isAck ? (
                      <button
                        className="btn small"
                        disabled
                        style={{
                          background: '#E6F3EC',
                          color: '#0B5C3E',
                          borderColor: '#A7F3D0',
                          cursor: 'default',
                          fontSize: '11.5px',
                        }}
                      >
                        Acknowledged
                      </button>
                    ) : (
                      <button
                        className="btn ghost small"
                        onClick={() => handleAcknowledge(item.id, item.title)}
                      >
                        Acknowledge
                      </button>
                    )}
                    <span className="muted" style={{ fontSize: '12px', marginLeft: 'auto' }}>
                      {item.when}
                    </span>
                  </div>
                </div>
              </div>
            );
          }))}
        </div>

        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="card">
            <div className="panelhead">
              <h3>Response</h3>
              <span className="muted">incident 7C2-21</span>
            </div>
            <div className="pad" style={{ paddingTop: '6px' }}>
              {deptResponses.map((d, i) => (
                <div
                  key={i}
                  className="between"
                  style={{ padding: '8px 0', borderBottom: '1px solid var(--line-2)' }}
                >
                  <span className="lbl">{d.name}</span>
                  <span className={`tag ${d.tag}`}>{d.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="panelhead">
              <h3>System log</h3>
            </div>
            <div>
              {(!s?.events || !s.events.length) ? (
                <div className="pad muted">No system log entries yet.</div>
              ) : (
                s.events.slice(0, 8).map((e, idx) => (
                  <div key={idx} className="incident" style={{ padding: '11px 16px' }}>
                    <div style={{ flex: 1 }}>
                      <div className="between">
                        <span
                          style={{
                            fontSize: '13px',
                            color: e.kind === 'emergency' ? '#DC2626' : undefined,
                            fontWeight: e.kind === 'emergency' ? 600 : undefined,
                          }}
                        >
                          {e.text}
                        </span>
                        <span className="muted" style={{ fontSize: '11.5px' }}>
                          {new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
