# AI Coding Agent Framework (TypeScript)

This repository demonstrates the step-by-step evolution of a modular AI coding agent framework built with TypeScript and the Anthropic SDK.

## Project Overview

The project is structured into chapters, each representing a distinct iteration in the agent's development—from a simple message loop to a mature, tool-capable framework.

### Chapters

- **[Chapter 1: The Inception](./chapter1)**: Establishing the fundamental message loop and CLI interaction.
- **[Chapter 2: Introducing Tools](./chapter2)**: Adding the first tool (`read_file`) to enable file reading capabilities.
- **[Chapter 3: Extending Tools](./chapter3)**: Extending the tool set with `list_files` following the same pattern.
- **[Chapter 4: The Framework](./chapter4)**: Separating Agent from Tools into a modular, extensible architecture.

## Evolutionary Overview

The following illustrations track the development of the framework's architecture, now fully integrated with structured logging.

### Chapter 1: Simple Chat Loop
```mermaid
graph TB
    A[Start Chat] --> B[Get User Input]
    B --> C{Empty?}
    C -->|Yes| B
    C -->|No| D[Add to History]
    D --> E[Send to Claude]
    E --> F[Get Response]
    F --> G[Display Text]
    G --> H[Add to History]
    H --> B
```

### Chapter 2: Single Tool Loop
```mermaid
graph TB
    A[Start Chat] --> B[Get User Input]
    B --> C{Empty?}
    C -->|Yes| B
    C -->|No| D[Add to History]
    D --> E[Send to Claude]
    E --> F[Get Response]
    F --> G{Tool Use?}
    G -->|No| H[Display Text]
    G -->|Yes| I[Execute Tool]
    I --> J[Collect Result]
    J --> K[Send Result to Claude]
    K --> F
    H --> L[Add to History]
    L --> B
```

### Chapter 3: Multiple Tools
```mermaid
graph TB
    A[Start Chat] --> B[Get User Input]
    B --> C{Empty?}
    C -->|Yes| B
    C -->|No| D[Add to History]
    D --> E[Send to Claude]
    E --> F[Get Response]
    F --> G{Tool Use?}
    G -->|No| H[Display Text]
    G -->|Yes| I{Which Tool?}
    I -->|read_file| J[Execute ReadFile]
    I -->|list_files| K[Execute ListFiles]
    J --> L[Collect Result]
    K --> L
    L --> M[Send Result to Claude]
    M --> F
    H --> N[Add to History]
    N --> B
```

### Chapter 4: The Framework
```mermaid
graph TB
    A[index.ts] --> B[Register Tools]
    B --> C[Initialize Agent]
    C --> D[Start Chat]
    D --> E[Get User Input]
    E --> F{Empty?}
    F -->|Yes| E
    F -->|No| G[Add to History]
    G --> H[Send to Claude]
    H --> I[Get Response]
    I --> J{Tool Use?}
    J -->|No| K[Display Text]
    J -->|Yes| L[Find Tool by Name]
    L --> M[Execute Tool]
    M --> N[Collect Result]
    N --> O[Send Result to Claude]
    O --> I
    K --> P[Add to History]
    P --> E
```

## Architecture & Core Patterns

### Structured Logging (Pino)
A central pillar of this framework is structured, high-performance logging. We moved away from `console.log` to **Pino**, allowing for:
1. **Log Levels**: Discerning between `debug` traces (reasoning) and `info` results.
2. **Machine-Readable**: Structured JSON output for downstream analysis.
3. **Performance**: Minimal overhead even in heavy agentic loops.

### Idiomatic TypeScript
The project prioritizes standard TypeScript patterns over custom abstractions. 
- **Error Handling**: Uses standard `try-catch` blocks for clear, predictable failure paths.
- **Type Safety**: Leverages strict typing and interfaces to define the contract between the Agent and its Tools.
- **Zod Schemas**: Uses Zod for both runtime validation and automatic generation of JSON schemas for the LLM.


### Key Dependencies

- **[Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript)**: Powers the inference loop and message handling.
- **[Commander](https://github.com/tj/commander.js)**: Provides the CLI argument parsing.
- **[Zod](https://zod.dev)**: Used for data validation and generating JSON schemas for tools.

## Getting Started

1. **Install Dependencies**:
   ```bash
   bun install
   ```
2. **Configure API Key**:
   ```bash
   export ANTHROPIC_API_KEY='your-key-here'
   ```
3. **Run Framework (Chapter 4)**:
   ```bash
   bun run chapter4/index.ts --verbose
   ```
