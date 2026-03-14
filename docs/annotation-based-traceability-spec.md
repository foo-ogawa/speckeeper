# Annotation-Based Traceability Auto-Detection

Created: 2026-03-14  
Status: Draft (v2)

---

## 1. 背景と問題

### 1.1 現状の仕組み

speckeeper には、spec と外部成果物（テストコード・実装コード）の紐付けに関して**2つの独立したメカニズム**が存在する。

**A. `testChecker()` — ファイルスキャンによる自動検出**

- ハードコードされた glob（`test/**/*.test.ts` 等）でテストファイルを列挙
- `describe`/`it`/`test` の文字列引数に spec ID が含まれるかを正規表現で検出
- relations を参照しない

**B. `relationCoverage()` — relation の手書きによる集計**

- spec データに手書きされた `relations: [{ type: 'verifiedBy', target: '...' }]` を集計
- ファイルスキャンを行わない

### 1.2 問題点

1. **`verifiedBy` / `implements` relation の冗長性**: `testChecker()` がファイル内容から spec ID を自動検出できるにもかかわらず、`relationCoverage()` を使うにはスペックデータに同じ情報を `relations` として手書きしなければならない。スペックデータが冗長になりメンテナンス不能になる

2. **`implements` の汎用スキャンが存在しない**: テストには `testChecker()` があるが、実装コード全般に対して「spec ID が参照されているか」を汎用的にスキャンする仕組みがない。`externalOpenAPIChecker` / `externalSqlSchemaChecker` はソースを解析してより正確なチェックを行う**特化型チェッカー**であり、汎用的なファイルスキャンを代替するものではない

3. **検出パターンが `describe`/`it`/`test` 限定**: コメントに `// verifies FR-001` と書いても検出されない。テスト以外のファイル（実装コード、IaC 等）には適用不可

4. **テスト glob がハードコード**: `testChecker()` の glob パターンは固定で、config から変更できない

### 1.3 あるべき姿

```
                    ┌─────────────────────────────────────────────┐
                    │            speckeeper config                 │
                    │  artifacts:                                  │
                    │    UT:                                       │
                    │      globs: ['test/**/*.test.ts']            │
                    │      contentPatterns: [/@verifies\s+(.*)/]   │
                    │    SRC:                                      │
                    │      globs: ['src/**/*.ts']                  │
                    │      contentPatterns: [/@implements\s+(.*)/] │
                    └──────────────┬──────────────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────────────┐
                    │          annotationChecker()                 │
                    │  (汎用: glob + パターンでスキャン)            │
                    └──────────────┬──────────────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
    │ spec ID 検出     │  │ coverage 集計    │  │ 特化チェッカー   │
    │ (verifiedBy /    │  │ (relation 手書き │  │ (OpenAPI/DDL等)  │
    │  implements)     │  │  不要)           │  │ annotationの     │
    └─────────────────┘  └─────────────────┘  │ 拡張として動作   │
                                               └─────────────────┘
```

- **汎用チェッカー**（`annotationChecker()`）がファイルスキャンで spec ID を自動検出
- **特化チェッカー**（`externalOpenAPIChecker` 等）は汎用チェッカーを拡張し、ソース解析でより正確なチェックを追加
- 特化チェッカーが定義されていない artifact に対しては、汎用チェッカーがフォールバック
- `verifiedBy` / `implements` の coverage 集計もスキャン結果から自動生成（手書き relation 不要）

---

## 2. 設計方針

### 2.1 レイヤー構成

```
speckeeper.config.ts          → artifact ごとの glob / contentPattern を定義
design/_models/*.ts           → model ごとに annotationChecker を設定（検索パターン上書き可）
src/core/dsl/checkers.ts      → annotationChecker() 実装
scaffold                      → implements/verifiedBy edge から _models に設定を自動生成
```

### 2.2 関心の分離

| 設定場所 | 責務 |
|---------|------|
| **config** (`speckeeper.config.ts`) | artifact ノードごとの glob パターンと contentPattern の定義 |
| **model** (`_models/*.ts`) | どの artifact に対してどの relationType のチェックを行うか。model 固有の検索パターン上書き |
| **scaffold** | Mermaid の implements/verifiedBy edge から config と _models の設定を自動生成 |

### 2.3 relation 手書きの廃止

`verifiedBy` / `implements` の target にファイルパスを記述する relation パターンは**廃止**する。スペックデータが冗長になりメンテナンスできないため。

spec 間（speckeeper 管理同士）の relation（`satisfies`, `refines`, `dependsOn` 等）は従来通り手書き。

---

## 3. 詳細仕様

### 3.1 config: artifact ノードの定義

Mermaid flowchart の外部ノード（implements/verifiedBy 先）ごとに、スキャン対象を config で定義する。

```typescript
// speckeeper.config.ts
import { defineConfig } from 'speckeeper';
import design from './design/index';

export default defineConfig({
  projectName: 'my-project',
  models: design.models,
  specs: design.specs,

  artifacts: {
    // Mermaid で class "test" が付与されたノード（例: UT）
    test: {
      globs: ['test/**/*.test.ts', 'test/**/*.spec.ts', 'tests/**/*.test.ts'],
      contentPatterns: [
        /@verifies\s+([\w-]+(?:[,\s]+[\w-]+)*)/,
      ],
    },
    // Mermaid で class "e2e-test" が付与されたノード
    'e2e-test': {
      globs: ['e2e/**/*.spec.ts'],
      contentPatterns: [
        /@verifies\s+([\w-]+(?:[,\s]+[\w-]+)*)/,
      ],
    },
    // Mermaid で class "typescript" が付与されたノード（例: SRC）
    typescript: {
      globs: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
      contentPatterns: [
        /@implements\s+([\w-]+(?:[,\s]+[\w-]+)*)/,
      ],
    },
    // OpenAPI（特化チェッカーが設定されていればそちらが優先）
    openapi: {
      globs: ['api/openapi.yaml'],
    },
    // SQL schema（特化チェッカーが設定されていればそちらが優先）
    sqlschema: {
      globs: ['db/schema.sql'],
    },
  },
});
```

#### `artifacts` の型定義

```typescript
interface ArtifactConfig {
  /** スキャン対象のファイルパス glob */
  globs: string[];
  /** 除外パターン */
  exclude?: string[];
  /** ファイル内容の検索パターン（正規表現）。最初のキャプチャグループが spec ID（カンマ or スペース区切りで複数可） */
  contentPatterns?: RegExp[];
}
```

- `globs`: ファイルパスの絞り込み
- `contentPatterns`: ファイル内容から spec ID を抽出する正規表現。省略時はデフォルトパターン（後述）を使用
- 1つの artifact に対して `implements` と `verifiedBy` の両方が使われる場合、同一 artifact の `contentPatterns` に両方のパターンを含めるか、model 側で上書きする

### 3.2 デフォルト contentPattern

`contentPatterns` を省略した場合、以下のデフォルトパターンが適用される:

```
/@(?:verifies|implements|traces)\s+([\w-]+(?:[,\s]+[\w-]+)*)/
```

このパターンは以下を検出する:

```
// @verifies FR-001
// @implements FR-001, FR-002
// @traces FR-001 FR-002 FR-003
# @verifies FR-001
-- @implements COMP-01
/* @verifies FR-001-01 */
<!-- @implements TBL-001 -->
```

ID のセパレータはカンマ（`,`）またはスペースを許可する。

### 3.3 model での annotationChecker 設定

`_models/*.ts` で、model ごとに annotationChecker を設定する。

#### 基本形: 1つの relationType

```typescript
import { annotationChecker } from 'speckeeper/dsl';

class RequirementModel extends Model<typeof RequirementSchema> {
  // ...
  protected externalChecker = annotationChecker<Requirement>({
    // config の artifacts.test を使い、@verifies パターンでスキャン
    artifact: 'test',
    relationType: 'verifiedBy',
  });
}
```

#### 複数の relationType（implements + verifiedBy）

同一モデルに対して `implements` と `verifiedBy` の両方をチェックする場合:

```typescript
class RequirementModel extends Model<typeof RequirementSchema> {
  // ...
  protected externalChecker = annotationChecker<Requirement>({
    checks: [
      { artifact: 'test', relationType: 'verifiedBy' },
      { artifact: 'typescript', relationType: 'implements' },
    ],
  });
}
```

#### model 固有の検索パターン上書き

config のデフォルトパターンでは不十分な場合、model 側で上書きできる:

```typescript
class RequirementModel extends Model<typeof RequirementSchema> {
  // ...
  protected externalChecker = annotationChecker<Requirement>({
    artifact: 'test',
    relationType: 'verifiedBy',
    contentPatterns: [
      // model 固有: describe/it/test 内の ID も検出（レガシー対応）
      /(?:describe|it|test)\s*\(\s*['"`].*?([\w-]+(?:[,\s]+[\w-]+)*)/,
      // デフォルトアノテーション
      /@verifies\s+([\w-]+(?:[,\s]+[\w-]+)*)/,
    ],
  });
}
```

#### `annotationChecker` の型定義

```typescript
interface AnnotationCheckerConfig<T> {
  /** 単一チェック設定 */
  artifact?: string;
  relationType?: 'verifiedBy' | 'implements' | 'traces';

  /** 複数チェック設定（artifact/relationType と排他） */
  checks?: Array<{
    artifact: string;
    relationType: 'verifiedBy' | 'implements' | 'traces';
    /** model 固有の検索パターン上書き（省略時は config の contentPatterns を使用） */
    contentPatterns?: RegExp[];
  }>;

  /** model 固有の検索パターン上書き（単一チェック時のみ） */
  contentPatterns?: RegExp[];
}
```

### 3.4 特化チェッカーとの関係

`externalOpenAPIChecker` / `externalSqlSchemaChecker` 等の特化チェッカーは、`annotationChecker` の**拡張**として位置づける。

```
annotationChecker()              ← 汎用: glob + contentPattern でスキャン
  └── externalOpenAPIChecker()   ← 特化: OpenAPI ファイルを解析して構造チェック
  └── externalSqlSchemaChecker() ← 特化: DDL を解析してスキーマチェック
  └── typescriptChecker()        ← 特化（将来）: TS AST で詳細分析
```

- 特化チェッカーが設定されている artifact → 特化チェッカーのロジックで検証
- 特化チェッカーが設定されていない artifact → `annotationChecker` の汎用スキャン（glob + contentPattern）でフォールバック

TypeScript コードの詳細な分析（AST レベル）が必要な場合は、`annotationChecker` ではなく `typescriptChecker` 等の特化チェッカーを別途作成して対処する。

### 3.5 coverage の自動集計

`annotationChecker()` のスキャン結果から、`implements` / `verifiedBy` の coverage を自動集計する。`relations` の手書きは不要。

#### coverage の算出ロジック

1. `annotationChecker` がスキャンした全ファイルから `{specId, filePath, line, relationType}` のマッピングを収集
2. 対象モデルの全 spec ID に対して、対応する relationType のアノテーションが存在するかを判定
3. coverage = (アノテーションが見つかった spec 数) / (対象モデルの全 spec 数)

#### CLI 出力

```
$ npx speckeeper check test --coverage

speckeeper check

  Design: design/
  Type:   test

  Scanning artifacts...
    test:       12 @verifies annotations in 8 files
    typescript:  5 @implements annotations in 4 files

  ✓ All checks passed

  Coverage: Requirement (verifiedBy → test)
    Coverage: 100% (7/7 requirements verified)

  Coverage: Requirement (implements → typescript)
    Coverage: 85% (6/7 requirements implemented)
    Uncovered: FR-007 (Batch Processing)
```

### 3.6 relation スキーマの変更

#### 廃止: ファイルパスベースの `verifiedBy` / `implements` relation

以下のパターンを**廃止**する:

```typescript
// ❌ 廃止: ファイルパスを target に指定する relation
relations: [
  { type: 'verifiedBy', target: 'tests/unit/auth.test.ts' },
  { type: 'implements', target: 'src/auth/handler.ts' },
]
```

#### 存続: spec 間の relation

speckeeper 管理の spec 同士を結ぶ relation は従来通り:

```typescript
// ✅ 存続: spec ID を target に指定する relation
relations: [
  { type: 'satisfies', target: 'UC-001' },
  { type: 'refines', target: 'FR-001' },
  { type: 'dependsOn', target: 'COMP-AUTH' },
]
```

#### `VerifiedByRelationSchema` / `ImplementsRelationSchema` の扱い

`relation-schemas.ts` の拡張スキーマ（`testPath`, `sourcePath` 等のフィールド）は廃止する。これらの情報はスキャン結果から自動取得される。

---

## 4. scaffold の変更

### 4.1 Mermaid edge からの自動生成

scaffold は、Mermaid flowchart の `implements` / `verifiedBy` edge を解析し、以下を自動生成する。

#### 4.1.1 config への artifact 定義

implements/verifiedBy 先のノード（外部ノード）を収集し、`speckeeper.config.ts` の `artifacts` セクションに反映する。

```
Mermaid:
  FR -->|verifiedBy| UT
  FR -->|implements| API
  FR -->|implements| SRC

  class UT test
  class API openapi
  class SRC typescript
```

生成される config:

```typescript
export default defineConfig({
  // ...
  artifacts: {
    test: {
      globs: ['test/**/*.test.ts', 'tests/**/*.test.ts'],
      contentPatterns: [/@verifies\s+([\w-]+(?:[,\s]+[\w-]+)*)/],
    },
    openapi: {
      globs: ['api/openapi.yaml'],
    },
    typescript: {
      globs: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
      contentPatterns: [/@implements\s+([\w-]+(?:[,\s]+[\w-]+)*)/],
    },
  },
});
```

artifact class ごとのデフォルト glob は scaffold のテンプレートで定義する:

| artifact class | デフォルト globs | デフォルト contentPattern |
|---------------|-----------------|-------------------------|
| `test` | `['test/**/*.test.ts', 'tests/**/*.test.ts']` | `/@verifies\s+(...)/` |
| `e2e-test` | `['e2e/**/*.spec.ts']` | `/@verifies\s+(...)/` |
| `unit-test` | `['test/unit/**/*.test.ts']` | `/@verifies\s+(...)/` |
| `integration-test` | `['test/integration/**/*.test.ts']` | `/@verifies\s+(...)/` |
| `typescript` | `['src/**/*.ts']` (exclude: `['**/*.test.ts', '**/*.d.ts']`) | `/@implements\s+(...)/` |
| `openapi` | `['api/openapi.yaml', 'api/openapi.json']` | なし（特化チェッカー） |
| `sqlschema` | `['db/schema.sql', 'db/migration/*.sql']` | なし（特化チェッカー） |

#### 4.1.2 `_models/*.ts` への annotationChecker 設定

scaffold は、各モデルの outgoing check edge を解析し、`_models/*.ts` に `annotationChecker` の設定コードを生成する。

```
Mermaid:
  FR -->|verifiedBy| UT
  FR -->|implements| SRC
```

生成される `_models/requirement.ts`:

```typescript
import { z } from 'zod';
import { Model, RelationSchema } from 'speckeeper';
import type { LintRule, Exporter, ModelLevel } from 'speckeeper';
import { requireField, annotationChecker } from 'speckeeper/dsl';

// ... schema, type ...

class RequirementModel extends Model<typeof RequirementSchema> {
  readonly id = 'requirement';
  readonly name = 'Requirement';
  readonly idPrefix = 'FR';
  readonly schema = RequirementSchema;
  readonly description = 'Functional Requirements';
  protected modelLevel: ModelLevel = 'L1';

  protected lintRules: LintRule<Requirement>[] = [
    requireField<Requirement>('description'),
  ];

  protected exporters: Exporter<Requirement>[] = [];

  protected externalChecker = annotationChecker<Requirement>({
    checks: [
      { artifact: 'test', relationType: 'verifiedBy' },
      { artifact: 'typescript', relationType: 'implements' },
    ],
  });
}
```

edge が1つだけの場合は単一形式で生成:

```typescript
  protected externalChecker = annotationChecker<Requirement>({
    artifact: 'test',
    relationType: 'verifiedBy',
  });
```

#### 4.1.3 特化チェッカーの場合

implements 先の artifact class に対応する特化チェッカーが存在する場合、scaffold はそちらを生成する:

```
Mermaid:
  FR -->|implements| API     (class: openapi)
  FR -->|implements| DDL     (class: sqlschema)
  FR -->|verifiedBy| UT      (class: test)
```

生成:

```typescript
import { annotationChecker, externalOpenAPIChecker, externalSqlSchemaChecker } from 'speckeeper/dsl';

class RequirementModel extends Model<typeof RequirementSchema> {
  // ...
  protected externalChecker = annotationChecker<Requirement>({
    checks: [
      { artifact: 'test', relationType: 'verifiedBy' },
      // openapi / sqlschema は特化チェッカーに委譲
      { artifact: 'openapi', relationType: 'implements', checker: externalOpenAPIChecker() },
      { artifact: 'sqlschema', relationType: 'implements', checker: externalSqlSchemaChecker() },
    ],
  });
}
```

### 4.2 現行 scaffold からの変更点

| 項目 | 現行 | 変更後 |
|-----|------|-------|
| checker binding | ガイダンスコメントとして出力 | 実行可能な `annotationChecker` コードとして出力 |
| config | artifact 定義なし | `artifacts` セクションを自動生成 |
| import | コメント内に import 提案 | 実際の import 文を生成 |
| 複数 edge | 個別コメント | `checks` 配列にまとめて生成 |

---

## 5. `annotationChecker()` の動作フロー

```
1. config から artifact 定義を取得
   ├── globs → ファイル列挙
   ├── exclude → 除外
   └── contentPatterns → 検索パターン

2. _models の contentPatterns 上書きがあればそちらを優先

3. 各ファイルを走査
   ├── contentPattern でマッチ
   ├── キャプチャグループから spec ID を抽出
   │   └── カンマ or スペース区切りで分割
   └── {specId, filePath, line, relationType} を記録

4. 特化チェッカーが設定されている artifact
   └── 特化チェッカーの check() を実行（構造チェック等）

5. 各 spec に対して結果を判定
   ├── アノテーションが見つかった → OK
   ├── 見つからない → warning
   └── 特化チェッカーのエラー → error / warning

6. coverage 集計
   └── 全 spec に対するアノテーション検出率を算出
```

---

## 6. `CheckResult` の拡張

```typescript
interface CheckResult {
  success: boolean;
  errors: Array<{ message: string; specId: string; field?: string }>;
  warnings: Array<{ message: string; specId: string; field?: string }>;
  /** アノテーションが検出されたファイル一覧 */
  matchedFiles?: Array<{
    specId: string;
    filePath: string;
    line: number;
    relationType: 'verifiedBy' | 'implements' | 'traces';
  }>;
}
```

---

## 7. `testChecker()` との後方互換性

| 機能 | `testChecker()`（現行） | `annotationChecker()`（新規） |
|------|------------------------|------------------------------|
| 検出対象 | `describe`/`it`/`test` 内の spec ID | configurable contentPattern |
| glob | ハードコード | config で定義 |
| relationType | `verifiedBy` 固定（暗黙） | 任意 |
| implements 対応 | 不可 | 可 |
| coverage | `relationCoverage()` + 手書き relation 必要 | スキャン結果から自動集計 |
| 特化チェッカー連携 | なし | `checks` 配列で統合 |

`testChecker()` は非推奨（deprecated）とし、`annotationChecker({ artifact: 'test', relationType: 'verifiedBy' })` への移行を推奨する。

移行期間中、`annotationChecker` の `contentPatterns` に従来の `describe`/`it`/`test` パターンを含めることでレガシー対応が可能。

---

## 8. 移行パス

### Phase 1: 基盤実装

- `annotationChecker()` を `src/core/dsl/checkers.ts` に追加
- config に `artifacts` セクションを追加（`SpeckeeperConfigInput` の拡張）
- `CheckResult` に `matchedFiles` を追加
- `annotationChecker` からの coverage 自動集計を実装

### Phase 2: scaffold 更新

- `model-generator.ts` の checker binding 出力をコメントから実コードに変更
- config 生成に `artifacts` セクションを含める
- artifact class → デフォルト glob / contentPattern のマッピングテーブルを追加

### Phase 3: 既存プロジェクト移行

- テストファイルに `@verifies` アノテーションを追加
- 実装ファイルに `@implements` アノテーションを追加
- `_models/*.ts` の `externalChecker` を `annotationChecker` に変更
- spec データから冗長な `verifiedBy` / `implements` relation を削除
- `testChecker()` を deprecated にする
- `VerifiedByRelationSchema` / `ImplementsRelationSchema` を廃止

---

## 9. 影響範囲

| ファイル / モジュール | 変更内容 |
|---------------------|---------|
| `src/core/dsl/checkers.ts` | `annotationChecker()` の追加 |
| `src/core/config-api.ts` | `artifacts` セクションの型定義追加 |
| `src/core/model.ts` | `CheckResult` に `matchedFiles` 追加 |
| `src/core/dsl/index.ts` | `annotationChecker` の export 追加 |
| `src/core/dsl/relation-schemas.ts` | `VerifiedByRelationSchema` / `ImplementsRelationSchema` 廃止 |
| `src/scaffold/model-generator.ts` | checker binding をコメントから実コードに変更 |
| `src/scaffold/templates/base.ts` | `annotationChecker` import を含むテンプレートに更新 |
| `src/scaffold/templates/types.ts` | `CheckerBinding` 情報をテンプレートパラメータに追加 |
| config 生成 | `artifacts` セクションの自動生成 |

---

## 10. スキャンキャッシュ

汎用チェッカーはプロジェクト内の多数のファイルを走査するため、大規模プロジェクトではパフォーマンスが問題になる。スキャン結果のキャッシュを導入する。

### 10.1 キャッシュ戦略

```
.speckeeper/
  scan-cache.json       ← スキャン結果のキャッシュ
```

#### キャッシュデータ構造

```typescript
interface ScanCache {
  /** キャッシュバージョン（フォーマット変更時にインバリデート） */
  version: number;
  /** config の artifacts ハッシュ（設定変更時にインバリデート） */
  configHash: string;
  /** ファイルごとのスキャン結果 */
  files: Record<string, {
    /** ファイルの mtime（Unix ms） */
    mtime: number;
    /** ファイルサイズ */
    size: number;
    /** 検出されたアノテーション */
    annotations: Array<{
      specId: string;
      line: number;
      relationType: 'verifiedBy' | 'implements' | 'traces';
    }>;
  }>;
}
```

#### インバリデーション条件

| 条件 | アクション |
|-----|----------|
| キャッシュファイルが存在しない | フルスキャン |
| `version` が不一致 | フルスキャン |
| `configHash` が不一致（artifacts 設定変更） | フルスキャン |
| ファイルの mtime or size が変化 | 該当ファイルのみ再スキャン |
| ファイルが削除された | キャッシュからエントリ削除 |
| 新規ファイルが glob にマッチ | 該当ファイルのみスキャン |

#### 動作フロー

1. glob でファイル一覧を取得
2. 各ファイルの `stat()` で mtime / size を取得
3. キャッシュと比較し、変更があったファイルのみ内容を読み込んでスキャン
4. スキャン完了後、キャッシュを更新して書き出し

`--no-cache` フラグでキャッシュを無視したフルスキャンも可能とする。

---

## 11. 設計上の決定事項

1. **汎用チェッカーはテキストパターン検出**: 汎用チェッカーはファイル内容に対する正規表現マッチであり、ファイル単位・ブロック単位といった構造的な概念は持たない。1ファイル内に複数のアノテーションが存在すればすべて検出する。ブロック単位の検証（「この関数が本当に spec を実装しているか」等）が必要な場合は、対象言語のパーサーを持つ特化チェッカー（`typescriptChecker` 等）で対処する

2. **`VerifiedByRelationSchema` / `ImplementsRelationSchema` の非推奨化**: これらの拡張スキーマは外部ファイルとの relation 用途でのみ使われている。外部ファイルとの紐付けがスキャンベースに移行するため、非推奨とする

3. **特化チェッカーと汎用チェッカーの結果マージ**: 同一 artifact に対して特化チェッカーと汎用スキャンの結果をどう統合するか（未決事項）
