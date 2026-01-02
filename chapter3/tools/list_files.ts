import Anthropic from "@anthropic-ai/sdk";
import { Command } from "commander";
import * as readline from "readline/promises";
import { readdir } from "fs/promises";
import { z } from 'zod';
import { logger } from "../../logger";
import { console_out } from "../../console";

const program = new Command();

program
    .version("1.0.0")
    .description("A TypeScript CLI")
    .option("-v, --verbose", "verbose output")
    .action(async (options) => {
        const verbose = !!options.verbose;

        if (verbose) {
            logger.level = "debug";
            logger.debug("verbose logging enabled");
        }

        const client = new Anthropic();
        if (verbose) {
            logger.debug("Anthropic client created");
        }

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        const tools = [ListFilesToolDefinition];
        const agent = new Agent(client, rl, verbose, tools);
        await agent.run();

        rl.close();
    });

const ListFilesInputSchema = z.object({
    path: z.string().describe("Path to the directory to list"),
});

const ListFiles = async (args: z.infer<typeof ListFilesInputSchema>): Promise<string> => {
    try {
        const files = await readdir(args.path);
        return files.join("\n");
    } catch (err: any) {
        return `Error listing files: ${err.message}`;
    }
}

const ListFilesToolDefinition: ToolDefinition = {
    Param: {
        name: "list_files",
        description: "List files in a directory",
        input_schema: GenerateSchema(ListFilesInputSchema),
    },
    Execute: ListFiles,
}

interface ToolDefinition {
    Param: Anthropic.Tool;
    Execute: (args: any) => Promise<string>;
}

class Agent {
    private client: Anthropic;
    private rl: readline.Interface;
    private verbose: boolean;
    private tools: ToolDefinition[];

    constructor(
        client: Anthropic,
        rl: readline.Interface,
        verbose: boolean,
        tools: ToolDefinition[]
    ) {
        this.client = client;
        this.rl = rl;
        this.verbose = verbose;
        this.tools = tools;
    }

    async run() {
        const conversation: Anthropic.MessageParam[] = [];

        if (this.verbose) {
            logger.debug("Conversation started");
        }

        console_out.banner("Chat with Claude (use 'ctrl-c' to quit)");

        while (true) {
            let userInput: string;
            try {
                userInput = await this.rl.question(console_out.userPromptString());
            } catch {
                if (this.verbose) {
                    logger.debug("User input ended, breaking from chat loop");
                }
                break;
            }

            if (!userInput) {
                if (this.verbose) {
                    logger.debug("Skipping empty message");
                }
                continue;
            }

            if (this.verbose) {
                logger.debug({ userInput }, "User input received");
            }

            conversation.push({ role: "user", content: userInput });

            if (this.verbose) {
                logger.debug({ conversationLength: conversation.length }, "Sending message to Claude");
            }

            try {
                let message = await this.runInference(conversation);
                conversation.push({ role: "assistant", content: message.content });

                while (true) {
                    let hasToolUse = false;
                    let toolsResults: Anthropic.ContentBlockParam[] = [];

                    if (this.verbose) {
                        logger.debug({ conversationLength: conversation.length }, "Received response from Claude");
                    }

                    for (const block of message.content) {
                        if (block.type === "text") {
                            console_out.claude(block.text);
                        } else if (block.type === "tool_use") {
                            hasToolUse = true;
                            const toolToUse = block.name;
                            let toolResult: string | undefined;
                            let toolErrorMsg: string | undefined;
                            let toolFound: boolean = false;

                            for (const tool of this.tools) {
                                if (tool.Param.name === toolToUse) {
                                    if (this.verbose) {
                                        logger.debug({ toolToUse }, "Using tool");
                                    }
                                    try {
                                        toolResult = await tool.Execute(block.input);
                                    } catch (err) {
                                        toolErrorMsg = err instanceof Error ? err.message : String(err);
                                        logger.error({ toolToUse, toolErrorMsg }, "Tool execution failed");
                                    }

                                    if (this.verbose && !toolErrorMsg) {
                                        logger.debug({ toolToUse, resultLength: toolResult?.length }, "Tool execution successful");
                                    }
                                    toolFound = true;
                                    break;
                                }
                            }

                            if (!toolFound) {
                                toolErrorMsg = `Tool not found: ${toolToUse}`;
                                logger.error({ toolToUse }, "Tool not found");
                            }

                            toolsResults.push({
                                type: "tool_result",
                                tool_use_id: block.id,
                                content: toolErrorMsg || toolResult,
                                is_error: !!toolErrorMsg
                            });
                        }
                    }

                    if (!hasToolUse) {
                        console_out.finishClaudeTurn();
                        break;
                    }

                    if (this.verbose) {
                        logger.debug({ toolResultCount: toolsResults.length }, "Sending tool results to Claude");
                    }

                    conversation.push({ role: "user", content: toolsResults });
                    message = await this.runInference(conversation);
                    conversation.push({ role: "assistant", content: message.content });
                }
            } catch (err) {
                if (this.verbose) {
                    logger.debug({ err }, "Error during inference");
                }
                console_out.error(err instanceof Error ? err.message : String(err));
                return;
            }
        }

        if (this.verbose) {
            logger.debug("Conversation ended");
        }
    }

    async runInference(conversation: Anthropic.MessageParam[]) {
        const anthropicTools: Anthropic.ToolUnion[] = this.tools.map(tool => tool.Param);

        if (this.verbose) {
            logger.debug("Making API call to Claude with model: claude-3-5-haiku-latest");
        }

        try {
            const message = await this.client.messages.create({
                model: "claude-3-5-haiku-latest",
                max_tokens: 1024,
                messages: conversation,
                tools: anthropicTools,
            });

            if (this.verbose) {
                logger.debug("API call successful, response received");
            }
            return message;
        } catch (err) {
            if (this.verbose) {
                logger.debug({ err }, "API call failed");
            }
            throw err;
        }
    }
}

function GenerateSchema<T extends z.ZodType>(v: T): Anthropic.Tool['input_schema'] {
    const schema = (v as any).toJSONSchema()
    return {
        type: "object",
        properties: schema.properties,
        required: schema.required,
    }
}

program.parse(process.argv);
