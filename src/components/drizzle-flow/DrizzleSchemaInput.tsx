'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, 
  AlertCircle, 
  CheckCircle, 
  Database, 
  Network, 
  Code,
  Zap
} from 'lucide-react';
import { parseDrizzleSchema, parseDrizzleSchemaFallback } from '@/lib/drizzle-parser';
import { DrizzleSchemaInputProps, ParseResult } from '@/types/drizzle';
import { EXAMPLE_DRIZZLE_SCHEMA } from '@/lib/drizzle-utils';

export function DrizzleSchemaInput({ onSchemaChange, className = '' }: DrizzleSchemaInputProps) {
  const [schema, setSchema] = useState(EXAMPLE_DRIZZLE_SCHEMA);
  const [isLoading, setIsLoading] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

  const handleSchemaChange = useCallback((value: string) => {
    setSchema(value);
    setParseResult(null);
  }, []);

  const handleParse = useCallback(async () => {
    if (!schema.trim()) {
      const errorResult: ParseResult = {
        success: false,
        error: 'Please enter a Drizzle schema to parse'
      };
      setParseResult(errorResult);
      onSchemaChange(errorResult);
      return;
    }

    setIsLoading(true);
    
    try {
      // First try the AST parser
      let result = parseDrizzleSchema(schema);
      
      // If AST parsing fails, try fallback regex parser
      if (!result.success) {
        console.log('AST parsing failed, trying fallback parser:', result.error);
        result = parseDrizzleSchemaFallback(schema);
      }
      
      setParseResult(result);
      onSchemaChange(result);
    } catch (error) {
      const errorResult: ParseResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      setParseResult(errorResult);
      onSchemaChange(errorResult);
    } finally {
      setIsLoading(false);
    }
  }, [schema, onSchemaChange]);

  const handleLoadExample = useCallback(() => {
    setSchema(EXAMPLE_DRIZZLE_SCHEMA);
    setParseResult(null);
  }, []);

  const stats = useMemo(() => {
    if (!parseResult?.success || !parseResult.data) return null;
    
    return {
      tableCount: parseResult.data.tables.length,
      relationshipCount: parseResult.data.relationships.length,
      columnCount: parseResult.data.tables.reduce((acc, table) => acc + table.columns.length, 0)
    };
  }, [parseResult]);

  return (
    <Card className={`h-full flex flex-col bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 transition-colors duration-200 ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code className="h-5 w-5 text-blue-600 dark:text-blue-400 transition-colors duration-200" />
            <CardTitle className="text-lg text-gray-900 dark:text-white transition-colors duration-200">Drizzle Schema Input</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadExample}
              className="text-xs bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
            >
              Load Example
            </Button>
            <Button
              onClick={handleParse}
              disabled={isLoading || !schema.trim()}
              size="sm"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200"
            >
              {isLoading ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Parse Schema
            </Button>
          </div>
        </div>
        
        {/* Stats */}
        {stats && (
          <div className="flex items-center gap-4 pt-2">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-gray-600 dark:text-gray-400 transition-colors duration-200" />
              <span className="text-sm text-gray-700 dark:text-gray-300 transition-colors duration-200">
                {stats.tableCount} table{stats.tableCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-gray-600 dark:text-gray-400 transition-colors duration-200" />
              <span className="text-sm text-gray-700 dark:text-gray-300 transition-colors duration-200">
                {stats.relationshipCount} relationship{stats.relationshipCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-gray-600 dark:text-gray-400 transition-colors duration-200" />
              <span className="text-sm text-gray-700 dark:text-gray-300 transition-colors duration-200">
                {stats.columnCount} column{stats.columnCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col min-h-0 space-y-4">
        {/* Input Area */}
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <Textarea
              value={schema}
              onChange={(e) => handleSchemaChange(e.target.value)}
              placeholder="Paste your Drizzle ORM schema here...

Example:
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 256 }),
  email: varchar('email').unique(),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  title: text('title').notNull(),
});"
              className="min-h-[300px] font-mono text-sm resize-none bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 transition-colors duration-200"
              style={{ fontFamily: 'var(--font-geist-mono), Consolas, monospace' }}
            />
          </ScrollArea>
        </div>
        
        {/* Parse Result */}
        {parseResult && (
          <div className="space-y-2">
            {parseResult.success ? (
              <Alert className="border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 transition-colors duration-200">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 transition-colors duration-200" />
                <AlertDescription className="text-green-800 dark:text-green-300 transition-colors duration-200">
                  Schema parsed successfully! Found {parseResult.data?.tables.length || 0} tables 
                  and {parseResult.data?.relationships.length || 0} relationships.
                  {parseResult.data?.enums && parseResult.data.enums.length > 0 && (
                    <span> Also found {parseResult.data.enums.length} enums.</span>
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 transition-colors duration-200">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 transition-colors duration-200" />
                <AlertDescription className="text-red-800 dark:text-red-300 transition-colors duration-200">
                  {parseResult.error}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
