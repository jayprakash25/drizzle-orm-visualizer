'use client';

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { DrizzleFlowVisualizationProps } from '@/types/drizzle';
import { TableNode } from '@/components/drizzle-flow/TableNode';

// Custom node types
const nodeTypes = {
  table: TableNode,
};

export function DrizzleFlowVisualization({ 
  tables, 
  relationships, 
  className = '' 
}: DrizzleFlowVisualizationProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Track theme changes
  useEffect(() => {
    const checkTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    checkTheme(); // Check initial theme
    
    // Watch for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);
  // Convert parsed tables to React Flow nodes
  const initialNodes: Node[] = useMemo(() => {
    return tables.map((table) => ({
      id: table.id,
      type: 'table',
      position: table.position,
      data: {
        table,
      },
      dragHandle: '.drag-handle',
    }));
  }, [tables]);

  // Convert parsed relationships to React Flow edges
  const initialEdges: Edge[] = useMemo(() => {
    return relationships.map((rel) => ({
      id: rel.id,
      source: rel.source,
      target: rel.target,
      sourceHandle: `${rel.source}-${rel.sourceColumn}`,
      targetHandle: `${rel.target}-${rel.targetColumn}`,
      type: 'smoothstep',
      animated: true,
      style: {
        strokeWidth: 2,
        stroke: '#6366f1',
      },
      markerEnd: {
        type: 'arrowclosed' as const,
        color: '#6366f1',
      },
      label: `${rel.sourceColumn} → ${rel.targetColumn}`,
      labelStyle: {
        fontSize: 12,
        fontWeight: 500,
        fill: '#374151',
      },
      labelBgStyle: {
        fill: '#f9fafb',
        fillOpacity: 0.8,
      },
    }));
  }, [relationships]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Update nodes when tables change
  React.useEffect(() => {
    const newNodes = tables.map((table) => ({
      id: table.id,
      type: 'table',
      position: table.position,
      data: {
        table,
      },
      dragHandle: '.drag-handle',
    }));
    setNodes(newNodes);
  }, [tables, setNodes]);

  // Update edges when relationships change
  React.useEffect(() => {
    const newEdges = relationships.map((rel) => ({
      id: rel.id,
      source: rel.source,
      target: rel.target,
      sourceHandle: `${rel.source}-${rel.sourceColumn}`,
      targetHandle: `${rel.target}-${rel.targetColumn}`,
      type: 'smoothstep',
      animated: true,
      style: {
        strokeWidth: 2,
        stroke: '#6366f1',
      },
      markerEnd: {
        type: 'arrowclosed' as const,
        color: '#6366f1',
      },
      label: `${rel.sourceColumn} → ${rel.targetColumn}`,
      labelStyle: {
        fontSize: 12,
        fontWeight: 500,
        fill: '#374151',
      },
      labelBgStyle: {
        fill: '#f9fafb',
        fillOpacity: 0.8,
      },
    }));
    setEdges(newEdges);
  }, [relationships, setEdges]);

  return (
    <div className={`w-full h-full bg-visualization-bg transition-colors duration-200 ${className}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{
          padding: 0.2,
          includeHiddenNodes: false,
        }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
          style: {
            strokeWidth: 2,
            stroke: '#6366f1',
          },
        }}
        className="transition-colors duration-200"
      >
        <Controls 
          className="bg-card border border-border shadow-lg rounded-lg transition-colors duration-200"
          showZoom={true}
          showFitView={true}
          showInteractive={true}
        />
        <MiniMap 
          className="shadow-lg rounded-lg transition-colors duration-200"
          nodeColor={(node) => {
            if (node.type === 'table') {
              // Use subtle colors with good contrast
              return isDarkMode 
                ? '#8b5cf6' // Soft violet for dark mode
                : '#6366f1'; // Muted indigo for light mode
            }
            return isDarkMode 
              ? '#10b981' // Soft emerald for dark mode
              : '#059669'; // Muted emerald for light mode
          }}
          nodeStrokeColor={isDarkMode ? '#d1d5db' : '#6b7280'}
          nodeStrokeWidth={1.5}
          zoomable
          pannable
        />
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={20} 
          size={1}
          color="hsl(var(--border))"
        />
      </ReactFlow>
    </div>
  );
}
