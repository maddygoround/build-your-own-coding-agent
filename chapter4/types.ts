import Anthropic from "@anthropic-ai/sdk";
import { Result } from "../utils";

export type LogFn = (message: string, ...args: any[]) => void;

export interface ToolDefinition {
    Param: Anthropic.Tool;
    Execute: (args: any) => Result<string>;
}
