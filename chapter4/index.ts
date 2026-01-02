import Anthropic from "@anthropic-ai/sdk";
import { Command } from "commander";
import { createInterface } from "readline";
import { Result, wrapErr } from "../utils";
import { Agent } from "./agent";
import { ListFilesToolDefinition } from "./tools/list_files";
import { ReadFileToolDefinition } from "./tools/read_file";

const program = new Command();

program
    .version("1.0.0")
    .description("A modular agent framework (Chapter 3)")
    .option("-v, --verbose", "verbose output")
    .action(async (options) => {
        const verbose = !!options.verbose;

        const log = (message: string, ...args: any[]) => {
            if (verbose) {
                const now = new Date().toISOString().replace("T", " ").split(".")[0];
                console.log(`${now} [Chapter 3]: ${message}`, ...args);
            }
        };

        const client = new Anthropic();

        const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: false,
        });
        const lineIterator = rl[Symbol.asyncIterator]();

        const getUserMessage = async (): Result<string> => {
            const [err, result] = await wrapErr(lineIterator.next());
            if (err) return [err, undefined];
            const nextResult = result as IteratorResult<string>;
            if (nextResult.done) {
                return [new Error("EOF"), undefined];
            }
            return [undefined, nextResult.value];
        };

        const tools = [ListFilesToolDefinition, ReadFileToolDefinition];
        const agent = new Agent(client, getUserMessage, tools, { verbose, log });

        await agent.run();

        rl.close();
    });

program.parse(process.argv);
