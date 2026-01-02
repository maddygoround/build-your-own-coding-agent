import { Command } from "commander";
import { createInterface } from "readline";
import Anthropic from "@anthropic-ai/sdk";

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

        const getUserMessage = async (): Promise<[string, boolean]> => {
            const result = await lineIterator.next();
            if (result.done) {
                return ["", false];
            }
            return [result.value, true];
        };

        const agent = new Agent(client, getUserMessage, verbose, log);
        await agent.run();

        rl.close();
    });

class Agent {
    private client: Anthropic;
    private getUserMessage: () => Promise<[string, boolean]>;
    private verbose: boolean;
    private log: (message: string, ...args: any[]) => void;

    constructor(
        client: Anthropic,
        getUserMessage: () => Promise<[string, boolean]>,
        verbose: boolean,
        log: (message: string, ...args: any[]) => void
    ) {
        this.client = client;
        this.getUserMessage = getUserMessage;
        this.verbose = verbose;
        this.log = log;
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
            const [userInput, ok] = await this.getUserMessage();
            if (!ok) {
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
                const message = await this.runInference(conversation);
                // The SDK returns the message object which fits the MessageParam structure's content 
                // but we need to ensure we push the correct format { role: "assistant", content: ... }
                conversation.push({ role: "assistant", content: message.content });

                if (this.verbose) {
                    this.log(`Received response from Claude, conversation length: ${conversation.length}`);
                }

                for (const block of message.content) {
                    if (block.type === "text") {
                        console.log("\x1b[92mClaude\x1b[0m: ", block.text);
                    }
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
        if (this.verbose) {
            this.log(`Making API call to Claude with model: claude-3-5-haiku-latest`);
        }

        try {
            const message = await this.client.messages.create({
                model: "claude-3-5-haiku-latest",
                max_tokens: 1024,
                messages: conversation,
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

program.parse(process.argv);
