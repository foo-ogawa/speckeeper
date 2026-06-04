import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { insightsCommand } from '../../src/cli/insights.js';

vi.mock('../../src/utils/config-loader.js');
vi.mock('../../src/external/insight-provider.js', async () => {
  const actual = await vi.importActual('../../src/external/insight-provider.js');
  return {
    ...actual,
    createSpeckeeperInsightProvider: vi.fn(() => ({
      name: 'speckeeper',
      provide: vi.fn().mockResolvedValue({
        source: 'speckeeper',
        edges: [{ from: 'FR-001', to: 'UC-001', kind: 'satisfies', propagation: 'backward' }],
      }),
    })),
  };
});

const { createSpeckeeperInsightProvider } = await import(
  '../../src/external/insight-provider.js'
);
const mockedCreate = vi.mocked(createSpeckeeperInsightProvider);

describe('insightsCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation(((code: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedCreate.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('outputs ExternalInsight JSON to stdout', async () => {
    await insightsCommand({ format: 'json', projectRoot: '.' });

    expect(mockedCreate).toHaveBeenCalled();
    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.source).toBe('speckeeper');
    expect(parsed.edges).toHaveLength(1);
  });

  it('exits with code 1 for unsupported format', async () => {
    await expect(
      insightsCommand({ format: 'text' as 'json' }),
    ).rejects.toThrow('process.exit(1)');
  });
});
