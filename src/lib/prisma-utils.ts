

// Example Prisma schema for PostgreSQL
export const EXAMPLE_PRISMA_SCHEMA = `// Prisma Schema Example for PostgreSQL
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Enums
enum Role {
  USER
  ADMIN
  MODERATOR
}

enum PostStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum AuthProvider {
  GOOGLE
  TWITTER
  FACEBOOK
  DISCORD
}

// Models
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  name          String?
  role          Role      @default(USER)
  authProvider  AuthProvider
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  // Relations
  posts         Post[]
  comments      Comment[]
  profile       Profile?
  sessions      Session[]

  @@index([email])
  @@index([role])
}

model Profile {
  id        String   @id @default(uuid())
  userId    String   @unique
  bio       String?
  avatar    String?
  website   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Relations
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Post {
  id          String     @id @default(uuid())
  title       String     @db.VarChar(255)
  content     String?    @db.Text
  status      PostStatus @default(DRAFT)
  published   Boolean    @default(false)
  authorId    String
  categoryId  String?
  views       Int        @default(0)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  publishedAt DateTime?
  
  // Relations
  author      User       @relation(fields: [authorId], references: [id], onDelete: Cascade)
  category    Category?  @relation(fields: [categoryId], references: [id])
  comments    Comment[]
  tags        PostTag[]

  @@index([authorId])
  @@index([categoryId])
  @@index([status, published])
  @@unique([authorId, title])
}

model Category {
  id          String   @id @default(uuid())
  name        String   @unique
  slug        String   @unique
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Relations
  posts       Post[]
}

model Tag {
  id        String    @id @default(uuid())
  name      String    @unique
  slug      String    @unique
  createdAt DateTime  @default(now())
  
  // Relations
  posts     PostTag[]
}

model PostTag {
  postId    String
  tagId     String
  createdAt DateTime @default(now())
  
  // Relations
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  tag       Tag      @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([postId, tagId])
  @@index([postId])
  @@index([tagId])
}

model Comment {
  id        String   @id @default(uuid())
  content   String   @db.Text
  postId    String
  authorId  String
  parentId  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Relations
  post      Post      @relation(fields: [postId], references: [id], onDelete: Cascade)
  author    User      @relation(fields: [authorId], references: [id], onDelete: Cascade)
  parent    Comment?  @relation("CommentReplies", fields: [parentId], references: [id])
  replies   Comment[] @relation("CommentReplies")

  @@index([postId])
  @@index([authorId])
  @@index([parentId])
}

model Session {
  id        String   @id @default(uuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  
  // Relations
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
  @@index([expiresAt])
}`;

// Helper function to detect if schema is Prisma or Drizzle
export function detectSchemaType(schemaCode: string): 'prisma' | 'drizzle' | 'unknown' {
  const cleanCode = schemaCode.trim();
  
  // Check for Prisma indicators
  const hasPrismaModel = /\bmodel\s+\w+\s*\{/.test(cleanCode);
  const hasPrismaEnum = /\benum\s+\w+\s*\{/.test(cleanCode);
  const hasPrismaGenerator = /\bgenerator\s+/.test(cleanCode);
  const hasPrismaDatasource = /\bdatasource\s+/.test(cleanCode);
  
  // Check for Drizzle indicators
  const hasDrizzleTable = /\b(pgTable|mysqlTable|sqliteTable)\s*\(/.test(cleanCode);
  const hasDrizzleEnum = /\b(pgEnum|mysqlEnum)\s*\(/.test(cleanCode);
  const hasDrizzleImport = /from\s+['"]drizzle-orm/.test(cleanCode);
  
  // Prisma is more specific with its syntax
  if (hasPrismaModel || hasPrismaGenerator || hasPrismaDatasource) {
    return 'prisma';
  }
  
  // Drizzle check
  if (hasDrizzleTable || hasDrizzleEnum || hasDrizzleImport) {
    return 'drizzle';
  }
  
  return 'unknown';
}

// Validate Prisma schema syntax basics
export function validatePrismaSchema(schemaCode: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check for at least one model or enum
  if (!schemaCode.includes('model ') && !schemaCode.includes('enum ')) {
    errors.push('Schema must contain at least one model or enum');
  }
  
  // Check for balanced braces
  const openBraces = (schemaCode.match(/\{/g) || []).length;
  const closeBraces = (schemaCode.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push('Unbalanced braces in schema');
  }
  
  // Check for generator (optional but recommended)
  if (!schemaCode.includes('generator ')) {
    errors.push('Warning: No generator defined (optional)');
  }
  
  // Check for datasource (optional but recommended)
  if (!schemaCode.includes('datasource ')) {
    errors.push('Warning: No datasource defined (optional)');
  }
  
  return {
    valid: errors.filter(e => !e.startsWith('Warning')).length === 0,
    errors
  };
}

// Get Prisma field type color for UI styling
export function getPrismaFieldTypeColor(type: string): string {
  const baseType = type.replace(/[\[\]?]/g, '').toLowerCase();
  
  switch (baseType) {
    case 'int':
    case 'bigint':
    case 'serial':
    case 'integer':
      return 'bg-blue-50 text-blue-700 border border-blue-200';
    case 'string':
    case 'text':
    case 'varchar':
      return 'bg-green-50 text-green-700 border border-green-200';
    case 'boolean':
      return 'bg-purple-50 text-purple-700 border border-purple-200';
    case 'datetime':
    case 'timestamp':
    case 'timestamptz':
    case 'date':
      return 'bg-orange-50 text-orange-700 border border-orange-200';
    case 'json':
    case 'jsonb':
      return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
    case 'uuid':
      return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
    case 'float':
    case 'decimal':
    case 'numeric':
      return 'bg-cyan-50 text-cyan-700 border border-cyan-200';
    default:
      // Check if it's an enum (starts with uppercase)
      if (/^[A-Z]/.test(type)) {
        return 'bg-pink-50 text-pink-700 border border-pink-200';
      }
      return 'bg-secondary text-secondary-foreground border border-border';
  }
}

// Format Prisma type for display
export function formatPrismaType(type: string, isArray: boolean, isOptional: boolean): string {
  let formatted = type;
  if (isArray) formatted += '[]';
  if (isOptional) formatted += '?';
  return formatted;
}

// Extract Prisma version from schema (if specified)
export function extractPrismaVersion(schemaCode: string): string | null {
  const versionMatch = schemaCode.match(/\/\/\s*@prisma\s+version:\s*([\d.]+)/);
  return versionMatch ? versionMatch[1] : null;
}

