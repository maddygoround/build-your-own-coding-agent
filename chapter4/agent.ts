import Anthropic from "@anthropic-ai/sdk";
import { Result } from "../utils";
import { LogFn, ToolDefinition } from "./types";

export class Agent {
    private client: Anthropic;
    private getUserMessage: () => Result<string>;
    private verbose: boolean;
    private tools: ToolDefinition[];
    private log: LogFn;

    constructor(
        client: Anthropic,
        getUserMessage: () => Result<string>,
        tools: ToolDefinition[],
        options: { verbose?: boolean; log?: LogFn } = {}
    ) {
        this.client = client;
        this.getUserMessage = getUserMessage;
        this.tools = tools;
        this.verbose = !!options.verbose;
        this.log = options.log || (() => { });
    }

    async run() {
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

            conversation.push({ role: "user", content: userInput });

            try {
                let message = await this.runInference(conversation);
                conversation.push({ role: "assistant", content: message.content });

                while (true) {
                    let hasToolUse = false;
                    let toolsResults: Anthropic.ContentBlockParam[] = [];

                    for (const block of message.content) {
                        if (block.type === "text") {
                            console.log("\x1b[92mClaude\x1b[0m: ", block.text);
                        } else if (block.type === "tool_use") {
                            hasToolUse = true;
                            const toolToUse = block.name;
                            let toolResult: string | undefined;
                            let toolError: Error | undefined;
                            let toolFound: boolean = false;

                            for (const tool of this.tools) {
                                if (tool.Param.name === toolToUse) {
                                    if (this.verbose) {
                                        this.log(`Using tool: ${toolToUse}`);
                                    }
                                    [toolError, toolResult] = await tool.Execute(block.input);
                                    if (toolError) {
                                        console.log("\x1b[91merror\x1b[0m: ", toolError.message);
                                    }
                                    toolFound = true;
                                    break;
                                }
                            }

                            if (!toolFound) {
                                toolError = new Error(`Tool not found: ${toolToUse}`);
                                console.log("\x1b[91merror\x1b[0m: Tool not found: ", toolToUse);
                            }

                            toolsResults.push({
                                type: "tool_result",
                                tool_use_id: block.id,
                                content: toolError ? toolError.message : toolResult,
                                is_error: !!toolError,
                            });
                        }
                    }

                    if (!hasToolUse) {
                        break;
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

    private async runInference(conversation: Anthropic.MessageParam[]) {
        const anthropicTools: Anthropic.ToolUnion[] = this.tools.map((tool) => tool.Param);

        if (this.verbose) {
            this.log(`Making API call to Claude`);
        }

        try {
            const message = await this.client.messages.create({
                model: "claude-3-5-haiku-latest",
                max_tokens: 1024,
                messages: conversation,
                tools: anthropicTools,
            });

            return message;
        } catch (err) {
            if (this.verbose) {
                this.log(`API call failed: ${err}`);
            }
            throw err;
        }
    }
}
