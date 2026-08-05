```
├── design/  # YAML spec data and TypeScript models (source of truth) = upstream SSOT
│   ├── _models/  # Model definitions (schemas, lint rules, exporters)
│   ├── requirements.yaml  # Requirement definitions
│   ├── usecases.yaml  # Use case and actor definitions
│   ├── architecture.yaml  # Logical architecture (C4 System/Container)
│   ├── concept-model.yaml  # Concept model (Entity/Relation)
│   ├── glossary.yaml  # Glossary
│   ├── artifacts.yaml  # Artifact and directory structure definitions
│   ├── cli-commands.yaml  # CLI command specifications
│   ├── test-refs.yaml  # Test definitions and requirement linkage
│   └── index.ts  # Design entry point (model and spec registration)
├── docs/  # Human-readable documents (generated; embedoc updates marker sections)
│   ├── framework_requirements_spec.md  # Framework requirements specification (sections auto-updated via embedoc)
│   ├── model-guide.md  # Model definition guide
│   ├── model_entity_catalog.md  # Model and entity catalog
│   ├── scaffold-mermaid-spec.md  # Mermaid-driven model scaffolding specification
│   ├── cli-reference.md  # CLI reference (generated from cli-contract.yaml)
│   ├── directory-entries.md  # Directory structure
│   └── design/  # Per-model specification documents
├── specs/  # Machine-readable artifacts (JSON Schema for consistency checking)
│   ├── schemas/  # JSON Schema
│   │   └── entities/  # Entity JSON Schema (E-001.json, etc.)
│   └── index.json  # Aggregated data (reference graph for all models)
└── src/  # Application implementation code (not managed by speckeeper)
```