'use client';

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Database, Layers } from 'lucide-react';
import { ParsedColumn, ParsedTable } from '@/types/drizzle';
import { getColumnTypeColor } from '@/lib/drizzle-utils';

interface TableNodeProps {
  data: { table: ParsedTable };
  selected?: boolean;
}

export function TableNode({ data, selected }: TableNodeProps) {
  const { table } = data;



  return (
    <div 
      className={`bg-card border border-border rounded-lg shadow-lg transition-all duration-200 min-w-[250px] ${
        selected ? 'ring-2 ring-primary shadow-2xl' : 'hover:shadow-xl hover:border-accent-foreground/20'
      }`}
    >
      {/* Table Header */}
      <div className="drag-handle cursor-move bg-muted/50 border-b border-border rounded-t-lg px-3 py-2 transition-colors duration-200">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary transition-colors duration-200" />
          <h3 className="font-semibold text-card-foreground text-sm transition-colors duration-200">{table.name}</h3>
          <div className="ml-auto">
            <span className="text-xs text-muted-foreground transition-colors duration-200">{table.columns.length} columns</span>
          </div>
        </div>
      </div>
      
      {/* Table Columns */}
      <div className="divide-y divide-border transition-colors duration-200">
        {table.columns.map((column: ParsedColumn) => (
          <div 
            key={column.name}
            className="relative flex items-center px-3 py-2 hover:bg-accent/50 transition-colors duration-200"
          >
            {/* Column Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-card-foreground truncate transition-colors duration-200">
                  {column.name}
                </span>
                {/* Text-based indicators */}
                {column.isPrimaryKey && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 font-medium">PK</span>
                )}
                {column.references && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-medium">FK</span>
                )}
                {column.isUnique && !column.isPrimaryKey && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-medium">UQ</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground font-mono transition-colors duration-200">
                  {column.type}
                </span>
                {column.references && (
                  <span className="text-xs text-muted-foreground/80 transition-colors duration-200">
                    → {column.references.table}
                  </span>
                )}
              </div>
            </div>
            
            {/* Column Type Badge */}
            <div className="flex-shrink-0 ml-2">
              <span className={`text-xs px-2 py-1 rounded ${getColumnTypeColor(column.type)} font-mono`}>
                {column.type.split('(')[0]}
              </span>
            </div>
            
            {/* Connection handles */}
            <Handle
              type="source"
              position={Position.Right}
              id={`${table.id}-${column.name}`}
              className="!w-3 !h-3 !bg-blue-500 !border-2 !border-gray-900 !opacity-0 hover:!opacity-100 transition-opacity"
              style={{ 
                right: -6,
                top: '50%',
                transform: 'translateY(-50%)'
              }}
            />
            <Handle
              type="target"
              position={Position.Left}
              id={`${table.id}-${column.name}`}
              className="!w-3 !h-3 !bg-green-500 !border-2 !border-gray-900 !opacity-0 hover:!opacity-100 transition-opacity"
              style={{ 
                left: -6,
                top: '50%',
                transform: 'translateY(-50%)'
              }}
            />
          </div>
        ))}
      </div>
      
      {/* Indexes Section */}
      {table.indexes && table.indexes.length > 0 && (
        <div className="border-t border-border bg-muted/30 rounded-b-lg px-3 py-2 transition-colors duration-200">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-3 w-3 text-muted-foreground transition-colors duration-200" />
            <span className="text-xs font-medium text-muted-foreground transition-colors duration-200">Indexes</span>
          </div>
          <div className="space-y-1">
            {table.indexes.map(index => (
              <div key={index.name} className="flex items-center justify-between">
                <span className="text-xs text-card-foreground font-mono truncate transition-colors duration-200">{index.name}</span>
                <span className={`text-xs px-1 py-0.5 rounded transition-colors duration-200 ${
                  index.isUnique 
                    ? 'bg-purple-100 text-purple-800' 
                    : 'bg-secondary text-secondary-foreground'
                }`}>
                  {index.isUnique ? 'UQ' : 'IDX'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
