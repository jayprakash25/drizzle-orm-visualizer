'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { Button } from '@/components/ui/button';
import { PanelLeftOpen, VectorSquare, Code } from 'lucide-react';
import { InputPanel } from '@/components/schema-visualizer/InputPanel';
import { DrizzleFlowVisualization } from './DrizzleFlowVisualization';
import { ThemeToggle } from '@/components/schema-visualizer/ThemeToggle';
import { parseDrizzleSchema } from '@/lib/drizzle-parser';
import { parsePrismaSchema } from '@/lib/prisma-parser';
import { PanelState, SchemaValidationStatus } from '@/components/schema-visualizer/types';
import type { SchemaStats } from '@/components/schema-visualizer/types';
import { OrmType } from '@/types/drizzle';

interface DrizzleFlowAppProps {
  className?: string;
}

export function DrizzleFlowApp({ className = '' }: DrizzleFlowAppProps) {
  const [schema, setSchema] = useState('');
  const [ormType, setOrmType] = useState<OrmType>('drizzle');
  const [panelState, setPanelState] = useState<PanelState>(PanelState.EXPANDED);
  const [isAnimating, setIsAnimating] = useState(false);
  const panelRef = useRef<ImperativePanelHandle>(null);

  const SCHEMA_STORAGE_KEY = 'drizzle-schema-editor';
  const ORM_TYPE_STORAGE_KEY = 'orm-type-preference';
  const PANEL_STATE_STORAGE_KEY = 'drizzle-panel-state';

  // Load from localStorage
  useEffect(() => {
    try {
      const savedSchema = localStorage.getItem(SCHEMA_STORAGE_KEY);
      const savedOrmType = localStorage.getItem(ORM_TYPE_STORAGE_KEY) as OrmType | null;
      const savedPanelState = localStorage.getItem(PANEL_STATE_STORAGE_KEY) as PanelState | null;
      if (savedSchema) setSchema(savedSchema);
      if (savedOrmType && ['drizzle', 'prisma'].includes(savedOrmType)) {
        setOrmType(savedOrmType);
      }
      if (savedPanelState && Object.values(PanelState).includes(savedPanelState)) {
        setPanelState(savedPanelState);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  // Persist schema
  useEffect(() => {
    try {
      localStorage.setItem(SCHEMA_STORAGE_KEY, schema);
    } catch {}
  }, [schema]);

  // Persist ORM type
  useEffect(() => {
    try {
      localStorage.setItem(ORM_TYPE_STORAGE_KEY, ormType);
    } catch {}
  }, [ormType]);

  // Persist panel state
  useEffect(() => {
    try {
      localStorage.setItem(PANEL_STATE_STORAGE_KEY, panelState);
    } catch {}
  }, [panelState]);

  // Parse schema and generate stats
  const parseResult = useMemo(() => {
    if (!schema.trim()) return null;
    return ormType === 'drizzle' ? parseDrizzleSchema(schema) : parsePrismaSchema(schema);
  }, [schema, ormType]);

  const stats: SchemaStats = useMemo(() => {
    if (!parseResult?.success || !parseResult.data) {
      return {
        tableCount: 0,
        relationshipCount: 0,
        validationStatus: SchemaValidationStatus.PENDING
      };
    }

    return {
      tableCount: parseResult.data.tables.length,
      relationshipCount: parseResult.data.relationships.length,
      validationStatus: parseResult.success ? SchemaValidationStatus.VALID : SchemaValidationStatus.INVALID
    };
  }, [parseResult]);

  const handleSchemaChange = useCallback((newSchema: string) => {
    setSchema(newSchema);
  }, []);

  const handlePanelStateChange = useCallback((newState: PanelState) => {
    setIsAnimating(true);
    
    if (newState === PanelState.HIDDEN && panelRef.current) {
      // First resize to 0, then update state
      panelRef.current.resize(0);
      setTimeout(() => {
        setPanelState(newState);
        setIsAnimating(false);
      }, 200);
    } else if (newState === PanelState.EXPANDED) {
      // First update state, then resize to expanded size
      setPanelState(newState);
      setTimeout(() => {
        if (panelRef.current) {
          panelRef.current.resize(35);
        }
        setIsAnimating(false);
      }, 100);
    } else {
      setPanelState(newState);
      setIsAnimating(false);
    }
  }, []);

  const showPanel = useCallback(() => {
    handlePanelStateChange(PanelState.EXPANDED);
  }, [handlePanelStateChange]);

  const showExpandButton = panelState === PanelState.HIDDEN;

  return (
    <div className={`w-full h-screen flex bg-background transition-colors duration-200 ${className}`}>
      {showExpandButton && (
        <div className="absolute top-4 left-4 z-50 animate-in fade-in slide-in-from-left-2 duration-300 ease-out">
          <Button
            variant="outline"
            size="sm"
            onClick={showPanel}
            className="shadow-lg backdrop-blur-sm bg-background/95 border-border/50 hover:bg-accent/50 transition-all duration-200 ease-out hover:scale-105 hover:shadow-xl"
            disabled={isAnimating}
          >
            <PanelLeftOpen className="h-4 w-4 transition-transform duration-200" />
            <span className="ml-2 font-medium hidden sm:inline">Show Input</span>
            <span className="ml-1 font-medium sm:hidden">Input</span>
          </Button>
        </div>
      )}

      <ResizablePanelGroup direction="horizontal" className="w-full hidden lg:flex">
        <ResizablePanel 
          ref={panelRef}
          defaultSize={panelState === PanelState.HIDDEN ? 0 : 35} 
          minSize={0}
          maxSize={panelState === PanelState.HIDDEN ? 0 : 60}
          className={`transition-all duration-300 ease-out ${isAnimating ? 'pointer-events-none' : ''}`}
          collapsible={true}
          onCollapse={() => handlePanelStateChange(PanelState.HIDDEN)}
          style={{
            overflow: panelState === PanelState.HIDDEN ? 'hidden' : 'visible',
            width: panelState === PanelState.HIDDEN ? '0px' : 'auto'
          }}
        >
          <div className={`h-full ${panelState === PanelState.HIDDEN ? 'opacity-0 pointer-events-none' : 'opacity-100'} transition-opacity duration-300 ease-out`}>
            <InputPanel
              schema={schema}
              onSchemaChange={handleSchemaChange}
              stats={stats}
              panelState={panelState}
              onPanelStateChange={handlePanelStateChange}
            />
          </div>
        </ResizablePanel>
        
        <ResizableHandle 
          className={`w-1 bg-border hover:bg-accent transition-all duration-200 ease-out hover:w-1.5 active:bg-accent/80 ${
            panelState === PanelState.HIDDEN ? 'opacity-0 pointer-events-none w-0' : 'opacity-100'
          }`} 
        />
        
        <ResizablePanel defaultSize={panelState === PanelState.HIDDEN ? 100 : 65}>
          <div className="h-full flex flex-col bg-visualization-bg">
            {/* Visualization Header */}
            <div className="p-4 border-b border-border bg-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="font-semibold text-card-foreground">Schema Visualization</h2>
                  {/* ORM Selector */}
                  <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-md">
                    <Button
                      variant={ormType === 'drizzle' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setOrmType('drizzle')}
                      className={`h-7 px-3 text-xs transition-all duration-200 ${
                        ormType === 'drizzle' 
                          ? 'bg-primary text-primary-foreground shadow-sm' 
                          : 'hover:bg-accent/50'
                      }`}
                    >
                      Drizzle
                    </Button>
                    <Button
                      variant={ormType === 'prisma' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setOrmType('prisma')}
                      className={`h-7 px-3 text-xs transition-all duration-200 ${
                        ormType === 'prisma' 
                          ? 'bg-primary text-primary-foreground shadow-sm' 
                          : 'hover:bg-accent/50'
                      }`}
                    >
                      Prisma
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {parseResult?.success && parseResult.data && (
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{parseResult.data.tables.length} {ormType === 'prisma' ? 'Models' : 'Tables'}</span>
                      <span>{parseResult.data.relationships.length} Relationships</span>
                      {parseResult.data.enums && parseResult.data.enums.length > 0 && (
                        <span>{parseResult.data.enums.length} Enums</span>
                      )}
                    </div>
                  )}
                  <ThemeToggle />
                </div>
              </div>
            </div>

            {/* Visualization Content */}
            <div className="flex-1 min-h-0">
              {parseResult?.success && parseResult.data ? (
                <DrizzleFlowVisualization 
                  tables={parseResult.data.tables}
                  relationships={parseResult.data.relationships}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground bg-background">
                  <div className="text-center space-y-4 fade-in">
                    <div className="text-center justify-center flex"><VectorSquare size={30} /></div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-medium text-foreground">No Schema Loaded</h3>
                      <p className="text-sm max-w-md text-muted-foreground">
                        Enter your {ormType === 'drizzle' ? 'Drizzle' : 'Prisma'} ORM schema in the input panel to see the visualization.
                        The parser will analyze your {ormType === 'prisma' ? 'models' : 'tables'}, {ormType === 'prisma' ? 'fields' : 'columns'}, and relationships.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Mobile Layout */}
      <div className="w-full h-full flex flex-col lg:hidden">
        {/* Mobile Header */}
        <div className="flex-shrink-0 p-4 border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-card-foreground text-sm">Schema Visualization</h2>
              {/* Mobile ORM Selector */}
              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-md">
                <Button
                  variant={ormType === 'drizzle' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setOrmType('drizzle')}
                  className={`h-6 px-2 text-xs transition-all duration-200 ${
                    ormType === 'drizzle' 
                      ? 'bg-primary text-primary-foreground shadow-sm' 
                      : 'hover:bg-accent/50'
                  }`}
                >
                  Drizzle
                </Button>
                <Button
                  variant={ormType === 'prisma' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setOrmType('prisma')}
                  className={`h-6 px-2 text-xs transition-all duration-200 ${
                    ormType === 'prisma' 
                      ? 'bg-primary text-primary-foreground shadow-sm' 
                      : 'hover:bg-accent/50'
                  }`}
                >
                  Prisma
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {parseResult?.success && parseResult.data && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{parseResult.data.tables.length} {ormType === 'prisma' ? 'M' : 'T'}</span>
                  <span>{parseResult.data.relationships.length} R</span>
                  {parseResult.data.enums && parseResult.data.enums.length > 0 && (
                    <span>{parseResult.data.enums.length} E</span>
                  )}
                </div>
              )}
              <ThemeToggle />
            </div>
          </div>
        </div>

        {/* Mobile Toggle Buttons */}
        <div className="flex-shrink-0 p-2 border-b border-border bg-muted/50">
          <div className="flex gap-2">
            <Button
              variant={panelState === PanelState.EXPANDED ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePanelStateChange(PanelState.EXPANDED)}
              className="flex-1 text-xs"
            >
              <Code className="h-3 w-3 mr-1" />
              Schema
            </Button>
            <Button
              variant={panelState === PanelState.HIDDEN ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePanelStateChange(PanelState.HIDDEN)}
              className="flex-1 text-xs"
            >
              <VectorSquare className="h-3 w-3 mr-1" />
              Visual
            </Button>
          </div>
        </div>

        {/* Mobile Content */}
        <div className="flex-1 min-h-0">
          {panelState === PanelState.EXPANDED ? (
            <div className="h-full">
              <InputPanel
                schema={schema}
                onSchemaChange={handleSchemaChange}
                stats={stats}
                panelState={panelState}
                onPanelStateChange={handlePanelStateChange}
                className="h-full"
              />
            </div>
          ) : (
            <div className="h-full flex flex-col bg-visualization-bg">
              <div className="flex-1 min-h-0">
                {parseResult?.success && parseResult.data ? (
                  <DrizzleFlowVisualization 
                    tables={parseResult.data.tables}
                    relationships={parseResult.data.relationships}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground bg-background">
                    <div className="text-center space-y-4 p-4">
                      <div className="text-center justify-center flex"><VectorSquare size={24} /></div>
                      <div className="space-y-2">
                        <h3 className="text-base font-medium text-foreground">No Schema Loaded</h3>
                        <p className="text-xs max-w-sm text-muted-foreground">
                          Enter your {ormType === 'drizzle' ? 'Drizzle' : 'Prisma'} ORM schema to see the visualization.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}