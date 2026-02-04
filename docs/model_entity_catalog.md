# Model Entity Catalog

Created: 2026-02-03  
Version: 0.3

---

## 1. Overview

This document is a catalog of models defined in speckeeper and registered in the framework.

---

## 2. Registered Models

Models defined in `design/_models/` and registered in speckeeper:

<!--@embedoc:models format="full-table"-->
| Model ID | Name | Level | Lint | Export | External SSOT | Coverage | Description |
|----------|------|-------|------|--------|---------------|----------|-------------|
| `usecase` | UseCase | L0 | ✅ | ✅ | - | - | Defines use cases (business flows) |
| `actor` | Actor | L0 | ✅ | ✅ | - | - | Defines actors |
| `term` | Term | L0 | ✅ | ✅ | - | - | Defines terms (glossary) |
| `requirement` | Requirement | L1 | ✅ | ✅ | - | ✅ | Defines functional requirements, non-functional requirements, and constraints |
| `entity` | Entity | L2 | ✅ | ✅ | - | ✅ | Defines conceptual entities (domain model) |
| `component` | Component | L2 | ✅ | ✅ | - | ✅ | Defines architecture components |
| `boundary` | Boundary | L2 | ❌ | ❌ | - | - | Defines system boundaries (context) |
| `layer` | Layer | L2 | ❌ | ❌ | - | - | Defines architecture layers |
| `relation` | Relation | L2 | ✅ | ❌ | - | - | Defines relations between components |
| `artifact` | Artifact | L3 | ✅ | ✅ | - | - | Defines artifacts (docs/, specs/) |
| `directory-entry` | DirectoryEntry | L3 | ✅ | ✅ | - | - | Defines directory structure |
| `cli-command` | CLICommand | L3 | ✅ | ✅ | ✅  | - | Defines CLI command specifications |
| `test-ref` | TestRef | L3 | ✅ | ✅ | ✅ Test Code | ✅ | Test reference (association between test code and requirements) |
<!--@embedoc:end-->

---

## 3. SSOT Types

Each entity has a clear SSOT (Single Source of Truth) type indicating where it should be managed.

| SSOT Type | Description | Example |
|---------|------|-----|
| **TS-SSOT** | Managed in this framework's TypeScript models | Requirements, concept model, screen specs |
| **External SSOT** | Managed directly in existing tools/formats. TS only references them | OpenAPI, DDL, IaC |
| **TS-Ref** | TS holds only reference information (ID, path, etc.) and links to external SSOT | APIRef, TableRef |

---

## 4. Model Levels

Models are classified by abstraction level:

| Level | Name | Description | Examples |
|-------|------|-------------|----------|
| L0 | Business + Domain | Why / Problem space - Goals, business flows, actors, terms, business rules | UseCase, Actor, Term |
| L1 | Requirements | What - Functional/non-functional requirements, constraints, acceptance criteria | Requirement |
| L2 | Design | How (approach) - Architecture, component decomposition, domain model, main sequences | Component, Entity, Layer, Boundary |
| L3 | Detailed Design / Implementation | How to build - Screen/API/DB definitions, external SSOT references | Artifact, DirectoryEntry, CLICommand, TestRef |

---

End of document
