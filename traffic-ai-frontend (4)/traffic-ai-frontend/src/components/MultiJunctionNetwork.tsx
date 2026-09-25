import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  Handle,
  Position
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { JunctionNode } from '../types/traffic';
import { Network, Waves } from 'lucide-react';

interface MultiJunctionNetworkProps {
  junctions: JunctionNode[];
  selectedJunctionId: string;
  onSelectJunction: (id: string) => void;
}

// Custom Junction Node component for React Flow (Clean Enterprise Theme)
const CustomJunctionNode = ({ data }: { data: any }) => {
  const isSelected = data.isSelected;
  const isGreenNS = data.activeGreenDirection === 'NORTH_SOUTH';

  return (
    <div
      className={`min-w-[155px] p-3 rounded-xl transition-all cursor-pointer shadow-md ${
        isSelected
          ? 'bg-blue-50/90 border-2 border-blue-600 shadow-lg ring-2 ring-blue-400/20'
          : 'bg-white border border-slate-200 hover:border-slate-300'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-2 !h-2" id="top" />
      <Handle type="source" position={Position.Top} className="!bg-blue-500 !w-2 !h-2" id="top-src" />
      <Handle type="target" position={Position.Bottom} className="!bg-blue-500 !w-2 !h-2" id="bottom" />
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-2 !h-2" id="bottom-src" />
      <Handle type="target" position={Position.Left} className="!bg-blue-500 !w-2 !h-2" id="left" />
      <Handle type="source" position={Position.Left} className="!bg-blue-500 !w-2 !h-2" id="left-src" />
      <Handle type="target" position={Position.Right} className="!bg-blue-500 !w-2 !h-2" id="right" />
      <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-2 !h-2" id="right-src" />

      {/* Node Header */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-bold text-xs text-slate-900 flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{data.name}</span>
        </span>
        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-blue-700 border border-slate-200">
          {data.currentPhaseTimer}s
        </span>
      </div>

      {/* Phase Status */}
      <div className="flex items-center justify-between text-[11px] mb-2 font-medium">
        <span className="text-slate-500">Green Axis:</span>
        <span className="font-mono font-bold text-emerald-700">
          {isGreenNS ? 'N / S' : 'E / W'}
        </span>
      </div>

      {/* Congestion Gauge */}
      <div>
        <div className="flex justify-between text-[10px] text-slate-500 mb-0.5 font-medium">
          <span>Congestion</span>
          <span className="font-mono font-bold text-slate-800">{Math.round(data.congestionScore)}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              data.congestionScore > 65
                ? 'bg-red-500'
                : data.congestionScore > 40
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${data.congestionScore}%` }}
          />
        </div>
      </div>
    </div>
  );
};

const nodeTypes = {
  junction: CustomJunctionNode,
};

export const MultiJunctionNetwork: React.FC<MultiJunctionNetworkProps> = ({
  junctions,
  selectedJunctionId,
  onSelectJunction
}) => {
  // Map Junction data to React Flow Nodes
  const nodes: Node[] = useMemo(() => {
    return [
      {
        id: 'J2',
        type: 'junction',
        position: { x: 260, y: 30 },
        data: {
          ...junctions.find(j => j.id === 'J2'),
          isSelected: selectedJunctionId === 'J2',
        },
      },
      {
        id: 'J1',
        type: 'junction',
        position: { x: 40, y: 190 },
        data: {
          ...junctions.find(j => j.id === 'J1'),
          isSelected: selectedJunctionId === 'J1',
        },
      },
      {
        id: 'J3',
        type: 'junction',
        position: { x: 260, y: 190 },
        data: {
          ...junctions.find(j => j.id === 'J3'),
          isSelected: selectedJunctionId === 'J3',
        },
      },
      {
        id: 'J4',
        type: 'junction',
        position: { x: 480, y: 190 },
        data: {
          ...junctions.find(j => j.id === 'J4'),
          isSelected: selectedJunctionId === 'J4',
        },
      },
    ];
  }, [junctions, selectedJunctionId]);

  // Edges connecting the network with green wave animated flow
  const edges: Edge[] = useMemo(() => {
    return [
      {
        id: 'e-j1-j3',
        source: 'J1',
        target: 'J3',
        sourceHandle: 'right-src',
        targetHandle: 'left',
        animated: true,
        label: '400m • 25s Green Wave',
        labelStyle: { fill: '#0f172a', fontSize: 10, fontFamily: 'monospace', fontWeight: 700 },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.95, rx: 6, ry: 6, stroke: '#e2e8f0', strokeWidth: 1 },
        labelBgPadding: [6, 4] as [number, number],
        style: { stroke: '#16a34a', strokeWidth: 3 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#16a34a' },
      },
      {
        id: 'e-j2-j3',
        source: 'J2',
        target: 'J3',
        sourceHandle: 'bottom-src',
        targetHandle: 'top',
        animated: true,
        label: '350m • 22s Wave',
        labelStyle: { fill: '#0f172a', fontSize: 10, fontFamily: 'monospace', fontWeight: 700 },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.95, rx: 6, ry: 6, stroke: '#e2e8f0', strokeWidth: 1 },
        labelBgPadding: [6, 4] as [number, number],
        style: { stroke: '#16a34a', strokeWidth: 3 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#16a34a' },
      },
      {
        id: 'e-j3-j4',
        source: 'J3',
        target: 'J4',
        sourceHandle: 'right-src',
        targetHandle: 'left',
        animated: true,
        label: '450m • 28s Wave',
        labelStyle: { fill: '#0f172a', fontSize: 10, fontFamily: 'monospace', fontWeight: 700 },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.95, rx: 6, ry: 6, stroke: '#e2e8f0', strokeWidth: 1 },
        labelBgPadding: [6, 4] as [number, number],
        style: { stroke: '#16a34a', strokeWidth: 3 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#16a34a' },
      },
    ];
  }, []);

  return (
    <div className="enterprise-card p-4">
      {/* Network Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shadow-xs">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight text-slate-900 uppercase flex items-center space-x-2">
              <span>Multi-Junction Network (Grid Coordination)</span>
              <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center space-x-1">
                <Waves className="w-3 h-3 text-emerald-600" />
                <span>GREEN WAVE SYNCHRONIZED</span>
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Coordinated signal offsets prevent queue spillover across J1 → J3 → J4
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-500 font-mono">
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Offset Active</span>
          </span>
          <span>•</span>
          <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
            4 Interconnected Intersections
          </span>
        </div>
      </div>

      {/* React Flow Container */}
      <div className="h-[320px] w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-50/80 relative shadow-inner">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => onSelectJunction(node.id)}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          attributionPosition="bottom-right"
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#cbd5e1" gap={16} size={1.5} />
          <Controls className="!bg-white !border-slate-200 !fill-slate-700 !shadow-sm" />
        </ReactFlow>

        {/* Legend Overlay */}
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md p-2.5 rounded-xl border border-slate-200 text-[11px] space-y-1 font-medium shadow-md">
          <div className="flex items-center space-x-2 text-slate-800">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Green Wave Coordination: J1 -&gt; J3 -&gt; J4</span>
          </div>
          <div className="text-slate-500 text-[10px]">
            Click node to focus deep-dive inspection
          </div>
        </div>
      </div>
    </div>
  );
};
