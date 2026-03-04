/**
 * Core DSL — Exporter factories
 *
 * Factory functions that produce Exporter<T> objects from declarative config.
 */
import type { Exporter } from '../model.js';

interface MetaField<T> {
  key: keyof T & string;
  label?: string;
}

interface SectionConfig<T> {
  heading: string;
  field?: keyof T & string;
  render?: (spec: T) => string;
  optional?: boolean;
}

interface ColumnConfig<T> {
  key: keyof T & string;
  label?: string;
  render?: (value: unknown, spec: T) => string;
}

export interface MarkdownExporterConfig<T> {
  outputDir: string;
  single?: {
    title: keyof T & string | ((spec: T) => string);
    meta?: Array<keyof T & string | MetaField<T>>;
    sections?: SectionConfig<T>[];
  };
  index?: {
    title?: string;
    columns: Array<keyof T & string | ColumnConfig<T>>;
  };
}

/**
 * Create a markdown exporter from declarative configuration.
 */
export function markdownExporter<T extends { id: string }>(
  config: MarkdownExporterConfig<T>,
): Exporter<T> {
  const exporter: Exporter<T> = {
    format: 'markdown',
    outputDir: config.outputDir,
    filename: (spec) => spec.id,
  };

  if (config.single) {
    const singleCfg = config.single;
    exporter.single = (spec) => {
      const lines: string[] = [];

      const title = typeof singleCfg.title === 'function'
        ? singleCfg.title(spec)
        : String((spec as Record<string, unknown>)[singleCfg.title] ?? '');
      lines.push(`# ${title}`, '');

      if (singleCfg.meta) {
        for (const m of singleCfg.meta) {
          const key = typeof m === 'string' ? m : m.key;
          const label = typeof m === 'string' ? key : (m.label ?? m.key);
          const value = (spec as Record<string, unknown>)[key];
          if (value !== undefined && value !== null) {
            lines.push(`**${label}**: ${String(value)}`);
          }
        }
        lines.push('');
      }

      if (singleCfg.sections) {
        for (const section of singleCfg.sections) {
          let content: string | undefined;
          if (section.render) {
            content = section.render(spec);
          } else if (section.field) {
            const value = (spec as Record<string, unknown>)[section.field];
            if (typeof value === 'string') content = value;
          }
          if (section.optional && !content) continue;
          lines.push(`## ${section.heading}`, '');
          if (content) lines.push(content, '');
        }
      }

      return lines.join('\n');
    };
  }

  if (config.index) {
    const indexCfg = config.index;
    exporter.index = (specs) => {
      const lines: string[] = [];
      const title = indexCfg.title ?? 'Index';
      lines.push(`# ${title}`, '');

      const columns = indexCfg.columns.map(c =>
        typeof c === 'string' ? { key: c, label: c } : { key: c.key, label: c.label ?? c.key, render: c.render },
      );

      lines.push('| ' + columns.map(c => c.label).join(' | ') + ' |');
      lines.push('| ' + columns.map(() => '---').join(' | ') + ' |');

      for (const spec of specs) {
        const cells = columns.map(col => {
          const value = (spec as Record<string, unknown>)[col.key];
          if ('render' in col && col.render) return col.render(value, spec);
          if (col.key === 'id') return `[${value}](./${value}.md)`;
          return String(value ?? '-');
        });
        lines.push('| ' + cells.join(' | ') + ' |');
      }

      return lines.join('\n');
    };
  }

  return exporter;
}
