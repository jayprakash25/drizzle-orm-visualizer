// Shared utilities for Drizzle ORM parsing
// Following DRY (Don't Repeat Yourself) principle

import { ParsedColumn, ParsedTable, ParsedSchema, SchemaStats } from '@/types/drizzle';

// Constants
export const DEFAULT_Y_OFFSET = 50;
export const TABLE_SPACING_X = 250;
export const TABLE_SPACING_Y = 200;

// Example schema for demonstration
export const EXAMPLE_DRIZZLE_SCHEMA = `import { pgTable, uuid, text, varchar, timestamp, integer, numeric, jsonb, pgEnum, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Audit Schema 
const auditSchema = {
  createdAt: timestamp('created_at').defaultNow().notNull(),
  createdBy: uuid('created_by'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by'),
};

// Enums
export const clubMemberRoleEnum = pgEnum('club_member_role', ['owner', 'manager', 'agent', 'player']);
export const clubMemberStatusEnum = pgEnum('club_member_status', ['pending_approval', 'approved', 'suspended', 'banned']);
export const chipTransactionTypeEnum = pgEnum('chip_transaction_type', ['game_buy_in', 'game_cash_out', 'rake_collection', 'transfer', 'deposit', 'withdraw', 'bonus', 'penalty', 'refund']);
export const chipRequestTypeEnum = pgEnum('chip_request_type', ['deposit', 'withdraw']);
export const chipRequestStatusEnum = pgEnum('chip_request_status', ['pending', 'approved', 'rejected', 'processed']);
export const clubRoomStatusEnum = pgEnum('club_room_status', ['waiting', 'active', 'paused', 'completed']);
export const gameTypeEnum = pgEnum('game_type', ['NLH', 'PLO', 'PLO5', 'PLO6', 'MIXED']);
export const handStatusEnum = pgEnum('hand_status', ['in_progress', 'completed', 'cancelled']);
export const handPhaseEnum = pgEnum('game_phase', ['waiting', 'preflop', 'flop', 'turn', 'river', 'showdown', 'finished', 'collecting_chips', 'awarding_pot']);
export const authProviderEnum = pgEnum('auth_provider', ['google', 'twitter', 'facebook', 'discord']);

// Tables
export const clubUsers = pgTable('club_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  avatarUrl: text('avatar_url'),
  authProvider: authProviderEnum('auth_provider').notNull(),
  authProviderId: varchar('auth_provider_id', { length: 255 }).notNull(),
  ...auditSchema,
});

export const clubs = pgTable('clubs', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  uniqueName: varchar('unique_name', { length: 100 }).notNull().unique(),
  inviteCode: varchar('invite_code', { length: 20 }).notNull().unique(),
  ...auditSchema,
});

export const clubMembers = pgTable('club_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  clubId: uuid('club_id').notNull(),
  userId: uuid('user_id').notNull(),
  role: clubMemberRoleEnum('role').notNull().default('player'),
  status: clubMemberStatusEnum('status').notNull().default('pending_approval'),
  ...auditSchema,
});

// Relations
export const clubsRelations = relations(clubs, ({ one, many }) => ({
  owner: one(clubUsers, {
    fields: [clubs.ownerId],
    references: [clubUsers.id],
  }),
}));

export const clubMembersRelations = relations(clubMembers, ({ one, many }) => ({
  club: one(clubs, {
    fields: [clubMembers.clubId],
    references: [clubs.id],
  }),
  user: one(clubUsers, {
    fields: [clubMembers.userId],
    references: [clubUsers.id],
  }),
}));

// Indexes
export const clubMembersClubIdIdx = index('club_members_club_id_idx').on(clubMembers.clubId);
export const clubMembersUniqueIdx = uniqueIndex('club_members_club_user_unique_idx').on(clubMembers.clubId, clubMembers.userId);`;

// Utility functions for column type styling with Vercel theme
export function getColumnTypeColor(type: string): string {
  switch (type.toLowerCase()) {
    case 'serial':
    case 'integer':
    case 'bigint':
    case 'int4':
      return 'bg-blue-50 text-blue-700 border border-blue-200';
    case 'varchar':
    case 'text':
    case 'char':
      return 'bg-green-50 text-green-700 border border-green-200';
    case 'boolean':
      return 'bg-purple-50 text-purple-700 border border-purple-200';
    case 'timestamp':
    case 'timestamptz':
    case 'date':
      return 'bg-orange-50 text-orange-700 border border-orange-200';
    case 'json':
    case 'jsonb':
      return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
    case 'uuid':
      return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
    case 'numeric':
      return 'bg-cyan-50 text-cyan-700 border border-cyan-200';
    default:
      return 'bg-secondary text-secondary-foreground border border-border';
  }
}

// Generate table positions with consistent spacing
export function generateTablePosition(index: number, customSpacing?: { x?: number; y?: number }): { x: number; y: number } {
  const spacingX = customSpacing?.x ?? TABLE_SPACING_X;
  const spacingY = customSpacing?.y ?? TABLE_SPACING_Y;
  
  return {
    x: 50 + (index * spacingX) + (Math.random() * 100 - 50), // Add slight randomization
    y: DEFAULT_Y_OFFSET + Math.floor(index / 3) * spacingY // Arrange in rows of 3
  };
}

// Calculate schema statistics
export function calculateSchemaStats(schema: ParsedSchema): SchemaStats {
  return {
    tableCount: schema.tables.length,
    relationshipCount: schema.relationships.length,
    columnCount: schema.tables.reduce((acc, table) => acc + table.columns.length, 0)
  };
}

// Validate column properties
export function validateColumn(column: ParsedColumn): boolean {
  return !!(column.name && column.type);
}

// Validate table structure
export function validateTable(table: ParsedTable): boolean {
  return !!(
    table.id && 
    table.name && 
    table.columns && 
    table.columns.length > 0 &&
    table.columns.every(validateColumn)
  );
}

// Generate unique relationship ID
export function generateRelationshipId(sourceTable: string, sourceColumn: string, targetTable: string): string {
  return `rel-${sourceTable}-${sourceColumn}-${targetTable}`;
}

// Format text for display
export function formatTableCount(count: number): string {
  return `${count} table${count !== 1 ? 's' : ''}`;
}

export function formatRelationshipCount(count: number): string {
  return `${count} relationship${count !== 1 ? 's' : ''}`;
}

export function formatColumnCount(count: number): string {
  return `${count} column${count !== 1 ? 's' : ''}`;
}

// Parse column modifiers from string
export function parseColumnModifiers(modifiers: string): {
  isPrimaryKey: boolean;
  isUnique: boolean;
  isNotNull: boolean;
  hasDefault: boolean;
} {
  return {
    isPrimaryKey: modifiers.includes('primaryKey()'),
    isUnique: modifiers.includes('unique()'),
    isNotNull: modifiers.includes('notNull()'),
    hasDefault: modifiers.includes('default(') || modifiers.includes('defaultNow(')
  };
}

// Extract references from column definition
export function extractReferences(modifiers: string): { table: string; column: string } | undefined {
  const referencesMatch = modifiers.match(/\.references\(\(\)\s*=>\s*(\w+)\.(\w+)\)/);
  if (referencesMatch) {
    return {
      table: referencesMatch[1],
      column: referencesMatch[2]
    };
  }
  return undefined;
}
