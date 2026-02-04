/**
 * Model List Output Embed
 * 
 * Retrieves the list of registered models from design/_models/ and outputs them in the specified format.
 * All model information is dynamically retrieved from the Model class.
 */

import { defineEmbed, type EmbedContext } from 'embedoc';
import { allModels } from '../design/_models/index.ts';

interface ModelInfo {
  id: string;
  name: string;
  idPrefix: string;
  level: string | undefined;
  description: string;
  externalSsotType: string;
  hasLint: boolean;
  hasExporter: boolean;
  hasExternalChecker: boolean;
  hasCoverageChecker: boolean;
}

const LEVEL_LABELS: Record<string, string> = {
  'L0': 'L0: Business + Domain',
  'L1': 'L1: Requirements',
  'L2': 'L2: Design',
  'L3': 'L3: Detailed Design / Implementation',
};

function getModelInfoList(): ModelInfo[] {
  return allModels.map(model => ({
    id: model.id,
    name: model.name,
    idPrefix: model.idPrefix,
    level: model.level,
    description: model.description || '',
    externalSsotType: model.externalSsotType || '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hasLint: (model as any).lintRules?.length > 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hasExporter: (model as any).exporters?.length > 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hasExternalChecker: !!(model as any).externalChecker,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hasCoverageChecker: !!(model as any).coverageChecker,
  }));
}

export const models = defineEmbed({
  async render(ctx: EmbedContext) {
    const { format = 'table', id, phase } = ctx.params;
    
    let modelList = getModelInfoList();
    if (phase) modelList = modelList.filter(m => m.level === phase);
    if (id) modelList = modelList.filter(m => m.id === id);
    
    if (modelList.length === 0) return { content: '*No matching models found*' };
    
    switch (format) {
      case 'detail': return { content: renderDetail(modelList[0]) };
      case 'catalog': return { content: renderCatalog(getModelInfoList()) };
      case 'full-table': return { content: renderFullTable(modelList) };
      case 'table':
      default: return { content: renderTable(modelList, ctx) };
    }
  },
});

function renderTable(modelList: ModelInfo[], ctx: EmbedContext): string {
  return ctx.markdown.table(
    ['Model ID', 'Name', 'ID Prefix', 'Level', 'Description'],
    modelList.map(m => [`\`${m.id}\``, m.name, `\`${m.idPrefix}\``, m.level || '-', m.description || '-'])
  );
}

function renderFullTable(modelList: ModelInfo[]): string {
  const levelOrder = ['L0', 'L1', 'L2', 'L3', undefined];
  modelList.sort((a, b) => levelOrder.indexOf(a.level as string) - levelOrder.indexOf(b.level as string));
  
  const lines = [
    '| Model ID | Name | Level | Lint | Export | External SSOT | Coverage | Description |',
    '|----------|------|-------|------|--------|---------------|----------|-------------|',
  ];
  
  for (const m of modelList) {
    const lint = m.hasLint ? '✅' : '❌';
    const exporter = m.hasExporter ? '✅' : '❌';
    const external = m.hasExternalChecker 
      ? `✅ ${m.externalSsotType}` 
      : (m.externalSsotType ? `❌ ${m.externalSsotType}` : '-');
    const coverage = m.hasCoverageChecker ? '✅' : '-';
    lines.push(`| \`${m.id}\` | ${m.name} | ${m.level || '-'} | ${lint} | ${exporter} | ${external} | ${coverage} | ${m.description || '-'} |`);
  }
  
  return lines.join('\n');
}

function renderDetail(model: ModelInfo): string {
  return [
    `### ${model.name}`, '',
    `- **Model ID**: \`${model.id}\``,
    `- **ID Prefix**: \`${model.idPrefix}\``,
    `- **Level**: ${model.level || '-'}`,
    `- **Lint**: ${model.hasLint ? '✅' : '❌'}`,
    `- **Export**: ${model.hasExporter ? '✅' : '❌'}`,
    `- **External SSOT**: ${model.hasExternalChecker ? '✅' : '-'}`,
    `- **Coverage**: ${model.hasCoverageChecker ? '✅' : '-'}`, '',
    model.description || '',
  ].join('\n');
}

function renderCatalog(modelList: ModelInfo[]): string {
  const lines: string[] = [];
  const byLevel = new Map<string, ModelInfo[]>();
  
  for (const model of modelList) {
    const level = model.level || 'unknown';
    const list = byLevel.get(level) || [];
    list.push(model);
    byLevel.set(level, list);
  }
  
  for (const level of ['L0', 'L1', 'L2', 'L3', 'unknown']) {
    const levelModels = byLevel.get(level);
    if (!levelModels?.length) continue;
    
    lines.push(`### ${LEVEL_LABELS[level] || level}`, '', '| Model ID | Name | ID Prefix | Description |', '|----------|------|-----------|-------------|');
    for (const m of levelModels) {
      lines.push(`| \`${m.id}\` | ${m.name} | \`${m.idPrefix}\` | ${m.description || '-'} |`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

console.log(`Model list embed loaded: ${allModels.length} models`);
