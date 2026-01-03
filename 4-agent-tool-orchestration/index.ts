import Anthropic from "@anthropic-ai/sdk";
import { Command } from "commander";
import * as readline from "readline/promises";
import { Agent } from "./agent";
import { ListFilesToolDefinition } from "./tools/list_files";
import { ReadFileToolDefinition } from "./tools/read_file";
import { logger } from "../logger";
import { console_out } from "../console";

async function main() {
    const program = new Command();
    program
        .option("-v, --verbose", "Enable verbose logging")
        .parse(process.argv);

    const options = program.opts();
    const verbose = !!options.verbose;

    if (verbose) {
        logger.level = "debug";
    }

    const client = new Anthropic();

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const tools = [ListFilesToolDefinition, ReadFileToolDefinition];

    const agent = new Agent(client, rl, tools, verbose);

    try {
        await agent.run();
    } catch (err) {
        console_out.error(err instanceof Error ? err.message : String(err));
    } finally {
        rl.close();
    }
}

main().catch((err) => {
    console_out.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
