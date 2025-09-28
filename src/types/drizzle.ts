// Consolidated types for Drizzle ORM parsing and visualization
// Following SSOT (Single Source of Truth) principle

export interface ParsedColumn {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isUnique: boolean;
  isNotNull: boolean;
  references?: {
    table: string;
    column: string;
  };
  defaultValue?: string;
}

export interface ParsedIndex {
  name: string;
  columns: string[];
  isUnique: boolean;
}

export interface ParsedEnum {
  name: string;
  values: string[];
}

export interface ParsedTable {
  id: string;
  name: string;
  columns: ParsedColumn[];
  indexes: ParsedIndex[];
  position: { x: number; y: number };
}

export interface ParsedRelationship {
  id: string;
  source: string;
  target: string;
  sourceColumn: string;
  targetColumn: string;
}

export interface ParsedSchema {
  tables: ParsedTable[];
  relationships: ParsedRelationship[];
  enums: ParsedEnum[];
}

export interface ParseResult {
  success: boolean;
  data?: ParsedSchema;
  error?: string;
}

export interface SchemaStats {
  tableCount: number;
  relationshipCount: number;
  columnCount: number;
}

export enum PanelState {
  EXPANDED = 'expanded',
  COLLAPSED = 'collapsed',
  HIDDEN = 'hidden'
}

export enum SchemaValidationStatus {
  PENDING = 'pending',
  VALID = 'valid',
  INVALID = 'invalid'
}

// React Flow specific types are defined in component files to avoid circular dependencies

// Component prop types
export interface DrizzleFlowVisualizationProps {
  tables: ParsedTable[];
  relationships: ParsedRelationship[];
  className?: string;
}

export interface DrizzleSchemaInputProps {
  onSchemaChange: (result: ParseResult) => void;
  className?: string;
}

export interface DrizzleFlowAppProps {
  className?: string;
}
