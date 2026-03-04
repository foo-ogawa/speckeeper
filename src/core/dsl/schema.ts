/**
 * Core DSL — Base spec schema
 *
 * Common schema fields shared by all models: id, name, description, relations.
 * Models extend this with domain-specific fields via `.extend()`.
 */
import { z } from 'zod';
import { RelationSchema } from '../relation.js';

export const baseSpecSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string(),
  relations: z.array(RelationSchema).optional(),
});

export type BaseSpec = z.infer<typeof baseSpecSchema>;
