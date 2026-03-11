# Use Cases

| ID | Name | Actor |
|----|------|-------|
| UC-001 | Define Requirements | UC-ACTOR-001 |
| UC-002 | Define Architecture | UC-ACTOR-002 |
| UC-004 | Define Concept Model | UC-ACTOR-002 |
| UC-006 | Check External SSOT Consistency | UC-ACTOR-003 |
| UC-010 | Check Design Consistency | UC-ACTOR-SYS-001 |
| UC-011 | Detect Drift | UC-ACTOR-SYS-001 |
| UC-012 | Check Contract Consistency | UC-ACTOR-SYS-001 |

---

## UC-001: Define Requirements

**Actor**: UC-ACTOR-001

### Main Flow

1. Requirements engineer creates or edits design/requirements.ts
2. IDE displays type completion and validation errors
3. Define requirements using DSL
4. DSL builder validates input
5. Run speckeeper build
6. Markdown is generated in docs/requirements/
7. Run speckeeper lint
8. Requirement consistency is verified

---

## UC-002: Define Architecture

**Actor**: UC-ACTOR-002

### Main Flow

1. Create or edit design/architecture.ts
2. IDE displays type completion
3. Define components and relationships
4. DSL builder validates input
5. Run speckeeper build
6. Mermaid C4 diagram is generated in docs/architecture/
7. Run speckeeper lint
8. Layer violations, boundary crossings, etc. are verified

---

## UC-004: Define Concept Model

**Actor**: UC-ACTOR-002

### Main Flow

1. Create or edit design/concept-model.ts
2. IDE displays type completion
3. Define entities and relations
4. Run speckeeper build
5. Mermaid ER diagram is generated in docs/data-model/
6. Common vocabulary JSON is generated in specs/schemas/

---

## UC-006: Check External SSOT Consistency

**Actor**: UC-ACTOR-003

### Main Flow

1. Run speckeeper check external-ssot
2. Load OpenAPI/DDL files
3. Verify requirement-external SSOT consistency
4. Display verification results

---

## UC-010: Check Design Consistency

**Actor**: UC-ACTOR-SYS-001

### Main Flow

1. Run speckeeper lint
2. Verify ID uniqueness
3. Verify reference integrity
4. Verify layer dependency direction
5. Display verification results to stdout

---

## UC-011: Detect Drift

**Actor**: UC-ACTOR-SYS-001

### Main Flow

1. Run speckeeper drift
2. Regenerate artifacts from TS models
3. Compare existing artifacts with regenerated artifacts
4. Report if differences exist

---

## UC-012: Check Contract Consistency

**Actor**: UC-ACTOR-SYS-001

### Main Flow

1. Run speckeeper check contract
2. Compare implementation and contract definition
3. Report if violations exist

---