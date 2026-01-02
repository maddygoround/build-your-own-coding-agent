import Anthropic from "@anthropic-ai/sdk";
import { Command } from "commander";
import { readFile } from "fs/promises";
import { createInterface } from "readline";
import { z } from 'zod';
import { Result, wrapErr } from "../../utils";

const program = new Command();

program
    .version("1.0.0")
    .description("A TypeScript CLI")
    .option("-v, --verbose", "verbose output")
    .action(async (options) => {
        const verbose = !!options.verbose;

        // custom logger
        const log = (message: string, ...args: any[]) => {
            if (verbose) {
                const now = new Date().toISOString().replace("T", " ").split(".")[0];
                console.log(`${now} index.ts: ${message}`, ...args);
            }
        };

        if (verbose) {
            log("verbose logging enabled");
        }

        const client = new Anthropic();
        if (verbose) {
            log("Anthropic client created");
        }

        const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: false,
        });
        const lineIterator = rl[Symbol.asyncIterator]();

        const getUserMessage = async (): Result<string> => {
            const [err, result] = await wrapErr(lineIterator.next());
            if (err) return [err, undefined];
            if (result.done) {
                return [new Error("EOF"), undefined];
            }
            return [undefined, result.value];
        };

        const tools = [ReadFileToolDefinition];
        const agent = new Agent(client, getUserMessage, verbose, log, tools);
        await agent.run();

        rl.close();
    });


const ReadFileInputSchema = z.object({
    path: z.string().describe("Path to the file to read"),
});

const ReadFile = async (args: z.infer<typeof ReadFileInputSchema>): Result<string> => {
    console.log(`Reading file: ${args.path}`);
    return await wrapErr(readFile(args.path, "utf-8"));
}

const ReadFileToolDefinition: ToolDefinition = {
    Param: {
        name: "read_file",
        description: "Read the contents of a given relative file path.Use this when you want to see what's inside a file. Do not use this with directory names.",
        input_schema: GenerateSchema(ReadFileInputSchema)
    },
    Execute: ReadFile
}

interface ToolDefinition {
    Param: Anthropic.Tool
    Execute: (args: any) => Result<string>
}



class Agent {
    private client: Anthropic;
    private getUserMessage: () => Result<string>;
    private verbose: boolean;
    private tools: ToolDefinition[];
    private log: (message: string, ...args: any[]) => void;

    constructor(
        client: Anthropic,
        getUserMessage: () => Result<string>,
        verbose: boolean,
        log: (message: string, ...args: any[]) => void,
        tools: ToolDefinition[]
    ) {
        this.client = client;
        this.getUserMessage = getUserMessage;
        this.verbose = verbose;
        this.log = log;
        this.tools = tools;
    }

    async run() {
        // Correct type for conversation history
        const conversation: Anthropic.MessageParam[] = [];

        if (this.verbose) {
            this.log("Conversation started");
        }

        console.log("Chat with Claude (use 'ctrl-c' to quit)");

        while (true) {
            process.stdout.write("\x1b[94mYou\x1b[0m: ");
            const [err, userInput] = await this.getUserMessage();
            if (err || userInput === undefined) {
                if (this.verbose) {
                    this.log("User input ended, breaking from chat loop");
                }
                break;
            }

            if (!userInput) {
                if (this.verbose) {
                    this.log("Skipping empty message");
                }
                continue;
            }

            if (this.verbose) {
                this.log(`User input received: "${userInput}"`);
            }

            conversation.push({ role: "user", content: userInput });

            if (this.verbose) {
                this.log(`Sending message to Claude, conversation length: ${conversation.length}`);
            }

            try {
                let message = await this.runInference(conversation);
                // The SDK returns the message object which fits the MessageParam structure's content 
                // but we need to ensure we push the correct format { role: "assistant", content: ... }
                conversation.push({ role: "assistant", content: message.content });
                while (true) {
                    let hasToolUse = false;
                    let toolsResults: Anthropic.ContentBlockParam[] = [];

                    if (this.verbose) {
                        this.log(`Received response from Claude, conversation length: ${conversation.length}`);
                    }

                    for (const block of message.content) {
                        switch (block.type) {
                            case "text":
                                console.log("\x1b[92mClaude\x1b[0m: ", block.text);
                                break;
                            case "tool_use":
                                hasToolUse = true;
                                const toolToUse = block.name;
                                let toolResult: string | undefined;
                                let toolError: Error | undefined;
                                let toolFound: boolean = false;
                                for (const tool of this.tools) {
                                    if (tool.Param.name === toolToUse) {
                                        if (this.verbose) {
                                            console.log(`Using tool: ${toolToUse}`);
                                        }
                                        [toolError, toolResult] = await tool.Execute(block.input);
                                        if (toolError) {
                                            console.log("\x1b[91merror\x1b[0m: ", toolError.message);
                                        }

                                        if (this.verbose) {
                                            if (toolError) {
                                                console.log("Tool execution failed: ", toolError.message)
                                            } else {
                                                console.log("Tool execution successful, result length: ", toolResult!.length)
                                            }
                                        }
                                        toolFound = true;
                                        break;
                                    }
                                }
                                if (!toolFound) {
                                    toolError = new Error(`Tool not found: ${toolToUse}`);
                                    console.log("\x1b[91merror\x1b[0m: Tool not found: ", toolToUse);
                                }

                                if (toolError) {
                                    toolsResults.push({ type: "tool_result", tool_use_id: block.id, content: toolError.message, is_error: true })
                                } else {
                                    toolsResults.push({ type: "tool_result", tool_use_id: block.id, content: toolResult, is_error: false })
                                }
                        }
                    }

                    if (!hasToolUse) {
                        break;
                    }

                    if (this.verbose) {
                        this.log(`Sending tool results to Claude, count: ${toolsResults.length}`);
                    }

                    conversation.push({ role: "user", content: toolsResults });
                    message = await this.runInference(conversation);
                    conversation.push({ role: "assistant", content: message.content });
                }
            } catch (err) {
                if (this.verbose) {
                    this.log(`Error during inference: ${err}`);
                }
                console.error(err);
                return;
            }
        }

        if (this.verbose) {
            this.log("Conversation ended");
        }
    }

    async runInference(conversation: Anthropic.MessageParam[]) {

        const anthropicTools: Anthropic.ToolUnion[] = this.tools.map(tool => tool.Param);

        if (this.verbose) {
            this.log(`Making API call to Claude with model: claude-3-5-haiku-latest`);
        }

        try {
            const message = await this.client.messages.create({
                model: "claude-3-5-haiku-latest",
                max_tokens: 1024,
                messages: conversation,
                tools: anthropicTools,
            });

            if (this.verbose) {
                this.log("API call successful, response received");
            }
            return message;
        } catch (err) {
            if (this.verbose) {
                this.log(`API call failed: ${err}`);
            }
            throw err;
        }
    }
}

function GenerateSchema<T extends z.ZodType>(v: T): Anthropic.Tool['input_schema'] {
    const schema = v.toJSONSchema()
    return {
        type: "object",
        properties: schema.properties,
    }
}

program.parse(process.argv);
