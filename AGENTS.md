# Agent Instructions

## Development Environment
This project uses **Bun** for a fast, all-in-one JavaScript/TypeScript runtime and package manager.

## Commands
- `bun install` - Install dependencies
- `bun run chapter1/index.ts` - Run Chapter 1 (Basic Chat)
- `bun run chapter4/index.ts` - Run Chapter 4 (Modular Framework)
- `bun test` - Run tests
- `bun build` - Bundle the project

### Application Commands
- `bun run chapter1/index.ts` - Simple chat interface with Claude.
- `bun run chapter2/read_file.ts` - Chat with file reading capabilities.
- `bun run chapter3/list_files.ts` - Chat with file listing and reading capabilities.
- `bun run chapter4/index.ts` - Full modular framework with multiple tools.

### Verbose Logging
All chapters support a `--verbose` (or `-v`) flag for detailed execution logging:
- `bun run chapter1/index.ts --verbose` - Enable verbose logging for debugging.
- `bun run chapter4/index.ts --verbose` - See detailed agent behavior, tool execution, and API calls.

## Architecture
- **Runtime**: [Bun](https://bun.sh/)
- **API**: Anthropic SDK (`claude-3-5-haiku-latest`)
- **Logging**: [Pino](https://getpino.io/) for structured debugging.
- **UI**: Custom `console_out` utility (in `console.ts`) for clean, aligned terminal interaction.
- **Structure**: Chapters 1-4 demonstrating a progressive build from a monolithic loop to a modular agent framework.

## Code Style Guidelines
- Use **TypeScript** for all logic.
- Prefer **Zod** for schema definition and validation.
- Use `console_out` for all user-facing chat output to ensure label alignment (`You:` and `Claude:`).
- Use `logger` for all internal, developer-facing debugging messages.

## Troubleshooting

### Verbose Logging
When debugging issues with the agents, use the `--verbose` flag to get detailed execution logs.

**What verbose logging shows:**
- API calls to Claude (model, parameters, timing).
- Tool execution details (discovery, input validation, execution result).
- Conversation flow (history tracking, token usage context).
- Error details for internal failures.

**Log output locations:**
- **Verbose mode**: `logger.debug` sends detailed JSON logs to `stderr` (formatted by `pino-pretty`).
- **Standard mode**: `console_out` sends clean, formatted chat to `stdout`.

## Notes
- Requires `ANTHROPIC_API_KEY` environment variable to be set.
- Use `ctrl-c` to quit any chat session.
- Chapter-specific details can be found in their respective `README.md` files.
