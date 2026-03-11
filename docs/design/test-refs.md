# Test Reference List

| ID | Description | Framework | Requirements Count |
|----|-------------|-----------|-------------------|
| TEST-003 | Config file loading utility verification test | vitest | 1 |
| TEST-004 | File writing utility verification test | vitest | 1 |
| TEST-018 | Model level configuration feature verification test | vitest | 1 |
| TEST-019 | Project initialization feature verification test | vitest | 1 |
| TEST-020 | Lint command verification test | vitest | 2 |
| TEST-021 | Check command verification test | vitest | 2 |
| TEST-022 | Build command verification test | vitest | 2 |
| TEST-023 | Impact command verification test | vitest | 1 |
| TEST-024 | Drift command verification test | vitest | 1 |
| TEST-025 | New command verification test | vitest | 1 |

---

## TEST-003: Config file loading utility verification test

### Test Source

- **Path**: `test/utils/config-loader.test.ts`
- **Framework**: vitest
- **Result JSON**: `test-results/all.json`

### Verified Requirements

- CR-002

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| CR-002-01 | `default config|no config file` | Default config test |

---

## TEST-004: File writing utility verification test

### Test Source

- **Path**: `test/utils/file-writer.test.ts`
- **Framework**: vitest
- **Result JSON**: `test-results/all.json`

### Verified Requirements

- FR-300

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-300-01 | `write.*file|file.*writ` | File output test |

---

## TEST-018: Model level configuration feature verification test

### Test Source

- **Path**: `test/core/model-level.test.ts`
- **Framework**: vitest
- **Result JSON**: `test-results/all.json`

### Verified Requirements

- FR-104

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-104-08 | `FR-104-08.*modelLevel configuration` | modelLevel setting test |
| FR-104-09 | `FR-104-09.*level.*property` | level property retrieval test |

---

## TEST-019: Project initialization feature verification test

### Test Source

- **Path**: `test/cli/init.test.ts`
- **Framework**: vitest
- **Result JSON**: `test-results/all.json`

### Verified Requirements

- FR-105

### Implemented Command

- CMD-INIT

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-105-01 | `FR-105-01.*creates design/` | Design directory creation test |
| FR-105-02 | `FR-105-02.*speckeeper.config.ts` | Config file generation test |
| FR-105-03 | `FR-105-03.*package.json` | Package.json generation test |
| FR-105-04 | `FR-105-04.*tsconfig.json` | tsconfig.json generation test |
| FR-105-05 | `FR-105-05.*model definitions` | Model definitions generation test |
| FR-105-06 | `FR-105-06.*sample specification` | Sample specification generation test |
| FR-105-07 | `FR-105-07.*speckeeper lint` | Generated project lint test |
| FR-105-08 | `FR-105-08.*typecheck` | Generated project typecheck test |
| FR-105-09 | `FR-105-09.*--force` | Force overwrite test |
| FR-105-10 | `FR-105-10.*skips package.json` | Skip existing package.json test |

---

## TEST-020: Lint command verification test

### Test Source

- **Path**: `test/cli/lint.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-401
- FR-402

### Implemented Command

- CMD-LINT

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-401-01 | `FR-401-01.*lintAll.*exits.*code 1` | Error-severity results trigger exit(1) |
| FR-401-03 | `FR-401-03.*exits.*code 1.*error message` | Ref-exists error triggers exit and output |
| FR-402-01 | `FR-402-01.*lintAll.*outputs warning` | Warnings output without exit |

---

## TEST-021: Check command verification test

### Test Source

- **Path**: `test/cli/check.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-602
- FR-603

### Implemented Command

- CMD-CHECK

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-602-01 | `FR-602-01.*check.*consistency` | Check runs external SSOT check |
| FR-602-04 | `FR-602-04.*skips.*without external` | Skips models without external source |
| FR-603-03 | `FR-603-03.*exits.*code 1.*outputs.*error` | Outputs error/warning messages and exits |

---

## TEST-022: Build command verification test

### Test Source

- **Path**: `test/cli/build.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-300
- FR-301

### Implemented Command

- CMD-BUILD

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-300-01 | `FR-300-01.*exporter\.single.*batchWriteFiles` | Calls exporter and passes to batchWriteFiles |
| FR-301-05 | `FR-301-05.*exporter\.single.*identical arguments` | Same arguments on repeated builds |

---

## TEST-023: Impact command verification test

### Test Source

- **Path**: `test/cli/impact.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-700

### Implemented Command

- CMD-IMPACT

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-700-01 | `FR-700-01.*target info.*analysis phase` | Reaches analysis phase for valid ID |
| FR-700-03 | `FR-700-03.*depth value.*--depth` | Outputs depth from --depth option |

---

## TEST-024: Drift command verification test

### Test Source

- **Path**: `test/cli/drift.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-500

### Implemented Command

- CMD-DRIFT

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-500-01 | `FR-500-01.*No drift detected.*content match` | No drift when content matches |
| FR-500-02 | `FR-500-02.*exits.*code 1.*failOnDrift` | Exits with code 1 on failOnDrift |

---

## TEST-025: New command verification test

### Test Source

- **Path**: `test/cli/new.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-104

### Implemented Command

- CMD-NEW

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-104-01 | `FR-104-01.*available model types header` | Outputs model types header when type omitted |

---
