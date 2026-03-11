```
├── design/  # TypeScript (source of truth) = upstream SSOT (requirement/design models)
│   ├── _models/  # Model definitions (schemas, lint rules, exporters)
│   ├── requirements.ts  # Requirement definitions
│   ├── usecases.ts  # Use case and actor definitions
│   ├── architecture.ts  # Logical architecture (C4 System/Container)
│   ├── concept-model.ts  # Concept model (Entity/Relation)
│   ├── glossary.ts  # Glossary
│   ├── artifacts.ts  # Artifact and directory structure definitions
│   └── cli-commands.ts  # CLI command specifications
├── docs/  # Human-readable documents (auto-updated via embedoc)
│   ├── framework_requirements_spec.md  # Framework requirements specification (sections auto-updated via embedoc)
│   ├── model-design.md  # Model design guide
│   ├── model-guide.md  # Model definition guide
│   ├── model_entity_catalog.md  # Model and entity catalog
│   └── framework_evaluation.md  # Framework evaluation
├── specs/  # Machine-readable artifacts (JSON Schema for consistency checking)
│   ├── schemas/  # JSON Schema
│   │   └── entities/  # Entity JSON Schema (E-001.json, etc.)
│   └── index.json  # Aggregated data (reference graph for all models)
└── src/  # Application implementation code (not managed by speckeeper)
```