// Enums for schema visualizer states and types
export enum PanelState {
  EXPANDED = 'expanded',
  HIDDEN = 'hidden'
}

export enum SchemaValidationStatus {
  VALID = 'valid',
  INVALID = 'invalid',
  PENDING = 'pending'
}

// Schema types for the schema visualizer
export interface SchemaVisualizerProps {
  initialSchema?: string;
  onSchemaChange?: (schema: string) => void;
  panelState?: PanelState;
  onPanelStateChange?: (state: PanelState) => void;
}

export interface SchemaStats {
  tableCount: number;
  relationshipCount: number;
  validationStatus: SchemaValidationStatus;
}

export interface VisualizationData {
  tables: TableNode[];
  relationships: RelationshipEdge[];
}

export interface TableNode {
  id: string;
  name: string;
  columns: ColumnInfo[];
  position: { x: number; y: number };
}

export interface ColumnInfo {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isUnique: boolean;
  isNotNull: boolean;
  references?: string;
}

export interface RelationshipEdge {
  id: string;
  source: string;
  target: string;
  sourceColumn: string;
  targetColumn: string;
}

// Root component props for SchemaVisualizer
export interface SchemaVisualizerRootProps {
  initialSchema?: string;
  defaultPanelState?: PanelState;
  defaultPanelWidth?: number;
  onSchemaChange?: (schema: string) => void;
  onStatsChange?: (stats: SchemaStats) => void;
  className?: string;
}