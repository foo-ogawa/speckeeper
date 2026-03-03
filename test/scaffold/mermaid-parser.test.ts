import { describe, it, expect } from 'vitest';
import { extractMermaidBlocks, parseFlowchart, parseMarkdownFlowchart } from '../../src/scaffold/mermaid-parser.js';

const SAMPLE_MERMAID = `flowchart TB
  TERM <--->|relatedTo| SR[システム要求]
  SR -->|refines| FR[機能要求]
  SR -->|refines| NFR[非機能要求]

  %% 分析層（並列）
  TERM[用語] <-->|relatedTo| CDM[概念データモデル]
  FR -->|refines| UC[ユースケース]
  FR <-->|relatedTo| CDM[概念データモデル]
  UC -->|uses| CDM

  %% 設計層
  UC -->|implements| API[API仕様 openapi SSoT]
  UC -->|implements| BJIF[バッチ仕様IF TBD SSoT]
  CDM -->|refines| LDM[論理データモデル]
  LDM -->|implements| DDL[DDL]
  LDM -->|refines| DT[データ整合性テスト]
  DT -->|implements| DUT[モデルユニットテスト]
  DDL -->|generate| DBS[DBスキーマ schema.sql]
  DDL -->|apply| DB[Database]
  DBS -->|parse & generate| ORM[litedbmodel Model]

  UC -->|implements| IT[Integration Test]

  IT -->|verify| COMPIMP
  API -->|generate| COMPIF[コンポーネント設計]
  BJIF -->|generate| COMPIF
  COMPIF -->|implement| COMPIMP[コンポーネント実装 domain logic]
  COMPIMP -->|use| ORM
  UT[UnitTest] -->|verify| COMPIMP
  COMPIMP -->|deploy| CTN[Container]
  CTN -->|use| DB

  %% テスト仕様
  FR -->|includes| AT[受入基準]
  UC -->|includes| AT
  NFR -->|includes| AT
  FR -->|traces| VC[バリデーション制約]
  CDM -->|traces| VC
  VC -->|implements| UT
  DUT -->|verifies| ORM
  E2ET -->|verifies| CTN
  AT -->|implements| E2ET[E2Eテスト]

  %% speckeeper管理要素（仕様SSoT: TypeScript）
  classDef speckeeper fill:#2563EB,stroke:#1D4ED8,color:#fff,stroke-width:2px
  class TERM,SR,FR,NFR,CDM,UC,LDM,AT,DT,VC speckeeper`;

const SAMPLE_MARKDOWN = `
# 仕様のモデル

\`\`\`mermaid
${SAMPLE_MERMAID}
\`\`\`

## エッジ定義（誰が何をするか）
`;

describe('extractMermaidBlocks', () => {
  it('extracts mermaid blocks from markdown', () => {
    const blocks = extractMermaidBlocks(SAMPLE_MARKDOWN);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toContain('flowchart TB');
  });

  it('returns empty for markdown without mermaid', () => {
    const blocks = extractMermaidBlocks('# Just a heading\nSome text.');
    expect(blocks).toHaveLength(0);
  });
});

describe('parseFlowchart', () => {
  const result = parseFlowchart(SAMPLE_MERMAID);

  it('parses flowchart direction', () => {
    expect(result.direction).toBe('TB');
  });

  describe('nodes', () => {
    it('extracts all unique nodes', () => {
      const nodeIds = [...result.nodes.keys()];
      expect(nodeIds).toContain('TERM');
      expect(nodeIds).toContain('SR');
      expect(nodeIds).toContain('FR');
      expect(nodeIds).toContain('NFR');
      expect(nodeIds).toContain('CDM');
      expect(nodeIds).toContain('UC');
      expect(nodeIds).toContain('LDM');
      expect(nodeIds).toContain('AT');
      expect(nodeIds).toContain('DT');
      expect(nodeIds).toContain('VC');
      expect(nodeIds).toContain('API');
      expect(nodeIds).toContain('DDL');
      expect(nodeIds).toContain('DBS');
      expect(nodeIds).toContain('ORM');
      expect(nodeIds).toContain('COMPIMP');
      expect(nodeIds).toContain('COMPIF');
      expect(nodeIds).toContain('UT');
      expect(nodeIds).toContain('CTN');
      expect(nodeIds).toContain('DB');
      expect(nodeIds).toContain('E2ET');
      expect(nodeIds).toContain('DUT');
      expect(nodeIds).toContain('IT');
      expect(nodeIds).toContain('BJIF');
    });

    it('extracts node labels', () => {
      expect(result.nodes.get('SR')?.label).toBe('システム要求');
      expect(result.nodes.get('FR')?.label).toBe('機能要求');
      expect(result.nodes.get('API')?.label).toBe('API仕様 openapi SSoT');
      expect(result.nodes.get('DBS')?.label).toBe('DBスキーマ schema.sql');
    });

    it('assigns labels from later occurrences when first has none', () => {
      expect(result.nodes.get('TERM')?.label).toBe('用語');
    });
  });

  describe('edges', () => {
    it('extracts all edges', () => {
      expect(result.edges.length).toBeGreaterThanOrEqual(30);
    });

    it('parses forward edges with labels', () => {
      const srToFr = result.edges.find(e => e.sourceId === 'SR' && e.targetId === 'FR');
      expect(srToFr).toBeDefined();
      expect(srToFr?.rawLabel).toBe('refines');
      expect(srToFr?.direction).toBe('forward');
    });

    it('parses bidirectional edges with labels', () => {
      const glsToCdm = result.edges.find(e =>
        (e.sourceId === 'TERM' && e.targetId === 'CDM') ||
        (e.sourceId === 'CDM' && e.targetId === 'TERM')
      );
      expect(glsToCdm).toBeDefined();
      expect(glsToCdm?.rawLabel).toBe('relatedTo');
      expect(glsToCdm?.direction).toBe('bidirectional');
    });

    it('parses implements edges', () => {
      const ucToApi = result.edges.find(e => e.sourceId === 'UC' && e.targetId === 'API');
      expect(ucToApi).toBeDefined();
      expect(ucToApi?.rawLabel).toBe('implements');
    });

    it('parses edges with free-text labels between external nodes', () => {
      const itToCompimp = result.edges.find(e => e.sourceId === 'IT' && e.targetId === 'COMPIMP');
      expect(itToCompimp).toBeDefined();
      expect(itToCompimp?.rawLabel).toBe('verify');
    });
  });

  describe('classDef and class assignments', () => {
    it('parses classDef', () => {
      expect(result.classDefs).toHaveLength(1);
      expect(result.classDefs[0].name).toBe('speckeeper');
      expect(result.classDefs[0].styles).toContain('fill:#2563EB');
    });

    it('parses class assignments', () => {
      expect(result.classAssignments).toHaveLength(1);
      expect(result.classAssignments[0].className).toBe('speckeeper');
      expect(result.classAssignments[0].nodeIds).toEqual(
        expect.arrayContaining(['TERM', 'SR', 'FR', 'NFR', 'CDM', 'UC', 'LDM', 'AT', 'DT', 'VC'])
      );
    });

    it('applies class to nodes', () => {
      expect(result.nodes.get('TERM')?.classes).toContain('speckeeper');
      expect(result.nodes.get('SR')?.classes).toContain('speckeeper');
      expect(result.nodes.get('API')?.classes).not.toContain('speckeeper');
      expect(result.nodes.get('DDL')?.classes).not.toContain('speckeeper');
    });
  });
});

describe('parseMarkdownFlowchart', () => {
  it('parses flowchart from markdown', () => {
    const result = parseMarkdownFlowchart(SAMPLE_MARKDOWN);
    expect(result).not.toBeNull();
    expect(result!.nodes.size).toBeGreaterThan(0);
    expect(result!.edges.length).toBeGreaterThan(0);
  });

  it('returns null for markdown without flowchart', () => {
    const result = parseMarkdownFlowchart('# No mermaid here');
    expect(result).toBeNull();
  });
});
