/**
 * Core DSL — Lint rule factories
 *
 * Factory functions that produce LintRule<T> objects for common patterns.
 * Users compose these in their model's `lintRules` array.
 */
import type { LintRule } from '../model.js';

/**
 * Require a string field to be non-empty.
 */
export function requireField<T>(
  field: keyof T & string,
  severity: 'error' | 'warning' | 'info' = 'warning',
): LintRule<T> {
  return {
    id: `has-${field}`,
    severity,
    message: `${field} must not be empty`,
    check: (spec) => {
      const value = (spec as Record<string, unknown>)[field];
      return !value || (typeof value === 'string' && value.trim() === '');
    },
  };
}

/**
 * Require an array field to have at least `min` elements.
 */
export function arrayMinLength<T>(
  field: keyof T & string,
  min: number,
  severity: 'error' | 'warning' = 'error',
): LintRule<T> {
  return {
    id: `${field}-min-${min}`,
    severity,
    message: `${field} must have at least ${min} item(s)`,
    check: (spec) => {
      const value = (spec as Record<string, unknown>)[field];
      return !Array.isArray(value) || value.length < min;
    },
  };
}

/**
 * Require the `id` field to match a prefix-based format.
 *
 * Default pattern: `{prefix}-{NNN}` (e.g. `FR-001`).
 * Override with `opts.pattern` for custom formats.
 */
export function idFormat<T>(
  prefix: string,
  opts?: { digits?: number; pattern?: RegExp },
): LintRule<T> {
  const pattern = opts?.pattern
    ?? new RegExp(`^${prefix}-\\d{${opts?.digits ?? 3}}$`);

  return {
    id: 'id-format',
    severity: 'warning',
    message: `ID should match format ${pattern}`,
    check: (spec) => {
      const id = (spec as Record<string, unknown>)['id'];
      return typeof id !== 'string' || !pattern.test(id);
    },
  };
}

/**
 * Require child element IDs to follow parent ID (e.g. `FR-001-01`).
 */
export function childIdFormat<T>(
  arrayField: keyof T & string,
  idField: string,
): LintRule<T> {
  return {
    id: `${arrayField}-id-format`,
    severity: 'warning',
    message: `${arrayField} IDs should follow parent ID pattern`,
    check: (spec) => {
      const parentId = (spec as Record<string, unknown>)['id'] as string;
      const children = (spec as Record<string, unknown>)[arrayField];
      if (!Array.isArray(children) || !parentId) return false;
      return children.some((child: Record<string, unknown>) => {
        const childId = child[idField];
        return typeof childId === 'string' && !childId.startsWith(parentId + '-');
      });
    },
  };
}
