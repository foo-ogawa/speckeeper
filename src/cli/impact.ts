/**
 * Impact Command
 * 
 * Analyze the impact scope of changes
 */

import chalk from 'chalk';
import { loadConfig } from '../utils/config-loader.js';
import { loadAllModels, type ModelRegistry } from '../utils/model-loader.js';

// ============================================================================
// Types
// ============================================================================

export interface ImpactCommandOptions {
  config?: string;
  depth?: string;
  direction?: 'upstream' | 'downstream' | 'both';
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
  console.log(chalk.blue('spects impact'));
  console.log('');
  
  if (!targetId) {
    console.error(chalk.red('Error: ID is required'));
    console.log(chalk.gray('  Usage: spects impact <id>'));
    process.exit(1);
  }
  
  const cwd = process.cwd();
  const config = await loadConfig(options.config);
  const maxDepth = options.depth ? parseInt(options.depth, 10) : 3;
  
  console.log(chalk.gray(`  Target: ${targetId}`));
  console.log(chalk.gray(`  Depth:  ${maxDepth}`));
  console.log('');
  
  try {
    // Load all models
    console.log(chalk.blue('  Loading models...'));
    const { registry } = await loadAllModels(config, cwd);
    
    // Find target
    const target = findById(registry, targetId);
    if (!target) {
      console.error(chalk.red(`  Error: Target '${targetId}' not found`));
      process.exit(1);
    }
    
    // Analyze impact
    console.log(chalk.blue('  Analyzing impact...'));
    const result = analyzeImpact(registry, targetId, target.type, maxDepth);
    
    // Output results
    outputImpactResults(result, options);
    
  } catch (error) {
    console.error(chalk.red('Impact analysis failed:'), error);
    process.exit(1);
  }
}

// ============================================================================
// Impact Analysis
// ============================================================================

function findById(registry: ModelRegistry, id: string): { type: string; data: unknown } | null {
  for (const [type, map] of Object.entries(registry)) {
    if (map instanceof Map && map.has(id)) {
      return { type, data: map.get(id) };
    }
  }
  return null;
}

function analyzeImpact(
  registry: ModelRegistry,
  targetId: string,
  targetType: string,
  maxDepth: number
): ImpactResult {
  const impactedNodes: ImpactNode[] = [];
  const visited = new Set<string>([targetId]);
  
  // Find references to the target
  function findReferences(id: string, depth: number): void {
    if (depth > maxDepth) return;
    
    for (const [type, map] of Object.entries(registry)) {
      if (!(map instanceof Map)) continue;
      
      for (const [itemId, item] of map) {
        if (visited.has(itemId)) continue;
        
        // Check if this item references the target
        const itemStr = JSON.stringify(item);
        if (itemStr.includes(`"${id}"`)) {
          visited.add(itemId);
          impactedNodes.push({
            id: itemId,
            type,
            depth,
            impactType: depth === 1 ? 'direct' : 'indirect',
          });
          
          // Recursively find references to this item
          findReferences(itemId, depth + 1);
        }
      }
    }
  }
  
  findReferences(targetId, 1);
  
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
  console.log('');
  
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
  
  // Default text format
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
