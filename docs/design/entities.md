# Entities

| ID | Name | Description |
|----|------|-------------|
| E-001 | Requirement | Entity representing requirements. Base for functional requirements, non-functional requirements, and constraints |
| E-010 | Component | Architecture component (system, container, component, person) |
| E-011 | Boundary | Architecture boundary (system boundary, subsystem boundary, etc.) |
| E-012 | Layer | Architecture layer (presentation, business, data, etc.) |
| E-020 | Entity | Concept model entity |
| E-030 | Screen | Screen definition |
| E-040 | APIRef | Reference to external API (OpenAPI) |
| E-041 | TableRef | Reference to external table definition (DDL/Prisma) |
| E-050 | Artifact | Artifact classification. Manages human-readable/machine-readable artifacts generated from SSOT |

---

## E-001: Requirement

Entity representing requirements. Base for functional requirements, non-functional requirements, and constraints

### Attributes

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | Unique ID (FR-001, etc.) |
| name | string | Yes | Requirement name |
| description | string | Yes | Detailed description of requirement |
| rationale | string | No | Reason/background for requirement |
| priority | enum | Yes | Priority |
| status | enum | No | Status |

---

## E-010: Component

Architecture component (system, container, component, person)

### Attributes

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | Unique ID (COMP-001, etc.) |
| name | string | Yes | Component name |
| description | string | Yes | Description |
| type | enum | Yes | Component type |
| external | boolean | No | Whether external component |
| layerId | string | No | Belonging layer ID |
| boundaryId | string | No | Belonging boundary ID |

---

## E-011: Boundary

Architecture boundary (system boundary, subsystem boundary, etc.)

### Attributes

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | Unique ID |
| name | string | Yes | Boundary name |
| description | string | No | Description |
| type | enum | No | Boundary type |

---

## E-012: Layer

Architecture layer (presentation, business, data, etc.)

### Attributes

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | Unique ID |
| name | string | Yes | Layer name |
| order | integer | Yes | Layer order (higher is more upper) |

---

## E-020: Entity

Concept model entity

### Attributes

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | Unique ID (ENT-001, etc.) |
| name | string | Yes | Entity name |
| description | string | Yes | Description |
| isAggregate | boolean | No | Whether aggregate root |
| boundaryId | string | No | Belonging boundary ID |

---

## E-030: Screen

Screen definition

### Attributes

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | Unique ID (SCR-001, etc.) |
| name | string | Yes | Screen name |
| description | string | Yes | Description |
| type | enum | No | Screen type |
| url | string | No | URL path |
| authRequired | boolean | No | Whether authentication required |

---

## E-040: APIRef

Reference to external API (OpenAPI)

### Attributes

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | Unique ID |
| specPath | string | Yes | OpenAPI file path |
| operationId | string | Yes | Operation ID |
| componentId | string | No | Related component ID |

---

## E-041: TableRef

Reference to external table definition (DDL/Prisma)

### Attributes

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | Unique ID |
| tableName | string | Yes | Table name |
| sourceType | enum | No | Source type |
| sourcePath | string | Yes | Source file path |
| entityId | string | No | Corresponding concept entity ID |

---

## E-050: Artifact

Artifact classification. Manages human-readable/machine-readable artifacts generated from SSOT

### Attributes

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | Unique ID |
| name | string | Yes | Artifact name |
| category | enum | Yes | Classification (SSOT/human-readable/machine-readable/implementation code) |
| location | string | Yes | Directory path (design/, docs/, specs/, src/) |
| purpose | string | Yes | Purpose |
| driftTarget | boolean | No | Whether drift detection target |
| generatedFrom | string | No | Source (SSOT ID) |

---
