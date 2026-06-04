/**
 * Insights Command
 *
 * Outputs spec relation edges as ExternalInsight JSON for agent-contracts-analyzer.
 */

import { createSpeckeeperInsightProvider } from '../external/insight-provider.js';

export interface InsightsCommandOptions {
  format?: 'json';
  projectRoot?: string;
  config?: string;
}

export async function insightsCommand(options: InsightsCommandOptions): Promise<void> {
  const projectRoot = options.projectRoot ?? process.cwd();
  const format = options.format ?? 'json';

  if (format !== 'json') {
    console.error(`Unsupported format: ${format}. Only "json" is supported.`);
    process.exit(1);
  }

  try {
    const provider = createSpeckeeperInsightProvider(options.config);
    const insight = await provider.provide({ projectRoot });
    console.log(JSON.stringify(insight));
  } catch (error) {
    console.error('Insights export failed:', error);
    process.exit(1);
  }
}
