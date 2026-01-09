/**
 * Console output utilities for conversation display.
 * Separate from logging - this is for user-facing chat output.
 */

import pc from "picocolors";
import boxen from "boxen";
import logSymbols from "log-symbols";

let claudeTurnStarted = false;
let thinkingBlockActive = false;

export const console_out = {
    /**
     * Print the welcome banner in a styled box
     */
    banner(message: string): void {
        console.log(
            boxen(pc.bold(message), {
                padding: { top: 0, bottom: 0, left: 1, right: 1 },
                borderColor: "cyan",
                borderStyle: "round",
            })
        );
        console.log();
    },

    /**
     * Get the styled "You: " prompt string for readline
     */
    userPromptString(): string {
        return `${pc.blue(pc.bold("You"))} ${pc.dim("›")} `;
    },

    /**
     * Print Claude's response. Only shows "Claude:" prefix once per turn.
     * Call finishClaudeTurn() when the turn is complete.
     */
    claude(text: string): void {
        if (!claudeTurnStarted) {
            console.log();
            console.log(`${pc.green(pc.bold("Claude"))} ${pc.dim("›")} ${text}`);
            claudeTurnStarted = true;
        } else {
            console.log();
            console.log(text);
        }
    },

    /**
     * Print Claude's streaming text delta. Shows "Claude:" prefix once per turn.
     * Does not add newlines - text is printed as it streams.
     */
    claudeStream(delta: string): void {
        if (!claudeTurnStarted) {
            process.stdout.write(`\n${pc.green(pc.bold("Claude"))} ${pc.dim("›")} `);
            claudeTurnStarted = true;
        }
        process.stdout.write(delta);
    },

    /**
     * Print tool call start indicator
     */
    toolStart(toolName: string, input?: any): void {
        const width = (process.stdout.columns || 80) - 5;
        const prefix = `⚡ Calling ${toolName} `;
        const line = pc.dim("─".repeat(Math.max(0, width - prefix.length)));
        
        console.log(`\n${pc.yellow("⚡")} ${pc.bold("Calling")} ${pc.yellow(pc.bold(toolName))} ${line}`);
        
        if (input && Object.keys(input).length > 0) {
            for (const [key, value] of Object.entries(input)) {
                console.log(`   ${pc.dim(key)}: ${pc.cyan(String(value))}`);
            }
            console.log();
        }
    },

    /**
     * Print tool execution result indicator
     */
    toolEnd(toolName: string, success: boolean): void {
        const width = (process.stdout.columns || 80) - 5;
        const prefix = `✓ Finished ${toolName} `;
        const line = pc.dim("─".repeat(Math.max(0, width - prefix.length)));
        
        if (success) {
            console.log(`${pc.green("✓")} ${pc.bold("Finished")} ${pc.green(pc.bold(toolName))} ${line}\n`);
        } else {
            console.log(`${pc.red("✗")} ${pc.bold("Failed")} ${pc.red(pc.bold(toolName))} ${line}\n`);
        }
    },

    /**
     * Mark the end of Claude's turn (resets prefix tracking).
     * Call this after user input loop resumes.
     */
    finishClaudeTurn(): void {
        if (claudeTurnStarted) {
            console.log();
            claudeTurnStarted = false;
        }
        thinkingBlockActive = false;
    },

    /**
     * Start a thinking block
     */
    thinkingStart(): void {
        thinkingBlockActive = true;
        console.log(`\n${pc.dim("💭")} ${pc.cyan(pc.bold("Thinking..."))}`);
    },

    /**
     * Stream thinking content with dimmed styling
     */
    thinkingStream(delta: string): void {
        process.stdout.write(pc.dim(pc.cyan(delta)));
    },

    /**
     * End thinking block
     */
    thinkingEnd(): void {
        if (thinkingBlockActive) {
            console.log();
            thinkingBlockActive = false;
        }
    },

    /**
     * Print an error message with symbol
     */
    error(message: string): void {
        console.error(`${logSymbols.error} ${pc.red(pc.bold("Error"))}: ${message}`);
    },

    /**
     * Print a success message with symbol
     */
    success(message: string): void {
        console.log(`${logSymbols.success} ${pc.green(message)}`);
    },

    /**
     * Print a warning message with symbol
     */
    warn(message: string): void {
        console.warn(`${logSymbols.warning} ${pc.yellow(message)}`);
    },

    /**
     * Print an info message with symbol
     */
    info(message: string): void {
        console.log(`${logSymbols.info} ${pc.cyan(message)}`);
    },
};
