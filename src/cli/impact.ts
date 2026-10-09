/**
 * Impact Command
 * 
 * Analyze the impact scope of changes
 */

import chalk from 'chalk';
import { loadConfig } from '../utils/config-loader.js';
import {
  buildReferenceGraph,
  traverseReferenceGraph,
  type ReferenceDirection,
  type ReferenceGraph,
} from '../core/model.js';

// ============================================================================
// Types
// ============================================================================

export interface ImpactCommandOptions {
  config?: string;
  depth?: string;
  direction?: ReferenceDirection;
  format?: 'text' | 'json' | 'mermaid';
}

export interface ImpactNode {
  id: string;
  type: string;
  depth: number;
  impactType: 'direct' | 'indirect';
}

export interface ImpactResult {
  target: string;
  targetType: string;
  impactedNodes: ImpactNode[];
}

// ============================================================================
// Impact Command
// ============================================================================

export async function impactCommand(targetId: string, options: ImpactCommandOptions): Promise<void> {
  console.error(chalk.blue('speckeeper impact'));
  console.error('');
  
  if (!targetId) {
    console.error(chalk.red('Error: ID is required'));
    console.error(chalk.gray('  Usage: speckeeper impact <id>'));
    process.exitCode = 1;
    return;
  }
  
  const config = await loadConfig(options.config);
  const maxDepth = options.depth ? parseInt(options.depth, 10) : 3;
  const direction = options.direction ?? 'both';
  
  console.error(chalk.gray(`  Target:    ${targetId}`));
  console.error(chalk.gray(`  Depth:     ${maxDepth}`));
  console.error(chalk.gray(`  Direction: ${direction}`));
  console.error('');
  
  try {
    const graph = buildReferenceGraph(config.specs);
    
    const target = graph.nodes.find(node => node.id === targetId);
    if (!target) {
      console.error(chalk.red(`  Error: Target '${targetId}' not found`));
      process.exitCode = 1;
      return;
    }
    
    console.error(chalk.blue('  Analyzing impact...'));
    const result = analyzeImpact(graph, targetId, target.model, maxDepth, direction);
    
    outputImpactResults(result, options);
    
  } catch (error) {
    console.error(chalk.red('Impact analysis failed:'), error);
    process.exitCode = 1;
  }
}

// ============================================================================
// Impact Analysis
// ============================================================================

function analyzeImpact(
  graph: ReferenceGraph,
  targetId: string,
  targetType: string,
  maxDepth: number,
  direction: ReferenceDirection,
): ImpactResult {
  const impactedNodes = traverseReferenceGraph(graph, targetId, { depth: maxDepth, direction })
    .map((reached): ImpactNode => ({
      id: reached.id,
      type: reached.model,
      depth: reached.depth,
      impactType: reached.depth === 1 ? 'direct' : 'indirect',
    }));
  
  return {
    target: targetId,
    targetType,
    impactedNodes,
  };
}

// ============================================================================
// Output
// ============================================================================

function outputImpactResults(result: ImpactResult, options: ImpactCommandOptions): void {
  console.error('');
  
  if (options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  if (options.format === 'mermaid') {
    console.log('```mermaid');
    console.log('graph TD');
    console.log(`    ${result.target}[${result.target}]`);
    for (const node of result.impactedNodes) {
      const style = node.impactType === 'direct' ? '-->|direct|' : '-.->|indirect|';
      console.log(`    ${result.target} ${style} ${node.id}[${node.id}]`);
    }
    console.log('```');
    return;
  }
  
  if (result.impactedNodes.length === 0) {
    console.log(chalk.green('  No impacted elements found'));
    return;
  }
  
  const direct = result.impactedNodes.filter(n => n.impactType === 'direct');
  const indirect = result.impactedNodes.filter(n => n.impactType === 'indirect');
  
  if (direct.length > 0) {
    console.log(chalk.yellow(`  Direct impact (${direct.length}):`));
    for (const node of direct) {
      console.log(chalk.yellow(`    → ${node.id} (${node.type})`));
    }
  }
  
  if (indirect.length > 0) {
    console.log(chalk.gray(`  Indirect impact (${indirect.length}):`));
    for (const node of indirect) {
      console.log(chalk.gray(`    ⤳ ${node.id} (${node.type}, depth: ${node.depth})`));
    }
  }
  
  console.log('');
  console.log(chalk.gray(`  Total: ${result.impactedNodes.length} impacted elements`));
}
