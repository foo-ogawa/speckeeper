/**
 * Core DSL — External SSOT reference schemas
 *
 * A reference points at something owned by an external tool: an OpenAPI
 * operation, a table in a DDL, a resource in an IaC template, a batch
 * definition. Each reference carries the file the target lives in and the
 * identifier that locates it there.
 *
 * Associations to components and entities are declared through the inherited
 * `relations` field, so a reference's links are checked by the same reference
 * integrity rule as every other element.
 */
import { z } from 'zod';
import { baseSpecSchema } from './schema.js';

/**
 * Where an external SSOT target lives.
 */
export const externalRefSourceSchema = z.object({
  /** Path or glob of the external SSOT file */
  path: z.string().min(1),
  /** Identifier locating the target inside that file */
  identifier: z.string().min(1),
});

export type ExternalRefSource = z.infer<typeof externalRefSourceSchema>;

/**
 * Fields every external SSOT reference shares.
 */
export const externalRefSchema = baseSpecSchema.extend({
  source: externalRefSourceSchema,
});

export type ExternalRef = z.input<typeof externalRefSchema>;

/** Reference to an OpenAPI operation */
export const apiRefSchema = externalRefSchema.extend({
  sourceType: z.literal('openapi').default('openapi'),
});

/** Reference to a table in a DDL or Prisma schema */
export const tableRefSchema = externalRefSchema.extend({
  sourceType: z.literal('ddl').default('ddl'),
});

/** Reference to a resource in a CloudFormation or Terraform template */
export const iacRefSchema = externalRefSchema.extend({
  sourceType: z.literal('iac').default('iac'),
});

/** Reference to a batch definition (Step Functions, EventBridge, ...) */
export const batchRefSchema = externalRefSchema.extend({
  sourceType: z.literal('batch').default('batch'),
});

export type APIRef = z.input<typeof apiRefSchema>;
export type TableRef = z.input<typeof tableRefSchema>;
export type IaCRef = z.input<typeof iacRefSchema>;
export type BatchRef = z.input<typeof batchRefSchema>;
