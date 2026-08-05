/**
 * FR-1104: TypeScript to YAML conversion — speckeeper convert
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse as parseYaml } from 'yaml';
import { runConvert } from '../../src/cli/convert.js';
import { defineSpecs } from '../../src/core/model.js';

const termSpecs = [
  { id: 'TERM-001', term: 'SSoT', definition: 'Single Source of Truth', category: 'acronym' },
  { id: 'TERM-002', term: 'DSL', definition: 'Domain Specific Language', category: 'technical' },
];

/**
 * Writes a spec module whose default export has the shape defineSpecs() builds.
 * runConvert() imports the file, so it has to stand alone as ESM.
 */
function writeSpecModule(dir: string, filename: string): string {
  const path = join(dir, filename);
  writeFileSync(
    path,
    `export default { entries: [{ model: { id: 'term' }, data: ${JSON.stringify(termSpecs)} }] };\n`,
  );
  return path;
}

describe('FR-1104: runConvert', () => {
  let tempDir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'speckeeper-convert-'));
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('FR-1104-01: a SpecModule file is converted to equivalent YAML', () => {
    it('FR-1104-01 writes YAML carrying the model id and every spec of the module', async () => {
      // The fixture mirrors what defineSpecs() produces, which is what the
      // command is specified to read.
      expect(defineSpecs([{ id: 'term' } as never, termSpecs])).toEqual({
        entries: [{ model: { id: 'term' }, data: termSpecs }],
      });

      const source = writeSpecModule(tempDir, 'glossary-01.mjs');

      await runConvert(source);

      const yamlPath = join(tempDir, 'glossary-01.yaml');
      const parsed = parseYaml(readFileSync(yamlPath, 'utf-8'));
      expect(parsed).toEqual({ model: 'term', specs: termSpecs });
    });
  });

  describe('FR-1104-02: output defaults to the source filename with a .yaml extension', () => {
    it('FR-1104-02 writes next to the source file with the extension replaced', async () => {
      const source = writeSpecModule(tempDir, 'glossary-02.mjs');

      await runConvert(source);

      expect(existsSync(join(tempDir, 'glossary-02.yaml'))).toBe(true);
      expect(existsSync(source)).toBe(true);
    });
  });

  describe('FR-1104-03: --output selects a custom output path', () => {
    it('FR-1104-03 writes to the path given by output and not to the default path', async () => {
      const source = writeSpecModule(tempDir, 'glossary-03.mjs');
      const customPath = join(tempDir, 'nested-output.yaml');

      await runConvert(source, { output: customPath });

      expect(existsSync(customPath)).toBe(true);
      expect(existsSync(join(tempDir, 'glossary-03.yaml'))).toBe(false);
      const parsed = parseYaml(readFileSync(customPath, 'utf-8'));
      expect(parsed).toMatchObject({ model: 'term' });
    });
  });

  describe('FR-1104-04: --dry-run previews the conversion without writing', () => {
    it('FR-1104-04 prints the YAML and leaves no output file behind', async () => {
      const source = writeSpecModule(tempDir, 'glossary-04.mjs');

      await runConvert(source, { dryRun: true });

      expect(existsSync(join(tempDir, 'glossary-04.yaml'))).toBe(false);
      const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(output).toContain('model: term');
      expect(output).toContain('TERM-001');
    });
  });
});
