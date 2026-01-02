# Chapter 4: The Framework

This chapter represents the final, stable architecture of the project. It moves beyond simple scripts to a **Structured Framework** that prioritizes type safety, error resilience, and extensibility.

## The Goal
The final objective was to establish a pattern where adding new capabilities is as simple as defining a new tool file and registering it. 

## Mature Architecture
The project is now divided into clear layers:

### 1. The Core Agent
The `Agent` class is now completely tool-agnostic. It handles conversation state, inference, and tool dispatching.

- **[agent.ts](file:///Users/m.rathod/Documents/Projects/code-agent-ts/chapter4/agent.ts)**: A fully abstracted, tool-agnostic agent class.
- **[types.ts](file:///Users/m.rathod/Documents/Projects/code-agent-ts/chapter4/types.ts)**: Shared interfaces for tool definitions and logging.
- **[index.ts](file:///Users/m.rathod/Documents/Projects/code-agent-ts/chapter4/index.ts)**: The clean entry point that wires the agent and tools together.
- **[tools/](file:///Users/m.rathod/Documents/Projects/code-agent-ts/chapter4/tools/)**: Normalized tool implementations (`read_file.ts` and `list_files.ts`).
- **[utils.ts](file:///Users/m.rathod/Documents/Projects/code-agent-ts/utils.ts)**: Core utilities for Go-style error handling (`wrapErr`).

### 2. Standardization (`types.ts`)
Shared interfaces ensure that all tools and loggers speak the same language. This eliminates runtime errors caused by mismatched tool signatures.

### 3. Implementation Patterns
This chapter fully adopts the **Go-style error handling** pattern from the root utilities. This is critical for tools like `read_file` or `list_files` where filesystem errors (permissions, missing paths) are expected "normal" results rather than exceptional crashes.

## Extending the Framework
To add a new tool to this framework:
1. **Define**: Create a tool file in the `tools/` directory.
2. **Implement**: Write the function using `wrapErr` for any IO operations.
3. **Describe**: Create a `ToolDefinition` that uses Zod to define the input schema.
4. **Register**: Import and add the tool to the `tools` array in `index.ts`.

### Flow Diagram
```mermaid
graph TD
    User([User]) -- "Prompt" --> Main[index.ts]
    Main -- "New Result<Agent>" --> Agent[Agent Instance]
    Agent -- "Reason" --> API[Anthropic API]
    API -- "Tool Use" --> Dispatcher[Agent Dispatcher]
    Dispatcher -- "wrapErr(Exec)" --> Tool[Tool Implementation]
    Tool -- "[Error, Result]" --> Dispatcher
    Dispatcher -- "Feed Result back" --> API
    API -- "Text Response" --> User
    subgraph Core Utilities
        wrapErr
        ResultType[Result Type]
    end
```

## How to Run
```bash
bun run chapter4/index.ts --verbose
```
