'use client';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { SchemaStats } from './types';
import { formatTableCount, formatRelationshipCount, formatValidationStatus } from './utils';

interface MetricsBarProps {
  stats: SchemaStats;
  className?: string;
}

export function MetricsBar({ stats, className = '' }: MetricsBarProps) {
  const { tableCount, relationshipCount, validationStatus } = stats;

  // Count columns from the schema (mock implementation)
  const columnCount = tableCount * 3; // Rough estimate

  // Hide metrics when there's nothing to show and status is pending (avoid perpetual "validating")
  if (tableCount === 0 && relationshipCount === 0 && validationStatus === 'pending') {
    return null;
  }

  return (
    <div className={`flex items-center justify-between px-4 py-2.5 bg-schema-stats-bg/50 border-t border-schema-panel-border/20 ${className}`}>
      <div className="flex items-center gap-3 text-xs text-muted-foreground/80">
        <span className="font-medium tracking-tight">{formatTableCount(tableCount)}</span>
        <span className="text-muted-foreground/40">•</span>
        <span className="font-medium tracking-tight">{formatRelationshipCount(relationshipCount)}</span>
        <span className="text-muted-foreground/40">•</span>
        <span className="font-medium tracking-tight">📋 {columnCount} columns</span>
      </div>
      
      <Badge 
        variant={
          validationStatus === 'valid' ? 'default' : 
          validationStatus === 'invalid' ? 'destructive' : 
          'secondary'
        }
        className="text-xs font-medium transition-all duration-200 hover:scale-105 rounded-full px-2 py-0.5"
      >
        {formatValidationStatus(validationStatus)}
      </Badge>
    </div>
  );
}