# Artifacts

## SSOT (Single Source of Truth)

| ID | Name | Location | Purpose | Drift Target |
|----|------|----------|---------|--------------|
| ART-001 | SSOT | `design/` | TypeScript models (source of truth) = requirement/design definitions | No |

## Human-readable artifacts

| ID | Name | Location | Purpose | Drift Target |
|----|------|----------|---------|--------------|
| ART-002 | Human-readable artifacts | `docs/` | Markdown/Mermaid (for review) | Yes |

## Machine-readable artifacts

| ID | Name | Location | Purpose | Drift Target |
|----|------|----------|---------|--------------|
| ART-003 | Machine-readable artifacts | `specs/` | JSON/JSON Schema for consistency checking | Yes |

## Implementation code

| ID | Name | Location | Purpose | Drift Target |
|----|------|----------|---------|--------------|
| ART-004 | Implementation code | `src/` | Application implementation (not managed by speckeeper) | No |

---

## ART-001: SSOT

**Category**: ssot | **Location**: `design/` | **Drift Target**: No

### Purpose

TypeScript models (source of truth) = requirement/design definitions

---

## ART-002: Human-readable artifacts

**Category**: human-readable | **Location**: `docs/` | **Drift Target**: Yes
**Generated From**: ART-001

### Purpose

Markdown/Mermaid (for review)

---

## ART-003: Machine-readable artifacts

**Category**: machine-readable | **Location**: `specs/` | **Drift Target**: Yes
**Generated From**: ART-001

### Purpose

JSON/JSON Schema for consistency checking

---

## ART-004: Implementation code

**Category**: implementation | **Location**: `src/` | **Drift Target**: No

### Purpose

Application implementation (not managed by speckeeper)

---
