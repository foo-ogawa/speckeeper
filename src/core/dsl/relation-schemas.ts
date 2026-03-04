/**
 * Core DSL — Edge-typed relation schemas
 *
 * Specialized relation schemas for `implements` and `verifiedBy` edges.
 * These carry additional properties beyond the generic RelationSchema.
 */
import { z } from 'zod';

export const ImplementsRelationSchema = z.object({
  target: z.string(),
  targetType: z.string(),
  sourcePath: z.string().optional(),
  description: z.string().optional(),
});

export type ImplementsRelation = z.infer<typeof ImplementsRelationSchema>;

export const VerifiedByRelationSchema = z.object({
  target: z.string(),
  testPath: z.string().optional(),
  framework: z.string().optional(),
  description: z.string().optional(),
});

export type VerifiedByRelation = z.infer<typeof VerifiedByRelationSchema>;
