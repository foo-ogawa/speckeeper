/**
 * File Reference Embed
 * 
 * Extracts and displays code snippets from specified files.
 */

import { defineEmbed } from 'embedoc';
import fs from 'node:fs';
import path from 'node:path';

const LANG_MAP: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
  '.mjs': 'javascript', '.yaml': 'yaml', '.yml': 'yaml', '.json': 'json', '.md': 'markdown',
  '.sql': 'sql', '.sh': 'bash', '.bash': 'bash', '.hbs': 'handlebars', '.py': 'python',
  '.rb': 'ruby', '.go': 'go', '.rs': 'rust', '.java': 'java', '.c': 'c', '.cpp': 'cpp',
  '.h': 'c', '.hpp': 'cpp', '.css': 'css', '.scss': 'scss', '.html': 'html', '.xml': 'xml',
};

function detectLanguage(filePath: string): string {
  return LANG_MAP[path.extname(filePath).toLowerCase()] || '';
}

export const codeSnippet = defineEmbed({
  async render(ctx) {
    const filePath = ctx.params['file'];
    const startLine = parseInt(ctx.params['start'] || '1', 10);
    const endLine = ctx.params['end'] ? parseInt(ctx.params['end'], 10) : undefined;
    const lang = ctx.params['lang'] || detectLanguage(filePath || '');
    const title = ctx.params['title'];
    const noSource = ctx.params['no_source'] === 'true';

    if (!filePath) {
      return { content: '⚠️ `file` parameter is required' };
    }

    const resolvedPath = path.resolve(process.cwd(), filePath);
    
    if (!fs.existsSync(resolvedPath)) {
      return { content: `⚠️ File not found: ${filePath}` };
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const lines = content.split('\n');
    const start = Math.max(1, startLine) - 1;
    const end = endLine ? Math.min(endLine, lines.length) : lines.length;
    const snippet = lines.slice(start, end).join('\n');
    const codeBlock = ctx.markdown.codeBlock(snippet, lang);

    const parts: string[] = [];
    if (title) parts.push(`**${title}**\n`);
    parts.push(codeBlock);
    
    if (!noSource) {
      const lineRange = endLine 
        ? `${startLine}-${end}` 
        : startLine > 1 
          ? `${startLine}-${lines.length}` 
          : 'full';
      parts.push(`\n📄 Source: \`${filePath}\` (lines ${lineRange})`);
    }

    return { content: parts.join('\n') };
  },
});

console.log('File reference embed loaded');
