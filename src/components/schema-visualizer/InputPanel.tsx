'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { CodeEditor } from './CodeEditor';
import { MetricsBar } from './MetricsBar';
import { PanelState, SchemaStats as SchemaStatsType } from './types';

interface InputPanelProps {
  schema: string;
  onSchemaChange: (schema: string) => void;
  stats: SchemaStatsType;
  panelState: PanelState;
  onPanelStateChange: (state: PanelState) => void;
  className?: string;
}

export function InputPanel({ 
  schema, 
  onSchemaChange, 
  stats, 
  panelState, 
  onPanelStateChange,
  className = ''
}: InputPanelProps) {
  const [localSchema, setLocalSchema] = useState(schema);

  // Keep local editor value in sync with upstream schema (e.g., loaded from localStorage)
  useEffect(() => {
    setLocalSchema(schema);
  }, [schema]);

  const handleSchemaChange = useCallback((value: string) => {
    setLocalSchema(value);
    onSchemaChange(value);
  }, [onSchemaChange]);


  if (panelState === PanelState.HIDDEN) {
    return null;
  }

  return (
    <div 
      className={`flex flex-col h-full bg-schema-panel-bg transition-all duration-300 ease-out transform-gpu ${className}`}
      style={{
        willChange: 'transform, opacity',
      }}
    >
      {/* Minimal header - no border, clean spacing */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-foreground tracking-tight">Schema Editor</h2>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPanelStateChange(PanelState.HIDDEN)}
            className="h-7 w-7 p-0 hover:bg-accent/50 transition-all duration-200 ease-out hover:scale-110 active:scale-95 rounded-md transform-gpu lg:block hidden"
            title="Hide panel"
          >
            <X className="h-3.5 w-3.5 transition-all duration-200 ease-out hover:rotate-90" />
          </Button>
        </div>
      </div>

      {/* Code editor area - seamless, minimal design */}
      <div className="flex-1 flex flex-col min-h-0 transition-all duration-300 ease-out opacity-100 animate-in fade-in slide-in-from-top-2">
        <div className="flex-1 bg-schema-code-bg border-t border-schema-panel-border/30 overflow-hidden">
          <CodeEditor
            value={localSchema}
            onChange={handleSchemaChange}
            placeholder="// Paste your Drizzle schema here...
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 256 }),
  email: varchar('email').unique(),
});"
            className="h-full transition-opacity duration-300 ease-out"
          />
        </div>

        {/* Clean metrics bar */}
        <div className="animate-in slide-in-from-bottom-2 duration-300 ease-out">
          <MetricsBar stats={stats} />
        </div>
      </div>
    </div>
  );
}