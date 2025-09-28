import { SchemaValidationStatus } from './types';

export const formatTableCount = (count: number): string => {
  return `📊 ${count} table${count !== 1 ? 's' : ''}`;
};

export const formatRelationshipCount = (count: number): string => {
  return `🔗 ${count} relationship${count !== 1 ? 's' : ''}`;
};

export const formatValidationStatus = (status: SchemaValidationStatus): string => {
  switch (status) {
    case SchemaValidationStatus.VALID:
      return '✅ Schema valid';
    case SchemaValidationStatus.INVALID:
      return '❌ Schema invalid';
    case SchemaValidationStatus.PENDING:
      return '⏳ Validating...';
    default:
      return '';
  }
};