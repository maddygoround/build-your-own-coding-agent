/**
 * Console output utilities for conversation display.
 * Separate from logging - this is for user-facing chat output.
 */

import pc from "picocolors";
import boxen from "boxen";
import logSymbols from "log-symbols";

let claudeTurnStarted = false;

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
     * Mark the end of Claude's turn (resets prefix tracking).
     * Call this after user input loop resumes.
     */
    finishClaudeTurn(): void {
        if (claudeTurnStarted) {
            console.log();
            claudeTurnStarted = false;
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
