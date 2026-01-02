import { Command } from "commander";
import * as readline from "readline/promises";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../logger";
import { console_out } from "../console";

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

        const agent = new Agent(client, rl, verbose);
        await agent.run();

        rl.close();
    });

class Agent {
    private client: Anthropic;
    private rl: readline.Interface;
    private verbose: boolean;

    constructor(
        client: Anthropic,
        rl: readline.Interface,
        verbose: boolean
    ) {
        this.client = client;
        this.rl = rl;
        this.verbose = verbose;
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
                const message = await this.runInference(conversation);
                conversation.push({ role: "assistant", content: message.content });

                if (this.verbose) {
                    logger.debug({ conversationLength: conversation.length }, "Received response from Claude");
                }

                for (const block of message.content) {
                    if (block.type === "text") {
                        console_out.claude(block.text);
                    }
                }
                console_out.finishClaudeTurn();
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
        if (this.verbose) {
            logger.debug("Making API call to Claude with model: claude-3-5-haiku-latest");
        }

        try {
            const message = await this.client.messages.create({
                model: "claude-3-5-haiku-latest",
                max_tokens: 1024,
                messages: conversation,
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

program.parse(process.argv);
