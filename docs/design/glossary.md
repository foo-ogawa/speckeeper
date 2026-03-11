# Glossary

- **API**: Application programming interface
- **C4**: Software architecture visualization model
- **CLI**: Command line interface
- **Concretization Slot**: Items to be filled in subsequent phases (allows TBD while having a deadline phase)
- **DDL**: Data definition language. A language for defining database schemas
- **Design Artifact**: Design artifacts to satisfy requirements such as monitoring, Runbook, Dashboard, data schema, etc.
- **Drift**: A state where docs//specs/ that should have been generated from TS have differences due to manual edits, etc.
- **DSL**: Domain-specific language. A programming language specialized for a particular domain
- **DTO**: Data transfer object. A structure for passing data between systems
- **ER**: Entity relationship. A data modeling technique
- **External SSOT**: Artifacts managed by existing tools/formats (OpenAPI, DDL, IaC, etc.). This framework does not generate them but checks consistency against them
- **External SSOT Reference**: Minimal interface for referencing external SSOT from TS models (ID, path, correspondence, etc.)
- **IaC**: Infrastructure definition through code
- **ID Linkage**: A mechanism that ensures componentId/entityId/requirementId from TS models appear in external SSOT, generated artifacts, implementation, and IaC to connect design and implementation
- **Model**: A unit of design information defined in TypeScript. Inherits from Model base class and has schema, lint rules, renderers, etc.
- **Reconciliation**: Checks to bridge gaps between design and external SSOT/implementation (design consistency, external SSOT consistency, implementation existence verification)
- **SSOT**: The single authoritative source of information. The canonical location for data and design
- **TS**: Statically typed JavaScript developed by Microsoft
- **TS-SSOT**: A policy where TypeScript is the source of truth and generated artifacts are regeneratable derivatives
- **User-defined Model**: Project-specific models defined by users inheriting from the Model base class. The standard way to use speckeeper

---

## TERM-A005: API

**Category**: acronym
**Abbreviation**: API
**Expanded Form**: Application Programming Interface

### Definition

Application programming interface

---

## TERM-A010: C4

**Category**: acronym
**Abbreviation**: C4
**Expanded Form**: Context, Container, Component, Code

### Definition

Software architecture visualization model

---

## TERM-A004: CLI

**Category**: acronym
**Abbreviation**: CLI
**Expanded Form**: Command Line Interface

### Definition

Command line interface

---

## TERM-011: Concretization Slot

**Category**: core

### Definition

Items to be filled in subsequent phases (allows TBD while having a deadline phase)

---

## TERM-A006: DDL

**Category**: acronym
**Abbreviation**: DDL
**Expanded Form**: Data Definition Language

### Definition

Data definition language. A language for defining database schemas

---

## TERM-010: Design Artifact

**Category**: core

### Definition

Design artifacts to satisfy requirements such as monitoring, Runbook, Dashboard, data schema, etc.

---

## TERM-013: Drift

**Category**: process

### Definition

A state where docs//specs/ that should have been generated from TS have differences due to manual edits, etc.

---

## TERM-A003: DSL

**Category**: acronym
**Abbreviation**: DSL
**Expanded Form**: Domain Specific Language

### Definition

Domain-specific language. A programming language specialized for a particular domain

---

## TERM-A008: DTO

**Category**: acronym
**Abbreviation**: DTO
**Expanded Form**: Data Transfer Object

### Definition

Data transfer object. A structure for passing data between systems

---

## TERM-A009: ER

**Category**: acronym
**Abbreviation**: ER
**Expanded Form**: Entity Relationship

### Definition

Entity relationship. A data modeling technique

---

## TERM-002: External SSOT

**Category**: core

### Definition

Artifacts managed by existing tools/formats (OpenAPI, DDL, IaC, etc.). This framework does not generate them but checks consistency against them

---

## TERM-003: External SSOT Reference

**Category**: core

### Definition

Minimal interface for referencing external SSOT from TS models (ID, path, correspondence, etc.)

---

## TERM-A007: IaC

**Category**: acronym
**Abbreviation**: IaC
**Expanded Form**: Infrastructure as Code

### Definition

Infrastructure definition through code

---

## TERM-012: ID Linkage

**Category**: core

### Definition

A mechanism that ensures componentId/entityId/requirementId from TS models appear in external SSOT, generated artifacts, implementation, and IaC to connect design and implementation

---

## TERM-004: Model

**Category**: core

### Definition

A unit of design information defined in TypeScript. Inherits from Model base class and has schema, lint rules, renderers, etc.

---

## TERM-014: Reconciliation

**Category**: process

### Definition

Checks to bridge gaps between design and external SSOT/implementation (design consistency, external SSOT consistency, implementation existence verification)

---

## TERM-A001: SSOT

**Category**: acronym
**Abbreviation**: SSOT
**Expanded Form**: Single Source of Truth

### Definition

The single authoritative source of information. The canonical location for data and design

---

## TERM-A002: TS

**Category**: acronym
**Abbreviation**: TS
**Expanded Form**: TypeScript

### Definition

Statically typed JavaScript developed by Microsoft

---

## TERM-001: TS-SSOT

**Category**: core

### Definition

A policy where TypeScript is the source of truth and generated artifacts are regeneratable derivatives

---

## TERM-015: User-defined Model

**Category**: core

### Definition

Project-specific models defined by users inheriting from the Model base class. The standard way to use speckeeper