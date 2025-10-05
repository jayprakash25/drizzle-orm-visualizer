import { Parser } from 'acorn';
import tsPlugin from 'acorn-typescript';
import { 
  ParsedColumn, 
  ParsedTable, 
  ParsedRelationship, 
  ParseResult,
  ParsedEnum
} from '@/types/drizzle';
import { 
  generateTablePosition, 
  generateRelationshipId, 
  parseColumnModifiers, 
  extractReferences 
} from './drizzle-utils';
import { Node, VariableDeclaration, CallExpression, ObjectExpression, Identifier, Literal, Property, MemberExpression, ArrayExpression, ArrowFunctionExpression, VariableDeclarator, Pattern, SpreadElement, Expression } from 'estree';

// Type guards to narrow down node types
const isIdentifier = (node: Node | Pattern | Expression | SpreadElement | null): node is Identifier => node?.type === 'Identifier';
const isCallExpression = (node: Node | Expression | SpreadElement | null): node is CallExpression => node?.type === 'CallExpression';
const isObjectExpression = (node: Node | Expression | SpreadElement | Pattern | null): node is ObjectExpression => node?.type === 'ObjectExpression';
const isArrayExpression = (node: Node | Expression | SpreadElement): node is ArrayExpression => node?.type === 'ArrayExpression';
const isMemberExpression = (node: Node | Expression | SpreadElement | null): node is MemberExpression => node?.type === 'MemberExpression';
const isLiteral = (node: Node | Pattern | Expression | SpreadElement | null): node is Literal => node?.type === 'Literal';
const isArrowFunctionExpression = (node: Node | Expression | SpreadElement): node is ArrowFunctionExpression => node?.type === 'ArrowFunctionExpression';
const isProperty = (node: Property | SpreadElement | null | undefined): node is Property => node?.type === 'Property';


// Parse Drizzle ORM schema using acorn-typescript
export function parseDrizzleSchema(schemaCode: string): ParseResult {
  try {
    // Validate input
    if (!schemaCode || typeof schemaCode !== 'string') {
      return {
        success: false,
        error: 'Invalid schema code provided'
      };
    }

    // Clean the schema code - remove comments and normalize whitespace
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

    // Check if the code looks like a Drizzle schema
    if (!cleanedCode.includes('pgTable') && !cleanedCode.includes('mysqlTable') && !cleanedCode.includes('sqliteTable')) {
      return {
        success: false,
        error: 'No Drizzle table definitions found. Make sure you have pgTable(), mysqlTable(), or sqliteTable() calls.'
      };
    }

    let ast: Node;
    try {
      // @ts-expect-error - acorn-typescript has type compatibility issues
      ast = Parser.extend(tsPlugin()).parse(cleanedCode, {
        sourceType: 'module',
        ecmaVersion: 'latest',
        locations: true,
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true
      }) as Node;
    } catch (parseError) {
      console.warn('AST parsing failed, trying fallback parser:', parseError);
      return parseDrizzleSchemaFallback(schemaCode);
    }

    const tables: ParsedTable[] = [];
    const relationships: ParsedRelationship[] = [];
    const enums: ParsedEnum[] = [];
    const sharedSchemas: { [key: string]: ObjectExpression } = {};

    // First pass: find shared schemas (like auditSchema) and enums
    walkAST(ast, (node: Node) => {
      if (node.type === 'VariableDeclaration') {
        node.declarations.forEach((declaration: VariableDeclarator) => {
          // Find pgEnum declarations
          if (
            declaration.init &&
            isCallExpression(declaration.init) &&
            isIdentifier(declaration.init.callee) &&
            declaration.init.callee.name === 'pgEnum'
          ) {
            const enumData = parseEnumFromAST(declaration);
            if (enumData) {
              enums.push(enumData);
            }
          }
          // Find shared schema objects
          else if (declaration.init && isObjectExpression(declaration.init) && isIdentifier(declaration.id)) {
            sharedSchemas[declaration.id.name] = declaration.init;
          }
        });
      }
    });

    // Second pass: find tables and apply shared schemas
    walkAST(ast, (node: Node) => {
      // Look for export const declarations that define tables
      if (
        node.type === 'ExportNamedDeclaration' &&
        node.declaration &&
        node.declaration.type === 'VariableDeclaration'
      ) {
        const varDeclaration = node.declaration as VariableDeclaration;
        const declaration = varDeclaration.declarations[0];
        if (
          declaration &&
          declaration.init &&
          isCallExpression(declaration.init)
        ) {
          // Handle direct pg/sqlite/mysql table calls 
          if (
            isIdentifier(declaration.init.callee) &&
            [
              'pgTable',
              'pgTableCreator',
              'sqliteTable',
              'sqliteTableCreator',
              'mysqlTable',
              'mysqlTableCreator',
            ].includes(declaration.init.callee.name)
          ) {
            const table = parseTableFromAST(declaration, tables.length, sharedSchemas);
            if (table) {
              tables.push(table);
            }
          }
          // Handle schema.table() calls (custom schemas)
          else if (isMemberExpression(declaration.init.callee) && isIdentifier(declaration.init.callee.property) && declaration.init.callee.property.name === 'table') {
            const table = parseTableFromAST(declaration, tables.length, sharedSchemas);
            if (table) {
              tables.push(table);
            }
          }
        }
      }
    });

    // Third pass: find relations
    walkAST(ast, (node: Node) => {
      if (
        node.type === 'VariableDeclaration' &&
        node.declarations[0] &&
        node.declarations[0].init &&
        isCallExpression(node.declarations[0].init) &&
        isIdentifier(node.declarations[0].init.callee) &&
        node.declarations[0].init.callee.name === 'relations'
      ) {
        const rels = parseRelationsFromAST(node.declarations[0]);
        relationships.push(...rels);
      }
    });

    // Fourth pass: find indexes and associate them with tables
    const tableMap = tables.reduce((acc, table) => {
      acc[table.id] = table;
      return acc;
    }, {} as { [key: string]: ParsedTable });

    walkAST(ast, (node: Node) => {
       if (
        node.type === 'VariableDeclaration' &&
        node.declarations[0] &&
        node.declarations[0].init &&
        isCallExpression(node.declarations[0].init) &&
        isIdentifier(node.declarations[0].init.callee) &&
        ['index', 'uniqueIndex'].includes(node.declarations[0].init.callee.name)
      ) {
        parseIndexFromAST(node.declarations[0], tableMap);
      }
    });

    // Extract relationships from the tables (for inline references)
    tables.forEach(table => {
      table.columns.forEach(column => {
        if (column.references) {
          relationships.push({
            id: generateRelationshipId(table.id, column.name, column.references.table),
            source: table.id,
            target: column.references.table,
            sourceColumn: column.name,
            targetColumn: column.references.column
          });
        }
      });
    });

    // Validate parsed data
    if (tables.length === 0 && enums.length === 0) {
      return {
        success: false,
        error: 'No valid Drizzle tables or enums found in the schema'
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
    console.error('Error parsing Drizzle schema:', error);
    // Try fallback parser as last resort
    try {
      return parseDrizzleSchemaFallback(schemaCode);
    } catch {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown parsing error'
      };
    }
  }
}

// Helper to parse relations
function parseRelationsFromAST(declaration: VariableDeclarator): ParsedRelationship[] {
  const parsedRelations: ParsedRelationship[] = [];
  try {
    if (!declaration.init || !isCallExpression(declaration.init)) return [];
    const callExpression = declaration.init;

    if (callExpression.arguments.length < 2) return [];

    const sourceTableNode = callExpression.arguments[0];
    if (!isIdentifier(sourceTableNode)) return [];
    const sourceTableName = sourceTableNode.name;
    
    const arrowFunc = callExpression.arguments[1];
    if (!isArrowFunctionExpression(arrowFunc) || !isObjectExpression(arrowFunc.body)) return [];
    
    const relationsObject = arrowFunc.body;
    relationsObject.properties.forEach((prop) => {
      if (!isProperty(prop) || !isCallExpression(prop.value)) return;
      const relCall = prop.value;

      if (!isIdentifier(relCall.callee)) return;
      const relType = relCall.callee.name; // 'one' or 'many'
      
      if (relType === 'one' && relCall.arguments.length > 1) {
        const targetTableNode = relCall.arguments[0];
        if (!isIdentifier(targetTableNode)) return;
        const targetTableName = targetTableNode.name;

        const config = relCall.arguments[1];
        if (config && isObjectExpression(config)) {
          const fieldsProp = config.properties.find((p): p is Property => isProperty(p) && isIdentifier(p.key) && p.key.name === 'fields');
          const referencesProp = config.properties.find((p): p is Property => isProperty(p) && isIdentifier(p.key) && p.key.name === 'references');
          
          if (fieldsProp && referencesProp && isArrayExpression(fieldsProp.value) && isArrayExpression(referencesProp.value)) {
            const fieldsElements = fieldsProp.value.elements;
            const refsElements = referencesProp.value.elements;

            if (fieldsElements.length > 0 && refsElements.length > 0) {
              const sourceElement = fieldsElements[0];
              const refElement = refsElements[0];

              if (isMemberExpression(sourceElement) && isMemberExpression(refElement) && isIdentifier(sourceElement.property) && isIdentifier(refElement.property)) {
                const sourceColumn = sourceElement.property.name;
                const targetColumn = refElement.property.name;
                
                parsedRelations.push({
                  id: generateRelationshipId(sourceTableName, sourceColumn, targetTableName),
                  source: sourceTableName,
                  target: targetTableName,
                  sourceColumn: sourceColumn,
                  targetColumn: targetColumn
                });
              }
            }
          }
        }
      }
      // 'many' relations are not visualized as direct connectors in this context
    });
  } catch (error) {
    console.error('Error parsing relations from AST:', error);
  }
  return parsedRelations;
}

// Helper to parse indexes
function parseIndexFromAST(declaration: VariableDeclarator, tableMap: { [key: string]: ParsedTable }) {
  try {
    if (!declaration.init || !isCallExpression(declaration.init) || !isIdentifier(declaration.id)) return;
    const callExpression = declaration.init;
    const indexName = declaration.id.name;

    if (!isIdentifier(callExpression.callee)) return;
    const isUnique = callExpression.callee.name === 'uniqueIndex';

    const onCall = callExpression.arguments[0];
    if(isCallExpression(onCall) && isMemberExpression(onCall.callee) && isIdentifier(onCall.callee.property) && onCall.callee.property.name === 'on') {
        const columns = onCall.arguments.map((col) => {
            if(isMemberExpression(col) && isIdentifier(col.property)) {
                return col.property.name;
            }
            return '';
        }).filter(Boolean);
        
        const onTableExpression = onCall.callee.object;
        if(isMemberExpression(onTableExpression) && isIdentifier(onTableExpression.object)) {
          const onTable = onTableExpression.object.name;
          const table = tableMap[onTable];

          if (table) {
              table.indexes.push({
                  name: indexName,
                  columns,
                  isUnique
              });
          }
        }
    }
  } catch (error) {
    console.error('Error parsing index from AST:', error);
  }
}


// Helper to parse enums
function parseEnumFromAST(declaration: VariableDeclarator): ParsedEnum | null {
  try {
    if (!isIdentifier(declaration.id) || !declaration.init || !isCallExpression(declaration.init)) return null;

    const enumName = declaration.id.name;
    const callExpression = declaration.init;
    
    if (callExpression.arguments.length < 2) return null;

    // First argument should be the enum name (string literal)
    const enumDbName = callExpression.arguments[0];
    if (!isLiteral(enumDbName)) return null;

    // Second argument should be the values array
    const valuesNode = callExpression.arguments[1];
    if (!isArrayExpression(valuesNode)) return null;

    const values = valuesNode.elements.map((el) => {
      if (isLiteral(el) && typeof el.value === 'string') {
        return el.value;
      }
      return '';
    }).filter(Boolean);
    
    return {
      name: enumName,
      values
    };
  } catch (error) {
    console.error('Error parsing enum from AST:', error);
    return null;
  }
}

// Helper function to walk through AST nodes
function walkAST(node: Node, callback: (node: Node) => void) {
  callback(node);
  
  for (const key in node) {
    if (key === 'parent') continue;
    const child = (node as unknown as Record<string, unknown>)[key];
    
    if (Array.isArray(child)) {
      child.forEach(item => {
        if (item && typeof item === 'object' && 'type' in item && typeof item.type === 'string') {
          walkAST(item as Node, callback);
        }
      });
    } else if (child && typeof child === 'object' && 'type' in child && typeof child.type === 'string') {
      walkAST(child as Node, callback);
    }
  }
}

// Parse a table definition from AST node
function parseTableFromAST(declaration: VariableDeclarator, tableIndex: number, sharedSchemas: { [key: string]: ObjectExpression }): ParsedTable | null {
  try {
    if(!isIdentifier(declaration.id) || !declaration.init || !isCallExpression(declaration.init)) return null;

    const tableName = declaration.id.name;
    const callExpression = declaration.init;
    
    // Handle different table creation patterns
    let tableNameNode: Node | null = null;
    let columnsNode: Node | null = null;
    
    // Handle xTable('name', { columns }) or schema.table('name', { columns })
    if (callExpression.arguments.length >= 2) {
      tableNameNode = callExpression.arguments[0];
      columnsNode = callExpression.arguments[1];
    }
    // Handle xTableCreator(schema)('name', { columns })
    else if (callExpression.arguments.length === 1 && isCallExpression(callExpression.callee)) {
      const innerCall = callExpression.callee;
      if (innerCall.arguments.length >= 2) {
        tableNameNode = innerCall.arguments[0];
        columnsNode = innerCall.arguments[1];
      }
    }
    
    if (!tableNameNode || !columnsNode || !isLiteral(tableNameNode) || !isObjectExpression(columnsNode)) return null;
    
    const actualTableName = String(tableNameNode.value);
    const columns: ParsedColumn[] = [];

    // Parse columns from object properties, handling spreads
    columnsNode.properties.forEach((prop) => {
      if (prop.type === 'Property') {
        const column = parseColumnFromAST(prop);
        if (column) {
          columns.push(column);
        }
      } else if (prop.type === 'SpreadElement' && isIdentifier(prop.argument)) {
        const schemaName = prop.argument.name;
        if (sharedSchemas[schemaName]) {
          sharedSchemas[schemaName].properties.forEach((sharedProp) => {
             if (isProperty(sharedProp)) {
                const column = parseColumnFromAST(sharedProp);
                if (column) {
                  columns.push(column);
                }
              }
          });
        }
      }
    });

    return {
      id: tableName,
      name: actualTableName,
      columns,
      indexes: [], // Will be populated later
      position: generateTablePosition(tableIndex)
    };
  } catch (error) {
    console.error('Error parsing table from AST:', error);
    return null;
  }
}

// Parse a column definition from AST node
function parseColumnFromAST(prop: Property): ParsedColumn | null {
  try {
    if (!isIdentifier(prop.key)) return null;
    const columnName = prop.key.name;
    const columnExpression = prop.value;
    
    // Handle chained method calls (e.g., serial('id').primaryKey())
    const chainedCalls: string[] = [];
    let currentExpr: Node = columnExpression;
    
    while (isCallExpression(currentExpr)) {
      if (isMemberExpression(currentExpr.callee) && isIdentifier(currentExpr.callee.property)) {
        chainedCalls.unshift(currentExpr.callee.property.name);
        currentExpr = currentExpr.callee.object;
      } else {
        break;
      }
    }
    
    // Get the base type (e.g., 'serial', 'varchar', 'integer')
    let columnType = '';
    const columnArgs: (string | number)[] = [];
    if (isCallExpression(currentExpr) && isIdentifier(currentExpr.callee)) {
      columnType = currentExpr.callee.name || '';
      if(currentExpr.arguments) {
        currentExpr.arguments.forEach((arg) => {
          if (isObjectExpression(arg)) {
             const props = arg.properties.map((p) => {
                if(isProperty(p) && isIdentifier(p.key) && isLiteral(p.value)) {
                    return `${p.key.name}: ${p.value.value}`;
                }
                return '';
            }).filter(Boolean).join(', ');
             columnArgs.push(`{ ${props} }`);
          } else if (isLiteral(arg) && (typeof arg.value === 'string' || typeof arg.value === 'number')) {
            columnArgs.push(arg.value);
          }
        });
      }
    }
    
    // Map Drizzle column types to more readable format
    const typeMapping: { [key: string]: string } = {
      'bigint': 'bigint',
      'bigserial': 'bigserial', 
      'bit': 'bit',
      'boolean': 'boolean',
      'bytea': 'bytea',
      'char': 'char',
      'cidr': 'cidr',
      'date': 'date',
      'doublePrecision': 'double precision',
      'inet': 'inet',
      'integer': 'integer',
      'interval': 'interval',
      'json': 'json',
      'jsonb': 'jsonb',
      'macaddr': 'macaddr',
      'macaddr8': 'macaddr8',
      'numeric': 'numeric',
      'decimal': 'decimal',
      'pgEnum': 'enum',
      'point': 'point',
      'real': 'real',
      'blob': 'blob',
      'serial': 'serial',
      'smallint': 'smallint',
      'smallserial': 'smallserial',
      'text': 'text',
      'time': 'time',
      'timestamp': 'timestamp',
      'timestamptz': 'timestamptz',
      'uuid': 'uuid',
      'varchar': 'varchar',
      'vector': 'vector',
      'xml': 'xml'
    };
    
    const displayType = typeMapping[columnType] || columnType;
    
    // Check for modifiers
    const isPrimaryKey = chainedCalls.includes('primaryKey');
    const isUnique = chainedCalls.includes('unique');
    const isNotNull = chainedCalls.includes('notNull');
    
    // Check for references
    let references: { table: string; column: string } | undefined;
    if (chainedCalls.includes('references')) {
      references = parseReferencesFromAST(columnExpression);
    }

    // Parse default values
    let defaultValue: string | undefined;
    const defaultCallIndex = chainedCalls.findIndex(call => ['default', 'defaultNow', 'defaultRandom'].includes(call));
    if (defaultCallIndex !== -1) {
      const defaultCall = chainedCalls[defaultCallIndex];
      if (defaultCall === 'defaultNow') {
        defaultValue = 'now()';
      } else if (defaultCall === 'defaultRandom') {
        defaultValue = 'gen_random_uuid()';
      } else {
        defaultValue = 'default';
      }
    }

    return {
      name: columnName,
      type: `${displayType}${columnArgs.length > 0 ? `(${columnArgs.join(', ')})` : ''}`,
      isPrimaryKey,
      isUnique,
      isNotNull,
      references,
      defaultValue
    };
  } catch (error) {
    console.error('Error parsing column from AST:', error);
    return null;
  }
}

// Parse references from AST node
function parseReferencesFromAST(expr: Node): { table: string; column: string } | undefined {
  try {
    // Look for .references(() => tableName.columnName) pattern
    let currentExpr: Node = expr;
    
    while (isCallExpression(currentExpr)) {
      if (
        isMemberExpression(currentExpr.callee) &&
        isIdentifier(currentExpr.callee.property) &&
        currentExpr.callee.property.name === 'references' &&
        currentExpr.arguments.length > 0
      ) {
        const referencesArg = currentExpr.arguments[0];
        
        // Handle arrow function: () => tableName.columnName
        if (isArrowFunctionExpression(referencesArg) && isMemberExpression(referencesArg.body)) {
          const body = referencesArg.body;
          
          if (isIdentifier(body.object) && isIdentifier(body.property)) {
            const tableName = body.object.name;
            const columnName = body.property.name;
            
            return {
              table: tableName,
              column: columnName
            };
          }
        }
        break;
      }
      
      if (isMemberExpression(currentExpr.callee)) {
        currentExpr = currentExpr.callee.object;
      } else {
        break;
      }
    }
    
    return undefined;
  } catch (error) {
    console.error('Error parsing references from AST:', error);
    return undefined;
  }
}

// Fallback regex-based parser for simpler cases
export function parseDrizzleSchemaFallback(schemaCode: string): ParseResult {
  try {
    const tables: ParsedTable[] = [];
    const relationships: ParsedRelationship[] = [];
    const enums: ParsedEnum[] = [];
    
    // Match enum definitions
    const enumRegex = /export const (\w+) = pgEnum\('[^']+',\s*\[([^\]]+)\]/g;
    let enumMatch;
    while ((enumMatch = enumRegex.exec(schemaCode)) !== null) {
      const [, enumName, valuesStr] = enumMatch;
      const values = valuesStr.split(',').map(v => v.trim().replace(/['"]/g, ''));
      enums.push({ name: enumName, values });
    }
    
    // Match table definitions - support pg/sqlite/mysql and their *TableCreator variants
    const tableRegex = /export const (\w+) = (?:(?:pg|sqlite|mysql)Table|(?:pg|sqlite|mysql)TableCreator(?:\([^)]+\))?)\('(\w+)',\s*{([^}]+)}/gs;
    let tableMatch;

    while ((tableMatch = tableRegex.exec(schemaCode)) !== null) {
      const [, constName, tableName, columnsStr] = tableMatch;
      
      // Parse columns
      const columns: ParsedColumn[] = [];
      const columnRegex = /(\w+):\s*(\w+)\([^)]*\)([^,\n]*)/g;
      let columnMatch;
      
      while ((columnMatch = columnRegex.exec(columnsStr)) !== null) {
        const [, columnName, columnType, modifiers] = columnMatch;
        
        // Parse modifiers and references using utilities
        const parsedModifiers = parseColumnModifiers(modifiers);
        const references = extractReferences(modifiers);
        
        columns.push({
          name: columnName,
          type: columnType,
          isPrimaryKey: parsedModifiers.isPrimaryKey,
          isUnique: parsedModifiers.isUnique,
          isNotNull: parsedModifiers.isNotNull,
          references
        });
      }

      tables.push({
        id: constName,
        name: tableName,
        columns,
        indexes: [],
        position: generateTablePosition(tables.length)
      });
    }

    // Extract relationships
    tables.forEach(table => {
      table.columns.forEach(column => {
        if (column.references) {
          relationships.push({
            id: generateRelationshipId(table.id, column.name, column.references.table),
            source: table.id,
            target: column.references.table,
            sourceColumn: column.name,
            targetColumn: column.references.column
          });
        }
      });
    });

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
