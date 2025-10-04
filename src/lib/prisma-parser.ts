

import {
  ParsedColumn,
  ParsedTable,
  ParsedRelationship,
  ParseResult,
  ParsedEnum,
  ParsedIndex
} from '@/types/drizzle';
import {
  generateTablePosition,
  generateRelationshipId
} from './drizzle-utils';

// Prisma field type mapping to database types
const PRISMA_TYPE_MAPPING: Record<string, string> = {
  'String': 'text',
  'Int': 'integer',
  'BigInt': 'bigint',
  'Float': 'double precision',
  'Decimal': 'numeric',
  'Boolean': 'boolean',
  'DateTime': 'timestamp',
  'Json': 'jsonb',
  'Bytes': 'bytea'
};

interface PrismaModel {
  name: string;
  fields: PrismaField[];
  indexes: ParsedIndex[];
  attributes: PrismaModelAttribute[];
}

interface PrismaField {
  name: string;
  type: string;
  isArray: boolean;
  isOptional: boolean;
  attributes: PrismaFieldAttribute[];
}

interface PrismaFieldAttribute {
  name: string;
  args: string[];
}

interface PrismaModelAttribute {
  name: string;
  args: string[];
}

interface PrismaEnum {
  name: string;
  values: string[];
}

/**
 * Main parser function for Prisma schemas
 * Handles: models, fields, relations, enums, indexes, and all Prisma attributes
 */
export function parsePrismaSchema(schemaCode: string): ParseResult {
  try {
    // Validate input
    if (!schemaCode || typeof schemaCode !== 'string') {
      return {
        success: false,
        error: 'Invalid schema code provided'
      };
    }

    // Clean the schema code
    const cleanedCode = schemaCode
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, '') // Remove line comments
      .trim();

    if (!cleanedCode) {
      return {
        success: false,
        error: 'Schema code is empty after cleaning'
      };
    }

    // Check if the code looks like a Prisma schema
    if (!cleanedCode.includes('model ') && !cleanedCode.includes('enum ')) {
      return {
        success: false,
        error: 'No Prisma models or enums found. Make sure you have model definitions.'
      };
    }

    const tables: ParsedTable[] = [];
    const relationships: ParsedRelationship[] = [];
    const enums: ParsedEnum[] = [];

    // Parse enums first
    const parsedEnums = parseEnums(cleanedCode);
    enums.push(...parsedEnums);

    // Parse models
    const models = parseModels(cleanedCode);
    
    // Convert models to tables and extract relationships
    models.forEach((model, index) => {
      const table = convertModelToTable(model, index, parsedEnums);
      if (table) {
        tables.push(table);
      }
    });

    // Extract relationships from @relation attributes
    models.forEach(model => {
      const modelRelationships = extractRelationships(model, models);
      relationships.push(...modelRelationships);
    });

    // Validate parsed data
    if (tables.length === 0 && enums.length === 0) {
      return {
        success: false,
        error: 'No valid Prisma models or enums found in the schema'
      };
    }

    return {
      success: true,
      data: {
        tables,
        relationships,
        enums
      }
    };
  } catch (error) {
    console.error('Error parsing Prisma schema:', error);
    // Try fallback parser as last resort
    try {
      return parsePrismaSchemaFallback(schemaCode);
    } catch {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown parsing error'
      };
    }
  }
}

/**
 * Parse Prisma enums from schema
 * Example: enum Role { USER ADMIN }
 */
function parseEnums(schemaCode: string): PrismaEnum[] {
  const enums: PrismaEnum[] = [];
  const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;
  let match;

  while ((match = enumRegex.exec(schemaCode)) !== null) {
    const [, name, valuesStr] = match;
    const values = valuesStr
      .split(/\s+/)
      .map(v => v.trim())
      .filter(v => v && !v.startsWith('//'));

    enums.push({ name, values });
  }

  return enums;
}

/**
 * Parse Prisma models from schema
 * Handles all field types, attributes, and model-level attributes
 */
function parseModels(schemaCode: string): PrismaModel[] {
  const models: PrismaModel[] = [];
  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
  let match;

  while ((match = modelRegex.exec(schemaCode)) !== null) {
    const [, modelName, modelBody] = match;
    const fields: PrismaField[] = [];
    const indexes: ParsedIndex[] = [];
    const attributes: PrismaModelAttribute[] = [];

    // Split by lines and process each
    const lines = modelBody.split('\n').map(l => l.trim()).filter(l => l);

    for (const line of lines) {
      // Skip comments
      if (line.startsWith('//')) continue;

      // Parse model-level attributes (@@index, @@unique, @@id)
      if (line.startsWith('@@')) {
        const attrMatch = line.match(/@@(\w+)\(([^)]*)\)/);
        if (attrMatch) {
          const [, attrName, attrArgs] = attrMatch;
          attributes.push({ name: attrName, args: [attrArgs] });

          // Handle indexes
          if (attrName === 'index' || attrName === 'unique') {
            const indexData = parseIndexAttribute(attrArgs);
            if (indexData) {
              indexes.push({
                name: indexData.name || `${modelName}_${attrName}_${indexes.length}`,
                columns: indexData.columns,
                isUnique: attrName === 'unique'
              });
            }
          }
        }
        continue;
      }

      // Parse field
      const field = parseField(line);
      if (field) {
        fields.push(field);
      }
    }

    models.push({
      name: modelName,
      fields,
      indexes,
      attributes
    });
  }

  return models;
}

/**
 * Parse a single field from a Prisma model
 * Example: id Int @id @default(autoincrement())
 * Example: email String @unique
 * Example: posts Post[]
 * Example: userId Int?
 */
function parseField(line: string): PrismaField | null {
  try {
    // Basic field pattern: fieldName Type? @attributes
    const fieldMatch = line.match(/^(\w+)\s+([\w\[\]?]+)(.*)$/);
    if (!fieldMatch) return null;

    const [, name, typeStr, attributesStr] = fieldMatch;

    // Parse type
    let type = typeStr;
    const isArray = type.endsWith('[]');
    const isOptional = type.endsWith('?');
    
    if (isArray) type = type.slice(0, -2);
    if (isOptional) type = type.slice(0, -1);

    // Parse attributes
    const attributes: PrismaFieldAttribute[] = [];
    const attrRegex = /@(\w+)(?:\(([^)]*)\))?/g;
    let attrMatch;

    while ((attrMatch = attrRegex.exec(attributesStr)) !== null) {
      const [, attrName, attrArgs] = attrMatch;
      attributes.push({
        name: attrName,
        args: attrArgs ? parseAttributeArgs(attrArgs) : []
      });
    }

    return {
      name,
      type,
      isArray,
      isOptional,
      attributes
    };
  } catch (error) {
    console.error('Error parsing field:', line, error);
    return null;
  }
}

/**
 * Parse attribute arguments
 * Handles: simple values, function calls, named arguments
 */
function parseAttributeArgs(argsStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i];

    if ((char === '"' || char === "'") && (i === 0 || argsStr[i - 1] !== '\\')) {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
      current += char;
      continue;
    }

    if (inString) {
      current += char;
      continue;
    }

    if (char === '(' || char === '[') {
      depth++;
      current += char;
    } else if (char === ')' || char === ']') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      if (current.trim()) {
        args.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

/**
 * Parse @@index or @@unique attribute
 * Example: @@index([userId, postId], name: "user_post_idx")
 */
function parseIndexAttribute(argsStr: string): { columns: string[]; name?: string } | null {
  try {
    const columns: string[] = [];
    let name: string | undefined;

    // Extract columns array
    const columnsMatch = argsStr.match(/\[([^\]]+)\]/);
    if (columnsMatch) {
      const columnsStr = columnsMatch[1];
      columns.push(...columnsStr.split(',').map(c => c.trim()));
    }

    // Extract name if present
    const nameMatch = argsStr.match(/name:\s*["']([^"']+)["']/);
    if (nameMatch) {
      name = nameMatch[1];
    }

    return columns.length > 0 ? { columns, name } : null;
  } catch (error) {
    console.error('Error parsing index attribute:', error);
    return null;
  }
}

/**
 * Convert Prisma model to ParsedTable
 */
function convertModelToTable(
  model: PrismaModel,
  index: number,
  enums: PrismaEnum[]
): ParsedTable | null {
  try {
    const columns: ParsedColumn[] = [];

    for (const field of model.fields) {
      // Skip relation fields (they're handled separately)
      const isRelation = !PRISMA_TYPE_MAPPING[field.type] && 
                        !enums.some(e => e.name === field.type) &&
                        field.type !== 'Unsupported';

      if (isRelation && !field.attributes.some(a => a.name === 'relation')) {
        // This is likely a relation field - skip for now
        // Relations are extracted separately
        continue;
      }

      const column = convertFieldToColumn(field, enums);
      if (column) {
        columns.push(column);
      }
    }

    return {
      id: model.name,
      name: model.name,
      columns,
      indexes: model.indexes,
      position: generateTablePosition(index)
    };
  } catch (error) {
    console.error('Error converting model to table:', error);
    return null;
  }
}

/**
 * Convert Prisma field to ParsedColumn
 */
function convertFieldToColumn(field: PrismaField, enums: PrismaEnum[]): ParsedColumn | null {
  try {
    // Determine the database type
    let dbType = PRISMA_TYPE_MAPPING[field.type] || field.type.toLowerCase();
    
    // Check if it's an enum
    const isEnum = enums.some(e => e.name === field.type);
    if (isEnum) {
      dbType = `enum(${field.type})`;
    }

    // Add array notation if applicable
    if (field.isArray) {
      dbType += '[]';
    }

    // Check for special attributes
    const idAttr = field.attributes.find(a => a.name === 'id');
    const uniqueAttr = field.attributes.find(a => a.name === 'unique');
    const defaultAttr = field.attributes.find(a => a.name === 'default');
    const dbAttr = field.attributes.find(a => a.name === 'db');

    // Handle @db.X native type attributes
    if (dbAttr && dbAttr.args.length > 0) {
      const nativeType = dbAttr.args[0];
      // Extract the actual type from @db.VarChar(255) etc.
      const typeMatch = nativeType.match(/(\w+)(?:\(([^)]+)\))?/);
      if (typeMatch) {
        const [, typeName, typeArgs] = typeMatch;
        dbType = typeName.toLowerCase();
        if (typeArgs) {
          dbType += `(${typeArgs})`;
        }
      }
    }

    // Handle autoincrement for Int fields with @id
    if (idAttr && field.type === 'Int') {
      const autoInc = defaultAttr?.args.some(arg => arg.includes('autoincrement'));
      if (autoInc) {
        dbType = 'serial';
      }
    }

    // Handle UUID default
    let defaultValue: string | undefined;
    if (defaultAttr) {
      const defaultArg = defaultAttr.args[0] || '';
      if (defaultArg.includes('uuid()') || defaultArg.includes('cuid()')) {
        defaultValue = 'gen_random_uuid()';
      } else if (defaultArg.includes('now()')) {
        defaultValue = 'now()';
      } else if (defaultArg.includes('autoincrement()')) {
        defaultValue = 'autoincrement';
      } else {
        defaultValue = defaultArg;
      }
    }

    return {
      name: field.name,
      type: dbType,
      isPrimaryKey: !!idAttr,
      isUnique: !!uniqueAttr,
      isNotNull: !field.isOptional,
      defaultValue
    };
  } catch (error) {
    console.error('Error converting field to column:', error);
    return null;
  }
}

/**
 * Extract relationships from @relation attributes
 * Handles both explicit and implicit relations
 */
function extractRelationships(model: PrismaModel, allModels: PrismaModel[]): ParsedRelationship[] {
  const relationships: ParsedRelationship[] = [];

  for (const field of model.fields) {
    const relationAttr = field.attributes.find(a => a.name === 'relation');
    
    // Check if this is a relation field
    const targetModel = allModels.find(m => m.name === field.type);
    if (!targetModel) continue;

    // Parse @relation attribute
    if (relationAttr && relationAttr.args.length > 0) {
      const relationData = parseRelationAttribute(relationAttr.args);
      
      if (relationData.fields && relationData.references) {
        // This is the "owning" side of the relation
        for (let i = 0; i < relationData.fields.length; i++) {
          const sourceColumn = relationData.fields[i];
          const targetColumn = relationData.references[i] || relationData.references[0];

          relationships.push({
            id: generateRelationshipId(model.name, sourceColumn, field.type),
            source: model.name,
            target: field.type,
            sourceColumn,
            targetColumn
          });
        }
      }
    } else if (!field.isArray) {
      // Implicit relation - look for foreign key field
      const fkFieldName = `${field.name}Id`;
      const fkField = model.fields.find(f => 
        f.name === fkFieldName || 
        f.name === `${field.name}_id` ||
        f.name.toLowerCase() === `${field.name.toLowerCase()}id`
      );

      if (fkField) {
        // Find the primary key of the target model
        const targetPk = targetModel.fields.find(f => 
          f.attributes.some(a => a.name === 'id')
        );

        if (targetPk) {
          relationships.push({
            id: generateRelationshipId(model.name, fkField.name, field.type),
            source: model.name,
            target: field.type,
            sourceColumn: fkField.name,
            targetColumn: targetPk.name
          });
        }
      }
    }
  }

  return relationships;
}

/**
 * Parse @relation attribute arguments
 * Example: @relation(fields: [userId], references: [id])
 */
function parseRelationAttribute(args: string[]): {
  name?: string;
  fields?: string[];
  references?: string[];
} {
  const result: {
    name?: string;
    fields?: string[];
    references?: string[];
  } = {};

  for (const arg of args) {
    // Parse named arguments
    const namedMatch = arg.match(/(\w+):\s*(.+)/);
    if (namedMatch) {
      const [, key, value] = namedMatch;
      
      if (key === 'fields' || key === 'references') {
        // Parse array: [field1, field2]
        const arrayMatch = value.match(/\[([^\]]+)\]/);
        if (arrayMatch) {
          result[key] = arrayMatch[1].split(',').map(v => v.trim());
        }
      } else if (key === 'name') {
        // Parse string value
        result.name = value.replace(/['"]/g, '');
      }
    } else {
      // First argument without key is the relation name
      if (!result.name) {
        result.name = arg.replace(/['"]/g, '');
      }
    }
  }

  return result;
}

/**
 * Fallback regex-based parser for simpler Prisma schemas
 */
export function parsePrismaSchemaFallback(schemaCode: string): ParseResult {
  try {
    const tables: ParsedTable[] = [];
    const relationships: ParsedRelationship[] = [];
    const enums: ParsedEnum[] = [];

    // Parse enums
    const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;
    let enumMatch;
    while ((enumMatch = enumRegex.exec(schemaCode)) !== null) {
      const [, name, valuesStr] = enumMatch;
      const values = valuesStr.split(/\s+/).map(v => v.trim()).filter(v => v);
      enums.push({ name, values });
    }

    // Parse models
    const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
    let modelMatch;
    let tableIndex = 0;

    while ((modelMatch = modelRegex.exec(schemaCode)) !== null) {
      const [, modelName, modelBody] = modelMatch;
      const columns: ParsedColumn[] = [];

      // Parse fields
      const lines = modelBody.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;

        const fieldMatch = trimmed.match(/^(\w+)\s+([\w\[\]?]+)/);
        if (fieldMatch) {
          const [, fieldName, typeStr] = fieldMatch;
          
          // Skip relation types
          if (!PRISMA_TYPE_MAPPING[typeStr.replace(/[\[\]?]/g, '')]) continue;

          const isPrimaryKey = trimmed.includes('@id');
          const isUnique = trimmed.includes('@unique');
          const isOptional = typeStr.includes('?');

          columns.push({
            name: fieldName,
            type: PRISMA_TYPE_MAPPING[typeStr.replace(/[\[\]?]/g, '')] || typeStr,
            isPrimaryKey,
            isUnique,
            isNotNull: !isOptional,
          });
        }
      }

      if (columns.length > 0) {
        tables.push({
          id: modelName,
          name: modelName,
          columns,
          indexes: [],
          position: generateTablePosition(tableIndex++)
        });
      }
    }

    return {
      success: true,
      data: {
        tables,
        relationships,
        enums
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error'
    };
  }
}

